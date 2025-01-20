import { Counter } from "messaging-lib";
import { Config, Logger, VehicleQueryResult, VehicleQueryPartition, VehicleQueryPartitionResultStats, IMessageBus, IncomingMessageEnvelope, RequestHandler, Request } from 'core-lib';
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