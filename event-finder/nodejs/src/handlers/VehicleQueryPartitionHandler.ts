import { Counter } from "messaging-lib";
import { Config, Logger, VehicleQueryResult, VehicleQueryPartitionRequest, VehicleQueryPartitionResponse, IMessageBus, IncomingMessageEnvelope, RequestHandler, Request, asyncChunks, MessageOptionsPair } from 'core-lib';
import * as turf from '@turf/turf';
import { DataFrameRepository } from "data-lib";
import { VehicleQueryContext } from "./VehicleQueryContext.js";


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

export class VehicleQueryPartitionHandler extends RequestHandler<VehicleQueryPartitionRequest, VehicleQueryPartitionResponse> {
    constructor(
        private config: Config,
        private logger: Logger,
        private messageBus: IMessageBus,
        private repo: DataFrameRepository,
    ) {
        super();
    }

    get description(): string {
        return `This is a search agent that will search vehicle positions for its assigned partitions`;
    }

    get messageTypes(): string[] {
        return ['vehicle-query-partition-request'];
    }

    async execute(req: IncomingMessageEnvelope<Request<VehicleQueryPartitionRequest>>): Promise<VehicleQueryPartitionResponse> {
        return this.processRequest(req);
    }

    protected async processRequest(req: IncomingMessageEnvelope<Request<VehicleQueryPartitionRequest>>): Promise<VehicleQueryPartitionResponse> {
        const event = req.body.body;
        this.logger.debug('Received query partition', event);
        const ctx = new VehicleQueryContext(this.config, event.query);
        await this.executeProcessFile(ctx, event.filename, event.filesize);
        ctx.watch.stop();
        const stats: VehicleQueryPartitionResponse = {
            type: 'vehicle-query-partition-response',
            distinctVehicleIds: [...ctx.distinctVehicles],
            partialResponse: {
                type: 'vehicle-query-response',
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
        for await (const chunk of asyncChunks(this.searchFile(ctx, filename, filesize), this.config.finder.messageChunkSize)) {
            const messageBatch: MessageOptionsPair[] = [];
            let done = false;
            for (const res of chunk) {
                messageBatch.push([res, { subject: ctx.event.replyTo }]);
                ctx.selectedRecordCount += 1;
                ctx.distinctVehicles.add(res.vehicleId);
                if (ctx.checkIfLimitWasReached() || ctx.checkTimeout()) {
                    done = true;
                    break;
                }
            }
            await this.messageBus.publishBatch(messageBatch);
            if (done) {
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
                const isInsidePolygon = turf.pointsWithinPolygon(pos, ctx.geometry).features.length > 0;
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