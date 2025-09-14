import { type Config, type VehicleQueryRequest, type Logger, type VehicleQueryResponse, type IMessageBus, type IncomingMessageEnvelope, RequestHandler, type Request, type VehicleQueryStartedEvent, type VehicleQueryStoppedEvent, MessagePath, events, ResponseError, randomUUID } from 'core-lib';
import { extractPolygons, polygonsToGeohashes } from "../core/geospatial.js";
import { Feature, GeoJsonProperties, MultiPolygon } from "geojson";
import { VehicleQueryContext } from './VehicleQueryContext.js';
import { VehicleQueryStrategy } from './VehicleQueryStrategy.js';

export class VehicleQueryHandler extends RequestHandler<VehicleQueryRequest, VehicleQueryResponse> {

    constructor(
        private config: Config,
        private logger: Logger,
        private messageBus: IMessageBus,
        private strategy: VehicleQueryStrategy,
    ) {
        super();
    }

    get description(): string {
        return `Coordinates the search of vehicle positions by partitioning the work across multiple search agents, using the configured partition key.`;
    }

    get messageTypes(): string[] {
        return [
            'vehicle-query-request',
        ]; 
    }

    protected async processRequest(req: IncomingMessageEnvelope<Request<VehicleQueryRequest>>): Promise<VehicleQueryResponse> {
        const event = req.body.body;
        this.logger.debug('Received query', event);
        const startingEvent: VehicleQueryStartedEvent = {
            type: 'vehicle-query-started',
            query: req.body,
        };
        // Send it to our inbox to let the viewer display the polygon shape and clear the data
        // TODO: keep this optimization or send to subject 'events.vehicles.query.started'?
        // Warning: the viewer assumes it is the only one to receive this start event.
        await this.messageBus.publish(MessagePath.fromReplyTo(req.body.replyTo), startingEvent);
        try {
            const ctx = new VehicleQueryContext(this.config, req.body);
            const geohashes = this.createGeohashes(ctx.geometry);
            
            await this.strategy.execute(ctx, geohashes);

            ctx.watch.stop();

            const response: VehicleQueryResponse = {
                type: 'vehicle-query-response',
                elapsedTimeInMS: ctx.watch.elapsedTimeInMS(),
                processedFilesCount: ctx.processedFilesCount,
                processedBytes: ctx.processedBytes,
                processedRecordCount: ctx.processedRecordCount,
                selectedRecordCount: ctx.selectedRecordCount,
                distinctVehicleCount: ctx.distinctVehicles.size,
                timeoutExpired: ctx.timeoutExpired,
                limitReached: ctx.limitReached,
            };
            this.logger.debug('Stats', response);
            const stoppedEvent: VehicleQueryStoppedEvent = {
                type: 'vehicle-query-stopped',
                query: req.body,
                isSuccess: true,
                response: response,
            };
            const path = events.vehicles.byTypeAndSubType.publish({ type: 'query', subType: 'stopped'});
            await this.messageBus.publish(path, stoppedEvent);
            return response;
        } catch(err: any) {
            this.logger.error('Error during query', err);
            const stoppedEvent: VehicleQueryStoppedEvent = {
                type: 'vehicle-query-stopped',
                query: req.body,
                isSuccess: false,
                error: err.toString(),     
            };
            const path = events.vehicles.byTypeAndSubType.publish({ type: 'query', subType: 'stopped'});
            await this.messageBus.publish(path, stoppedEvent);

            throw err;
        }
    }


    private createGeohashes(feature: Feature<MultiPolygon, GeoJsonProperties>): Set<string> {
        if (this.config.partitioning.dataPartition.type === 'geohash') {
            const polygons = extractPolygons(feature);
            return polygonsToGeohashes(polygons, this.config.partitioning.dataPartition.hashLength, false);
        }
        return new Set<string>();
    }
}
