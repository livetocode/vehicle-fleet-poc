import { Config, VehicleQueryRequest, Logger, dateToUtcParts, calcTimeWindow, VehicleQueryResponse, VehicleQueryPartitionRequest, asyncChunks, IMessageBus, IncomingMessageEnvelope, RequestHandler, Request, RequestOptionsPair, RequestTimeoutError, isResponseSuccess, isVehicleQueryPartitionResponse, VehicleQueryStartedEvent, VehicleQueryStoppedEvent } from 'core-lib';
import path from 'path';
import { polygonToGeohashes } from "../core/geospatial.js";
import { Feature, Polygon } from "geojson";
import { DataFrameRepository, ListOptions, DataFrameDescriptor, stringToFormat } from "data-lib";
import { VehicleQueryContext } from './VehicleQueryContext.js';
import { VehicleQueryPartitionHandler } from './VehicleQueryPartitionHandler.js';

export class VehicleQueryHandler extends RequestHandler<VehicleQueryRequest, VehicleQueryResponse> {

    constructor(
        private config: Config,
        private logger: Logger,
        private messageBus: IMessageBus,
        private repo: DataFrameRepository,
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
        this.messageBus.publish(req.body.replyTo, startingEvent);
        const ctx = new VehicleQueryContext(this.config, req.body);
        const geohashes = this.createGeohashes(ctx.polygon);
        if (ctx.parallelize) {
            if (ctx.useChunking) {
                await this.parallelSearchWithChunking(ctx, geohashes);
            } else {
                await this.parallelSearchWithoutChunking(ctx, geohashes);
            }     
        } else {
            await this.linearSearch(ctx, geohashes);
        }

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
            response: response,            
        }
        this.messageBus.publish('events.vehicles.query.stopped', stoppedEvent);
        return response;
    }

    private async parallelSearchWithChunking(ctx: VehicleQueryContext, geohashes: Set<string>) {
        for await  (const filenames of asyncChunks(this.enumerateFiles(ctx.fromDate, ctx.toDate, geohashes), ctx.config.finder.instances)) {
            const subRequests: RequestOptionsPair<VehicleQueryPartitionRequest>[] = []; 
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
                        if (isVehicleQueryPartitionResponse(resp.body.body)) {
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

    private async parallelSearchWithoutChunking(ctx: VehicleQueryContext, geohashes: Set<string>) {
        const subRequests: RequestOptionsPair<VehicleQueryPartitionRequest>[] = []; 
        for await (const filename of this.enumerateFiles(ctx.fromDate, ctx.toDate, geohashes)) {
            const subRequest = this.createProcessFileRequest(ctx, filename);
            if (subRequest) {
                subRequests.push(subRequest);
            }
            if (ctx.shouldAbort()) {
                break;
            }
        }
        try {
            for await (const resp of this.messageBus.requestBatch(subRequests)) {
                this.logger.debug('Received sub-request response', resp.body);
                if (isResponseSuccess(resp)) {
                    if (isVehicleQueryPartitionResponse(resp.body.body)) {
                        ctx.processSubQueryResponse(resp.body.body);
                    }
                }
                if (ctx.shouldAbort()) {
                    break;
                }
            }    
        } catch(err: any) {
            if (err instanceof RequestTimeoutError) {
                this.logger.debug('Some sub-requests timed out', err);
            } else {
                throw err;
            }
        }

    }
    
    private async linearSearch(ctx: VehicleQueryContext, geohashes: Set<string>) {
        const partitionHandler = new VehicleQueryPartitionHandler(this.config, this.logger, this.messageBus, this.repo);
        for await (const filename of this.enumerateFiles(ctx.fromDate, ctx.toDate, geohashes)) {
            const subRequest = this.createProcessFileRequest(ctx, filename);
            if (subRequest) {
                const req: IncomingMessageEnvelope<Request<VehicleQueryPartitionRequest>> = {
                    subject: '@local',
                    headers: {},
                    body: {
                        id: '@1',
                        type: 'request',
                        replyTo: '@local',
                        body: subRequest[0],
                    },
                    reply() {
                        throw new Error('Not implemented');
                    },
                }
                const resp = await partitionHandler.execute(req);
                this.logger.debug('Received sub-request response', resp);
                ctx.processSubQueryResponse(resp);
            }
            if (ctx.shouldAbort()) {
                break;
            }
        }        
    }

    private createProcessFileRequest(ctx: VehicleQueryContext, item: DataFrameDescriptor): RequestOptionsPair<VehicleQueryPartitionRequest> | undefined {
        ctx.checkIfLimitWasReached();
        ctx.checkTimeout();
        if (ctx.shouldAbort()) {
            return undefined;
        }
        ctx.processedFilesCount += 1;
        const subQuery: VehicleQueryPartitionRequest = {
            type: 'vehicle-query-partition-request',
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
                subject: 'services.finder.any.partitions',
                parentId: ctx.event.id,
                timeout: ctx.timeout,
            }
        ];
    }

    private createGeohashes(polygon: Feature<Polygon>): Set<string> {
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
