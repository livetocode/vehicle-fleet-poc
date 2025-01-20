import { Config, VehicleQuery, Logger, dateToUtcParts, calcTimeWindow, VehicleQueryResultStats, VehicleQueryPartition, asyncChunks, IMessageBus, IncomingMessageEnvelope, RequestHandler, Request, RequestOptionsPair, RequestTimeoutError, isResponseSuccess, isVehicleQueryPartitionResultStats, VehicleQueryStartedEvent } from 'core-lib';
import path from 'path';
import { polygonToGeohashes } from "../core/geospatial.js";
import { Feature, Polygon } from "geojson";
import { DataFrameRepository, ListOptions, DataFrameDescriptor, stringToFormat } from "data-lib";
import { VehicleQueryContext } from './VehicleQueryContext.js';

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
        // TODO: keep this optimization or send to subject 'events.vehicles.query.started'
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
        // TODO: should we also publish a stop event such as 'events.vehicles.query.stopped'?

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
