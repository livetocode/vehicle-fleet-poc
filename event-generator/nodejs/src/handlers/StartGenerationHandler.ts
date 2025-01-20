import { ClearVehiclesData, ClearVehiclesDataResult, Config, FlushRequest, GeneratePartitionCommand, GenerationStats, RequestHandler, Logger, IMessageBus, IncomingMessageEnvelope, Request, RequestOptionsPair, VehicleGenerationStarted, StartGenerationCommand, Stopwatch, RequestCancelledError, isResponse, RequestTimeoutError, isResponseSuccess, VehicleGenerationStopped } from "core-lib";


export class StartGenerationHandler extends RequestHandler<StartGenerationCommand, GenerationStats> {

    constructor(
        private config: Config,
        private logger: Logger,
        private messageBus: IMessageBus,
    ) {
        super();
    }

    get messageTypes(): string[] {
        return ['start-generation'];
    }
    
    protected async processRequest(req: IncomingMessageEnvelope<Request<StartGenerationCommand>>): Promise<GenerationStats> {
        const event = req.body.body;
        this.logger.info('Received event', event);
        // on start
        const startEvent: VehicleGenerationStarted = {
            type: 'vehicle-generation-started',
            timestamp: new Date().toISOString(),
        }
        this.messageBus.publish(`events.vehicles.generation.started`, startEvent);

        // delete existing events
        const clearRequest: ClearVehiclesData = {
            type: 'clear-vehicles-data', 
        };
        const clearResponse = await this.messageBus.request(clearRequest, { 
            subject: `requests.collector`,
            parentId: req.body.id,
            limit: 1,
        });
        if (clearResponse.body.type === 'response-success') {
            if (clearResponse.body.body.type === 'clear-vehicles-data-result') {
                const clearResponseBody: ClearVehiclesDataResult = clearResponse.body.body as any;
                if (!clearResponseBody.success) {
                    throw new Error('Collector could not clear the data!');
                }
            } else {
                throw new Error(`Unexpected response type ${clearResponse.body.body.type}`);
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

        const partitionRequests: RequestOptionsPair<GeneratePartitionCommand>[] = [];
        for (let i = 0; i < this.config.generator.instances; i++) {
            let maxNumberOfEvents = Math.trunc(event.maxNumberOfEvents / this.config.generator.instances);
            if (i === 0) {
                maxNumberOfEvents += event.maxNumberOfEvents % this.config.generator.instances;
            }
            partitionRequests.push([{
                type: 'generate-partition',
                maxNumberOfEvents,
                startDate,
                request: event,
            }, {
                subject: `generation.agent.${i}`,
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
        const flushReq: FlushRequest = { type: 'flush-request' };
        const flushRequests: RequestOptionsPair<FlushRequest>[] = [];
        for (let i = 0; i < this.config.collector.instances; i++) {
            flushRequests.push([
                flushReq, 
                {
                    subject: `commands.flush.${i}`,
                    limit: 1,
                    timeout: 30000,
                },
            ]);
        }
        try {
            this.logger.info(`Flushing ${flushRequests.length} collectors`);
            for await (const resp of this.messageBus.requestBatch(flushRequests)) {
                if (isResponseSuccess(resp)) {
                    this.logger.debug('Received flush response', resp.body);
                }
            }    
        } catch(err: any) {
            if (err instanceof RequestTimeoutError) {
                this.logger.debug('Flush requests timed out', err);
            } else {
                throw err;
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
        this.messageBus.publish(`events.vehicles.generation.stopped`, stopEvent);

        // send response stats
        return {
            type: 'generation-stats',
            elapsedTimeInMS: watch.elapsedTimeInMS(),
        };
    }
}

function getStartDate(event: StartGenerationCommand, defaultStartDate?: string): string {
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
