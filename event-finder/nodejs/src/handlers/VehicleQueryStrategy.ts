import path from 'path';
import { type Config, type Logger, dateToUtcParts, nameDateParts, calcTimeWindow, type VehicleQueryPartitionRequest, asyncChunks, type IMessageBus, type IncomingMessageEnvelope, type Request, type RequestOptionsPair, RequestTimeoutError, isResponseSuccess, isVehicleQueryPartitionResponse, MessagePath, services, singleQuote, MessageOptionsPair, generateTimePrefixes } from 'core-lib';
import { DataFrameRepository, ListOptions, DataFrameDescriptor, stringToFormat } from "data-lib";
import { tryMapToResult, VehicleQueryPartitionHandler } from './VehicleQueryPartitionHandler.js';
import sql, { ConnectionPool } from 'mssql';
import { VehicleQueryContext } from './VehicleQueryContext.js';

export interface VehicleQueryStrategy {
    execute(ctx: VehicleQueryContext, geohashes: Set<string>): Promise<void>;
}

export class VehicleQueryDataFrameRepositoryStrategy implements VehicleQueryStrategy {
    constructor(
        private config: Config,
        private logger: Logger,
        private messageBus: IMessageBus,
        private repo: DataFrameRepository,
    ) {}

    async execute(ctx: VehicleQueryContext, geohashes: Set<string>): Promise<void> {
        if (ctx.parallelize) {
            if (ctx.useChunking) {
                await this.parallelSearchWithChunking(ctx, geohashes);
            } else {
                await this.parallelSearchWithoutChunking(ctx, geohashes);
            }     
        } else {
            await this.linearSearch(ctx, geohashes);
        }
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
                    subscribedSubject: '@local',
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
                path: services.finders.any.publish({ rest: 'partitions'}),
                parentId: ctx.event.id,
                timeout: ctx.timeout,
            }
        ];
    }    

    private async *enumerateFiles(fromDate: Date, toDate: Date, geohashes: Set<string>) {
        const flatLayout = this.config.collector.output.flatLayout;
        const format = stringToFormat(this.config.finder.dataFormat);
        const periodInMin = this.config.partitioning.timePartition.aggregationPeriodInMin;
        const fromPrefix = calcTimeWindow(fromDate, periodInMin).toString();
        const toRange = calcTimeWindow(toDate, periodInMin);
        const toPrefix = dateToUtcParts(toRange.untilTime).join('-');
        const listOptions: ListOptions = {
            fromPrefix,
            toPrefix,
            format,
        };
        if (flatLayout) {
            const prefixes: string[] = [];
            for (const prefix of generateTimePrefixes(fromDate, toDate, periodInMin)) {
                prefixes.push(prefix.join('-'));
            }
            listOptions.prefixes = prefixes;
            this.logger.debug(`Using prefixes: ${prefixes.join(', ')}`);
            for await (const item of this.repo.list(listOptions)) {
                const segments = path.basename(item.name).split('-');
                const fileGeohash = segments[5];
                if (geohashes.has(fileGeohash)) {
                    yield item;
                }
            }
        } else {
            for (const prefix of generateTimePrefixes(fromDate, toDate, periodInMin)) {
                this.logger.debug(`Processing time prefix: ${prefix.join('-')}`);
                const namedPrefix = nameDateParts(prefix).map(x => `${x[0]}=${x[1]}`);
                listOptions.subFolder = namedPrefix.reduce((a, b) => path.join(a, b), '');
                if (!listOptions.subFolder.endsWith('/')) {
                    listOptions.subFolder += '/';
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
    }
}

export class VehicleQueryAzureSqlStrategy implements VehicleQueryStrategy {
    private pool?: ConnectionPool;

    constructor(
        private config: Config,
        private logger: Logger,
        private messageBus: IMessageBus,
    ) {}

    async execute(ctx: VehicleQueryContext, geohashes: Set<string>): Promise<void> {

        if (!this.pool) {
            if (this.config.finder.dataSource.type === 'azureSql') {
                this.logger.info('Starting Sql Server pool...');
                this.pool = await sql.connect(this.config.finder.dataSource.connection);
            } else {
                throw new Error('Expected to have the right config for Azure SQL');
            }
        }
        for await (const chunk of asyncChunks(this.searchDatabase(ctx, geohashes, this.pool), this.config.finder.messageChunkSize)) {
            const messageBatch: MessageOptionsPair[] = [];
            let done = false;
            for (const res of chunk) {
                messageBatch.push([res, { path: MessagePath.fromReplyTo(ctx.event.replyTo) }]);
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

    async *searchDatabase(ctx: VehicleQueryContext, geohashes: Set<string>, poolConnection: ConnectionPool) {
        const isFlat = this.config.collector.output.flatLayout;
        const aggregationPeriodInMin = this.config.partitioning.timePartition.aggregationPeriodInMin;
        for (const prefix of generateTimePrefixes(ctx.fromDate, ctx.toDate, aggregationPeriodInMin)) {
            this.logger.debug(`Using prefix: ${prefix.join('-')}`);
            const commonRoots = prefix;
            let bulkParts: { name: string; value?: string; values?: string[]; tagsOnly?: boolean; }[] = [
                { name: 'y',  value: prefix[0], },
                { name: 'm', value: prefix[1], },
                { name: 'd',   value: prefix[2], },
                { name: 'hh',  value: prefix[3], },
                { name: 'mm', value: prefix[4], },
                { name: 'start', tagsOnly: true, },
                { name: 'int', tagsOnly: true, },
                { name: 'pk', values: [...geohashes], },
            ];
            if (isFlat) {
                bulkParts = bulkParts.filter(x => x.tagsOnly !== true );
            }
            for (let i = 0; i < commonRoots.length; i++) {
                bulkParts[i].value = commonRoots[i];
            }
            const filters: string[] = [];
            let idx = 0;
            for (const bulkPart of bulkParts) {
                if (bulkPart.values && bulkPart.values.length === 1) {
                    bulkPart.value = bulkPart.values[0];
                    bulkPart.values = undefined;
                }
                if (bulkPart.value === undefined) {
                    idx++;
                }
                if (bulkPart.values && bulkPart.values.length > 0) {
                    const valuesAsText = bulkPart.values.map(singleQuote).join(',');
                    filters.push(`ev.filepath(${idx}) in (${valuesAsText})`);
                }
            }
            if (isFlat) {
                filters.push('ev.filename() >= @filenameStart');
                filters.push('ev.filename() < @filenameEnd');
            }
            filters.push('ev.timestamp >= @fromDate');
            filters.push('ev.timestamp < @toDate');
            const bulk = isFlat ?
                bulkParts.map(x => x.value ?? '*').join('-') + '-*.parquet' :
                bulkParts.map(x => `${x.name}=${x.value ?? '*'}`).join('/') + '/*.parquet';
            const query = `
            SELECT ev.*
            FROM
                OPENROWSET(
                    BULK '${bulk}',
                    DATA_SOURCE = 'VehicleEvents',
                    FORMAT='PARQUET'
                ) AS ev
            WHERE
                ${filters.join(' AND\n')}
            ORDER BY
                ev.timestamp
            `;
            this.logger.debug('Sql query', query);

            const req = poolConnection.request();
            const stream = req.toReadableStream();

            req.input('fromDate', ctx.fromDate);
            req.input('toDate', ctx.toDate);
            if (isFlat) {
                const fromRange = calcTimeWindow(ctx.fromDate, this.config.partitioning.timePartition.aggregationPeriodInMin);
                const fromPrefix = dateToUtcParts(fromRange.fromTime).join('-');
                const toRange = calcTimeWindow(ctx.toDate, this.config.partitioning.timePartition.aggregationPeriodInMin);
                const toPrefix = dateToUtcParts(toRange.untilTime).join('-');
                req.input('filenameStart', fromPrefix);
                req.input('filenameEnd', toPrefix);
            }
            try {
                req.query(query);
                for await (const row of stream) {
                    const ev = tryMapToResult(ctx, row);
                    if (ev) {
                        yield ev;
                    }
                }        
            } catch(err: any) {
                if (err.number === 13807) {
                    // Example: Content of directory on path 'y=2024/m=01/d=01/hh=07/mm=00/start=*/int=*/pk=*/*.parquet' cannot be listed.
                    this.logger.warn(`No files found for this bulk: ${bulk}`);
                } else {
                    throw err;
                }
            }
        }
    }
}
