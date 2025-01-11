import { ClearVehiclesData, ClearVehiclesDataResult, Config, FlushCommand, GeneratePartitionCommand, GenerationStats, RequestHandler, Logger, IMessageBus, IncomingMessageEnvelope, Request, RequestOptionsPair, ResetAggregatePeriodStats, StartGenerationCommand, Stopwatch, RequestCancelledError } from "core-lib";


export class StartGenerationHandler extends RequestHandler<StartGenerationCommand, GenerationStats> {

    constructor(
        private config: Config,
        private logger: Logger,
        private messageBus: IMessageBus,
    ) {
        super();
    }

    get eventTypes(): string[] {
        return ['start-generation'];
    }
    
    protected async processRequest(req: IncomingMessageEnvelope<Request<StartGenerationCommand>>): Promise<GenerationStats> {
        const event = req.body.body;
        this.logger.info('Received event', event);
        // reset stats
        this.messageBus.publish(`stats`, { type: 'reset-aggregate-period-stats' } as ResetAggregatePeriodStats);

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
                const clearResponseBody: ClearVehiclesDataResult = clearResponse.body.body;
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
        const flushCmd: FlushCommand = {
            type: 'flush',
            exitProcess: false,
        }
        for (let i = 0; i < this.config.collector.instances; i++) {
            this.logger.info(`Flushing collector #${i}`);
            this.messageBus.publish(`commands.flush.${i}`, flushCmd);
        }

        watch.stop();
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
