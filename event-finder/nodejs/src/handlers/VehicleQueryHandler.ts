import { Counter } from "messaging-lib";
import { Config, VehicleQuery, Stopwatch, Logger, VehicleQueryResult, dateToUtcParts, calcTimeWindow, VehicleQueryResultStats, VehicleQueryPartition, VehicleQueryPartitionResultStats, sleep, asyncChunks, MessageHandler, IMessageBus, IncomingMessageEnvelope } from 'core-lib';
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

    constructor(public config: Config, public event: VehicleQuery) {
        this.watch.start();
        this.fromDate = new Date(event.fromDate);
        this.toDate = new Date(event.toDate);
        if (this.fromDate.getTime() > this.toDate.getTime()) {
            throw new Error('fromDate must be less than toDate');
        }
        this.polygon = gpsCoordinatesToPolyon(event.polygon);
        this.timeout = event.timeout ?? this.config.finder.defaultTimeoutInMS;
        this.parallelize = event.parallelize ?? this.config.finder.parallelSearch;
        this.useChunking = event.useChunking ?? this.config.finder.useChunking;
    }

    hasTimedOut(): boolean {
        return this.watch.elapsedTimeInMS() >= this.timeout;
    }

    shouldAbort(): boolean {
        return this.timeoutExpired || this.limitReached;
    }

    checkIfLimitWasReached() {
        if (!this.limitReached && this.event.limit) {
            this.limitReached = this.selectedRecordCount >= this.event.limit;
        }
        return this.limitReached;
    }

    checkTimeout() {
        if (!this.timeoutExpired && !this.limitReached) {
            this.timeoutExpired = this.hasTimedOut();
        }
        return this.timeoutExpired;
    }
}

export class VehicleQueryHandler extends MessageHandler<VehicleQuery | VehicleQueryPartition | VehicleQueryPartitionResultStats> {
    subQueryResults = new Map<string, Map<string, VehicleQueryPartitionResultStats | null>>();

    constructor(
        private config: Config,
        private logger: Logger,
        private messageBus: IMessageBus,
        private repo: DataFrameRepository,
    ) {
        super();
    }

    get eventTypes(): string[] {
        return [
            'vehicle-query',
            'vehicle-query-partition',
            'vehicle-query-partition-result-stats',
        ]; 
    }

    async process(msg: IncomingMessageEnvelope<VehicleQuery | VehicleQueryPartition | VehicleQueryPartitionResultStats>): Promise<void> {
        const event = msg.body;
        if (event.type === 'vehicle-query') {
            return this.processQuery(event);
        }
        if (event.type === 'vehicle-query-partition') {
            return this.processQueryPartition(event);
        }
        if (event.type === 'vehicle-query-partition-result-stats') {
            return this.processQueryPartitionResultStats(event);
        }
        throw new Error(`Unexpected event type ${(event as any).type}`);
    }

    private async processQuery(event: VehicleQuery): Promise<void> {
            this.logger.debug('Received query', event);
        if (event.ttl && event.ttl < new Date().toISOString()) {
            this.logger.warn('Ignoring request because its TTL has been exceeded');
            return;
        }
        try {
            const ctx = new VehicleQueryContext(this.config, event);
            const geohashes = this.createGeohashes(ctx.polygon);
            if (ctx.parallelize && ctx.useChunking) {
                for await  (const filenames of asyncChunks(this.enumerateFiles(ctx.fromDate, ctx.toDate, geohashes), ctx.config.finder.instances)) {
                    for (const filename of filenames) {
                        await this.processFile(ctx, filename);
                        if (ctx.shouldAbort()) {
                            break;
                        }
                    }
                    await this.waitForSubQueries(ctx);
                    if (ctx.shouldAbort()) {
                        break;
                    }
                }    
            } else if (ctx.parallelize && !ctx.useChunking) {
                for await (const filename of this.enumerateFiles(ctx.fromDate, ctx.toDate, geohashes)) {
                    await this.processFile(ctx, filename);
                    if (ctx.shouldAbort()) {
                        break;
                    }
                }
                await this.waitForSubQueries(ctx);    
            } else { // serialize
                for await (const filename of this.enumerateFiles(ctx.fromDate, ctx.toDate, geohashes)) {
                    await this.processFile(ctx, filename);
                    if (ctx.shouldAbort()) {
                        break;
                    }
                }
            }

            ctx.watch.stop();
            const stats: VehicleQueryResultStats = {
                type: 'vehicle-query-result-stats',
                queryId: event.id,
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
            this.messageBus.publish(event.replyTo, stats);
        } finally {
            this.subQueryResults.delete(event.id);
        }
    }

    private async processQueryPartition(event: VehicleQueryPartition): Promise<void> {
        this.logger.debug('Received query partition', event);
        const ctx = new VehicleQueryContext(this.config, event.query);
        await this.executeProcessFile(ctx, event.filename, event.filesize);
        ctx.watch.stop();
        const stats: VehicleQueryPartitionResultStats = {
            type: 'vehicle-query-partition-result-stats',
            partitionQueryId: event.partitionQueryId,
            distinctVehicleIds: [...ctx.distinctVehicles],
            stats: {
                type: 'vehicle-query-result-stats',
                queryId: event.query.id,
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
        this.messageBus.publish(event.replyTo, stats);
    }

    private async processQueryPartitionResultStats(event: VehicleQueryPartitionResultStats): Promise<void> {
        const subQueries = this.subQueryResults.get(event.stats.queryId);
        if (subQueries && subQueries.get(event.partitionQueryId) === null) {
            subQueries.set(event.partitionQueryId, event);
        }
    }

    private async waitForSubQueries(ctx: VehicleQueryContext) {
        if (ctx.shouldAbort()) {
            return;
        }
        if (ctx.parallelize && this.subQueryResults.get(ctx.event.id)) {
            // wait for subquery results to come back
            let isDone = false;
            while (!isDone) {
                await sleep(5);
                const status = this.calcSubQueryStatus(ctx);
                isDone = status.isDone;
                if (ctx.shouldAbort()) {
                    isDone = true;
                }
            }
        }
    }
    
    private processFile(ctx: VehicleQueryContext, item: DataFrameDescriptor) {
        ctx.processedFilesCount += 1;
        if (ctx.parallelize) {
            return this.requestProcessFile(ctx, item);
        } else {
            return this.executeProcessFile(ctx, item.name, item.size);
        }
    }
    
    private async requestProcessFile(ctx: VehicleQueryContext, item: DataFrameDescriptor) {
        ctx.checkIfLimitWasReached();
        ctx.checkTimeout();
        if (ctx.shouldAbort()) {
            return;
        }
        const subQuery: VehicleQueryPartition = {
            type: 'vehicle-query-partition',
            query: {
                ...ctx.event,
                timeout: Math.max(500, ctx.timeout - ctx.watch.elapsedTimeInMS()),
                limit: ctx.event.limit ? ctx.event.limit - ctx.selectedRecordCount : undefined,
            },
            partitionQueryId: crypto.randomUUID(), 
            filename: item.name,
            filesize: item.size,
            replyTo: this.messageBus.privateInboxName,

        };
        let subQueries = this.subQueryResults.get(subQuery.query.id);
        if (!subQueries) {
            subQueries = new Map<string, VehicleQueryPartitionResultStats>();
            this.subQueryResults.set(subQuery.query.id, subQueries);
        }
        subQueries.set(subQuery.partitionQueryId, null);
        this.messageBus.publish('query.vehicles.partitions', subQuery);
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

    private calcSubQueryStatus(ctx: VehicleQueryContext) {
        let isDone = false;
        const subQueries = this.subQueryResults.get(ctx.event.id);
        if (subQueries) {
            const processedSubQueries: string[] = [];
            for (const [k, v] of subQueries) {
                if (v !== null) {
                    processedSubQueries.push(k);
                    ctx.selectedRecordCount += v.stats.selectedRecordCount;
                    ctx.processedBytes += v.stats.processedBytes;
                    ctx.processedFilesCount += v.stats.processedFilesCount;
                    ctx.processedRecordCount += v.stats.processedRecordCount;
                    for (const vehicleId of v.distinctVehicleIds) {
                        ctx.distinctVehicles.add(vehicleId);
                    }
                }
            }
            for (const k of processedSubQueries) {
                subQueries.delete(k);
            }
            if (subQueries.size === 0) {
                isDone = true;
            }
        }
        ctx.checkIfLimitWasReached();
        if (!isDone) {
            ctx.checkTimeout();
        }
        return { isDone };
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
                const isValidVehicle = ctx.event.vehicleTypes.length === 0 || ctx.event.vehicleTypes.includes(vehicleType);
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