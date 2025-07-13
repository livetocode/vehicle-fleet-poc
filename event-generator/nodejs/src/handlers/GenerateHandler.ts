import { ClearVehiclesDataRequest, Config, FlushRequest, GenerateResponse, RequestHandler, Logger, IMessageBus, IncomingMessageEnvelope, Request, RequestOptionsPair, VehicleGenerationStarted, GenerateRequest, Stopwatch, RequestCancelledError, RequestTimeoutError, isResponseSuccess, VehicleGenerationStopped, GeneratePartitionRequest, isClearVehiclesDataResponse, PrepareRequest, services, events, requests, DispatchFlushRequest, commands, DispatchFlushCommand } from "core-lib";


export class GenerateHandler extends RequestHandler<GenerateRequest, GenerateResponse> {

    constructor(
        private config: Config,
        private logger: Logger,
        private messageBus: IMessageBus,
    ) {
        super();
    }

    get description(): string {
        return `Coordinates the generation of the vehicle positions by partitioning the work into sub-generators`;
    }

    get messageTypes(): string[] {
        return ['generate-request'];
    }
    
    protected async processRequest(req: IncomingMessageEnvelope<Request<GenerateRequest>>): Promise<GenerateResponse> {
        const event = req.body.body;
        this.logger.info('Received event', event);
        // on start
        const startEvent: VehicleGenerationStarted = {
            type: 'vehicle-generation-started',
            timestamp: new Date().toISOString(),
        };
        const startedPath = events.vehicles.byTypeAndSubType.publish({ type: 'generation', subType: 'started'});
        await this.messageBus.publish(startedPath, startEvent);

        // prepare collectors
        const prepareReq: PrepareRequest = { type: 'prepare-request' };
        const prepareRequests: RequestOptionsPair<PrepareRequest>[] = [];
        for (let i = 0; i < this.config.collector.instances; i++) {
            prepareRequests.push([
                prepareReq, 
                {
                    path: services.collectors.assigned.publish({ index: i.toString(), rest: 'requests/prepare' }),
                    limit: 1,
                    timeout: 30000,
                },
            ]);
        }
        try {
            this.logger.info(`Preparing ${prepareRequests.length} collectors`);
            for await (const resp of this.messageBus.requestBatch(prepareRequests)) {
                if (isResponseSuccess(resp)) {
                    this.logger.debug('Received prepare response', resp.body);
                }
            }    
        } catch(err: any) {
            if (err instanceof RequestTimeoutError) {
                this.logger.debug('Prepare requests timed out', err);
            } else {
                throw err;
            }
        }

        // delete existing events
        const clearRequest: ClearVehiclesDataRequest = {
            type: 'clear-vehicles-data-request', 
        };
        const clearResponse = await this.messageBus.request(clearRequest, { 
            path: requests.vehicles.clear.publish({}),
            parentId: req.body.id,
            limit: 1,
        });
        if (clearResponse.body.type === 'response-success') {
            const body = clearResponse.body.body;
            if (isClearVehiclesDataResponse(body)) {
                if (!body.success) {
                    throw new Error('Collector could not clear the data!');
                }

            } else {
                throw new Error(`Unexpected response type ${body.type}`);
            }
        } else {
            throw new Error('Collector could not clear the data!');
        }
        this.logger.info('Existing data has been cleared by a collector.');
        if (req.shouldCancel) {
            throw new RequestCancelledError(req.body.id, `Cancellation requested for ID=${req.body.id}`);
        }

        // create partition requests
        const startDate = getStartDate(event, this.config.generator.startDate);

        const partitionRequests: RequestOptionsPair<GeneratePartitionRequest>[] = [];
        for (let i = 0; i < this.config.generator.instances; i++) {
            let maxNumberOfEvents = Math.trunc(event.maxNumberOfEvents / this.config.generator.instances);
            if (i === 0) {
                maxNumberOfEvents += event.maxNumberOfEvents % this.config.generator.instances;
            }
            partitionRequests.push([{
                type: 'generate-partition-request',
                maxNumberOfEvents,
                startDate,
                request: event,
            }, {
                path: services.generators.assigned.publish({ index: i.toString(), rest: 'partitions' }),
                parentId: req.body.id,
                limit: 1,
            }]);
        }
        // execute and wait for partition requests
        const watch = new Stopwatch();
        watch.start();
        for await (const resp of this.messageBus.requestBatch(partitionRequests)) {
            this.logger.info('Received partition result', resp.body);
        }
        
        // flush collectors
        if (req.body.body.sendFlush) {
            try {
                this.logger.info(`Flushing collectors`);
                if (req.body.body.useBackpressure) {
                    const flushReq: DispatchFlushRequest = { type: 'dispatch-flush-request' };
                    const resp = await this.messageBus.request(flushReq, {
                        path: commands.move.publish({}),
                        limit: 1,
                        timeout: 30000,

                    });
                    if (isResponseSuccess(resp)) {
                        this.logger.debug('Received flush response', resp.body);
                    }                    
                } else {
                    // If we're not applying back pressure, we can't wait for the flush requests to complete since they might timeout.
                    // So, we're using a basic fire and forget.
                    const flushCmd: DispatchFlushCommand = { type: 'dispatch-flush' };
                    await this.messageBus.publish(commands.move.publish({}), flushCmd);
                }
            } catch(err: any) {
                if (err instanceof RequestTimeoutError) {
                    this.logger.debug('Flush requests timed out', err);
                } else {
                    throw err;
                }
            }
        }

        watch.stop();
        this.logger.info('Generation is complete.');

        // on stop
        const stopEvent: VehicleGenerationStopped = {
            type: 'vehicle-generation-stopped',
            success: true,
            timestamp: new Date().toISOString(),
            elapsedTimeInMS: watch.elapsedTimeInMS(),
        }
        this.logger.debug('sending stop event', stopEvent);
        const stoppedPath = events.vehicles.byTypeAndSubType.publish({ type: 'generation', subType: 'stopped'});
        await this.messageBus.publish(stoppedPath, stopEvent);

        // send response stats
        return {
            type: 'generate-response',
            elapsedTimeInMS: watch.elapsedTimeInMS(),
        };
    }
}

function getStartDate(event: GenerateRequest, defaultStartDate?: string): string {
    if (event.realtime) {
        return new Date().toISOString();
    }
    const startDate = event.startDate ?? defaultStartDate;
    if (startDate) {
        return new Date(startDate).toISOString();
    }
    const offsetInMS = (event.maxNumberOfEvents / event.vehicleCount) * event.refreshIntervalInSecs * 1000;
    const now = new Date();
    return new Date(now.getTime() - offsetInMS).toISOString();
}
