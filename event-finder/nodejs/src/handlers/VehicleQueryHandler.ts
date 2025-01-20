import { Counter } from "messaging-lib";
import { Config, VehicleQuery, Stopwatch, Logger, VehicleQueryResult, dateToUtcParts, calcTimeWindow, VehicleQueryResultStats, VehicleQueryPartition, VehicleQueryPartitionResultStats, sleep, asyncChunks, MessageHandler, IMessageBus, IncomingMessageEnvelope, RequestHandler, Request, RequestOptionsPair, RequestTimeoutError, isResponseSuccess, isVehicleQueryPartitionResultStats, VehicleQueryStartedEvent } from 'core-lib';
import path from 'path';
import { gpsCoordinatesToPolyon, polygonToGeohashes } from "../core/geospatial.js";
import { Feature, GeoJsonProperties, Polygon } from "geojson";
import * as turf from '@turf/turf';
import { DataFrameRepository, ListOptions, DataFrameDescriptor, stringToFormat } from "data-lib";

const vehicles_search_processed_events_total_counter = new Counter({
    name: 'vehicles_search_processed_events_total',
    help: 'number of events processed during a search by the event finder',
    labelNames: [],
});

const vehicles_search_selected_events_total_counter = new Counter({
    name: 'vehicles_search_selected_events_total',
    help: 'number of events selected during a search by the event finder',
    labelNames: [],
});

const vehicles_search_processed_bytes_total_counter = new Counter({
    name: 'vehicles_search_processed_bytes_total',
    help: 'number of bytes processed during a search by the event finder',
    labelNames: [],
});

export class VehicleQueryContext {
    processedFilesCount = 0;
    processedBytes = 0;
    processedRecordCount = 0;
    selectedRecordCount = 0;
    distinctVehicles = new Set<string>();
    watch = new Stopwatch();
    fromDate: Date;
    toDate: Date;
    polygon: Feature<Polygon, GeoJsonProperties>;
    timeout: number;
    parallelize: boolean;
    useChunking: boolean;
    timeoutExpired = false;
    limitReached = false;    

    constructor(public config: Config, public event: Request<VehicleQuery>) {
        this.watch.start();
        this.fromDate = new Date(event.body.fromDate);
        this.toDate = new Date(event.body.toDate);
        if (this.fromDate.getTime() > this.toDate.getTime()) {
            throw new Error('fromDate must be less than toDate');
        }
        this.polygon = gpsCoordinatesToPolyon(event.body.polygon);
        this.timeout = event.timeout ?? this.config.finder.defaultTimeoutInMS;
        this.parallelize = event.body.parallelize ?? this.config.finder.parallelSearch;
        this.useChunking = event.body.useChunking ?? this.config.finder.useChunking;
    }

    hasTimedOut(): boolean {
        return this.watch.elapsedTimeInMS() >= this.timeout;
    }

    shouldAbort(): boolean {
        return this.timeoutExpired || this.limitReached;
    }

    checkIfLimitWasReached() {
        if (!this.limitReached && this.event.body.limit) {
            this.limitReached = this.selectedRecordCount >= this.event.body.limit;
        }
        return this.limitReached;
    }

    checkTimeout() {
        if (!this.timeoutExpired && !this.limitReached) {
            this.timeoutExpired = this.hasTimedOut();
        }
        return this.timeoutExpired;
    }

    processSubQueryResponse(resp: VehicleQueryPartitionResultStats) {
        this.selectedRecordCount += resp.stats.selectedRecordCount;
        this.processedBytes += resp.stats.processedBytes;
        this.processedFilesCount += resp.stats.processedFilesCount;
        this.processedRecordCount += resp.stats.processedRecordCount;
        for (const vehicleId of resp.distinctVehicleIds) {
            this.distinctVehicles.add(vehicleId);
        }
        this.checkIfLimitWasReached();
        this.checkTimeout();
    }
}

export class VehicleQueryHandler extends RequestHandler<VehicleQuery, VehicleQueryResultStats> {

    constructor(
        private config: Config,
        private logger: Logger,
        private messageBus: IMessageBus,
        private repo: DataFrameRepository,
    ) {
        super();
    }

    get messageTypes(): string[] {
        return [
            'vehicle-query',
        ]; 
    }

    protected async processRequest(req: IncomingMessageEnvelope<Request<VehicleQuery>>): Promise<VehicleQueryResultStats> {
        const event = req.body.body;
        this.logger.debug('Received query', event);
        const startingEvent: VehicleQueryStartedEvent = {
            type: 'vehicle-query-started',
            query: req.body,
        };
        // Send it to our inbox to let the viewer display the polygon shape and clear the data
        this.messageBus.publish(req.body.replyTo, startingEvent);
        const ctx = new VehicleQueryContext(this.config, req.body);
        const geohashes = this.createGeohashes(ctx.polygon);
        if (ctx.useChunking) {
            for await  (const filenames of asyncChunks(this.enumerateFiles(ctx.fromDate, ctx.toDate, geohashes), ctx.config.finder.instances)) {
                const subRequests: RequestOptionsPair<VehicleQueryPartition>[] = []; 
                for (const filename of filenames) {
                    const subRequest = this.createProcessFileRequest(ctx, filename);
                    if (subRequest) {
                        subRequests.push(subRequest);
                    }
                }
                try {
                    for await (const resp of this.messageBus.requestBatch(subRequests)) {
                        this.logger.debug('Received sub-request response', resp.body);
                        if (isResponseSuccess(resp)) {
                            if (isVehicleQueryPartitionResultStats(resp.body.body)) {
                                ctx.processSubQueryResponse(resp.body.body);
                            }
                        }
                    }    
                } catch(err: any) {
                    if (err instanceof RequestTimeoutError) {
                        this.logger.debug('Some sub-requests timed out', err);
                    } else {
                        throw err;
                    }
                }
                if (ctx.shouldAbort()) {
                    break;
                }
            }    
        } else {
            const subRequests: RequestOptionsPair<VehicleQueryPartition>[] = []; 
            for await (const filename of this.enumerateFiles(ctx.fromDate, ctx.toDate, geohashes)) {
                const subRequest = this.createProcessFileRequest(ctx, filename);
                if (subRequest) {
                    subRequests.push(subRequest);
                }
                try {
                    for await (const resp of this.messageBus.requestBatch(subRequests)) {
                        this.logger.debug('Received sub-request response', resp.body);
                        if (isResponseSuccess(resp)) {
                            if (isVehicleQueryPartitionResultStats(resp.body.body)) {
                                ctx.processSubQueryResponse(resp.body.body);
                            }
                        }
                    }    
                } catch(err: any) {
                    if (err instanceof RequestTimeoutError) {
                        this.logger.debug('Some sub-requests timed out', err);
                    } else {
                        throw err;
                    }
                }
                if (ctx.shouldAbort()) {
                    break;
                }
            }
        } 

        ctx.watch.stop();
        const stats: VehicleQueryResultStats = {
            type: 'vehicle-query-result-stats',
            elapsedTimeInMS: ctx.watch.elapsedTimeInMS(),
            processedFilesCount: ctx.processedFilesCount,
            processedBytes: ctx.processedBytes,
            processedRecordCount: ctx.processedRecordCount,
            selectedRecordCount: ctx.selectedRecordCount,
            distinctVehicleCount: ctx.distinctVehicles.size,
            timeoutExpired: ctx.timeoutExpired,
            limitReached: ctx.limitReached,
        };
        this.logger.debug('Stats', stats);
        return stats;
    }
    
    private createProcessFileRequest(ctx: VehicleQueryContext, item: DataFrameDescriptor): RequestOptionsPair<VehicleQueryPartition> | undefined {
        ctx.checkIfLimitWasReached();
        ctx.checkTimeout();
        if (ctx.shouldAbort()) {
            return undefined;
        }
        ctx.processedFilesCount += 1;
        const subQuery: VehicleQueryPartition = {
            type: 'vehicle-query-partition',
            query: {
                ...ctx.event,
                body: {
                    ...ctx.event.body,
                    limit: ctx.event.body.limit ? ctx.event.body.limit - ctx.selectedRecordCount : undefined,
                },
                timeout: Math.max(500, ctx.timeout - ctx.watch.elapsedTimeInMS()),
            },
            filename: item.name,
            filesize: item.size,

        };
        return [
            subQuery,
            {
                subject: 'query.vehicles.partitions',
                parentId: ctx.event.id,
                timeout: ctx.timeout,
            }
        ];
    }

    private createGeohashes(polygon: Feature<Polygon>) {
        if (this.config.partitioning.dataPartition.type === 'geohash') {
            return polygonToGeohashes(polygon, this.config.partitioning.dataPartition.hashLength, false);
        }
        return new Set<string>();
    }

    private async *enumerateFiles(fromDate: Date, toDate: Date, geohashes: Set<string>) {
        const periodInMin = this.config.partitioning.timePartition.aggregationPeriodInMin;
        const fromPrefix = calcTimeWindow(fromDate, periodInMin).toString();
        const toRange = calcTimeWindow(toDate, periodInMin);
        const toPrefix = dateToUtcParts(toRange.untilTime).join('-');
        const flatLayout = this.config.collector.output.flatLayout;
        const listOptions: ListOptions = {
            fromPrefix,
            toPrefix,
            format: stringToFormat(this.config.finder.dataFormat),
        };
        if (flatLayout === false) {
            const commonRoots = findCommonAncestorDirectory(fromDate, toDate);
            listOptions.subFolder = commonRoots.reduce((a, b) => path.join(a, b), '');
        }

        for await (const item of this.repo.list(listOptions)) {
            const segments = path.basename(item.name).split('-');
            const fileGeohash = segments[5];
            if (geohashes.has(fileGeohash)) {
                yield item;
            }
        }
    }


}

export function findCommonAncestorDirectory(d1: Date, d2: Date) {
    const dp1 = dateToUtcParts(d1);
    const dp2 = dateToUtcParts(d2);
    const result: string[] = [];
    for (let i = 0; i < dp1.length; i++) {
        if (dp1[i] === dp2[i]) {
            result.push(dp1[i]);
        } else {
            break;
        }
    }
    return result;
}

export class VehicleQueryPartitionHandler extends RequestHandler<VehicleQueryPartition, VehicleQueryPartitionResultStats> {
    constructor(
        private config: Config,
        private logger: Logger,
        private messageBus: IMessageBus,
        private repo: DataFrameRepository,
    ) {
        super();
    }

    get messageTypes(): string[] {
        return ['vehicle-query-partition'];
    }

    protected async processRequest(req: IncomingMessageEnvelope<Request<VehicleQueryPartition>>): Promise<VehicleQueryPartitionResultStats> {
        const event = req.body.body;
        this.logger.debug('Received query partition', event);
        const ctx = new VehicleQueryContext(this.config, event.query);
        await this.executeProcessFile(ctx, event.filename, event.filesize);
        ctx.watch.stop();
        const stats: VehicleQueryPartitionResultStats = {
            type: 'vehicle-query-partition-result-stats',
            distinctVehicleIds: [...ctx.distinctVehicles],
            stats: {
                type: 'vehicle-query-result-stats',
                elapsedTimeInMS: ctx.watch.elapsedTimeInMS(),
                processedFilesCount: ctx.processedFilesCount,
                processedBytes: ctx.processedBytes,
                processedRecordCount: ctx.processedRecordCount,
                selectedRecordCount: ctx.selectedRecordCount,
                distinctVehicleCount: ctx.distinctVehicles.size,
                timeoutExpired: ctx.timeoutExpired,
                limitReached: ctx.limitReached,
            }
        };
        this.logger.debug('Stats', stats);
        return stats;
    }

    private async executeProcessFile(ctx: VehicleQueryContext, filename: string, filesize: number) {
        for await (const res of this.searchFile(ctx, filename, filesize)) {
            this.messageBus.publish(ctx.event.replyTo, res);
            ctx.selectedRecordCount += 1;
            ctx.distinctVehicles.add(res.vehicleId);
            if (ctx.checkIfLimitWasReached()) {
                break;
            }
        }
        ctx.checkTimeout();
    }

    private async *searchFile(ctx: VehicleQueryContext, filename: string, filesize: number) {
        this.logger.debug('search file ', filename);
        const df = await this.repo.read(filename);

        ctx.processedBytes += filesize;
        vehicles_search_processed_bytes_total_counter.inc(filesize);
        const colNames = df.columns;
        const idx_timestamp = colNames.indexOf('timestamp');
        const idx_vehicleId = colNames.indexOf('vehicleId');
        const idx_vehicleType = colNames.indexOf('vehicleType');
        const idx_gps_lat = colNames.indexOf('gps_lat');
        const idx_gps_lon = colNames.indexOf('gps_lon');
        const idx_gps_alt = colNames.indexOf('gps_alt');
        const idx_geoHash = colNames.indexOf('geoHash');
        const idx_speed = colNames.indexOf('speed');
        const idx_direction = colNames.indexOf('direction');
        for (const row of df.rows()) {
            ctx.processedRecordCount += 1;
            vehicles_search_processed_events_total_counter.inc();
            const timestamp = row[idx_timestamp];
            const vehicleId = row[idx_vehicleId];
            const vehicleType = row[idx_vehicleType];
            const gps_lat = row[idx_gps_lat];
            const gps_lon = row[idx_gps_lon];
            const gps_alt = row[idx_gps_alt];
            const geoHash = row[idx_geoHash];
            const speed = row[idx_speed];
            const direction = row[idx_direction];
            if (timestamp >= ctx.fromDate && timestamp <= ctx.toDate) {
                const pos = turf.point([gps_lon, gps_lat]);
                const isInsidePolygon = turf.booleanContains(ctx.polygon, pos);
                const isValidVehicle = ctx.event.body.vehicleTypes.length === 0 || ctx.event.body.vehicleTypes.includes(vehicleType);
                if (isInsidePolygon && isValidVehicle) {
                    vehicles_search_selected_events_total_counter.inc();
                    const ev: VehicleQueryResult = {
                        type: 'vehicle-query-result',
                        queryId: ctx.event.id,
                        vehicleId,
                        vehicleType,
                        direction,
                        speed,
                        timestamp: timestamp.toISOString(),
                        gps: {
                            alt: gps_alt,
                            lat: gps_lat,
                            lon: gps_lon,
                        },
                        geoHash,
                    };
                    yield ev;    
                }
            }
        }
    }    
}