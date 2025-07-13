import { FlushRequest, IncomingMessageEnvelope, Logger, MessageHandler, Request, RequestHandler, FlushCommand, DispatchFlushRequest, DispatchFlushResponse, DispatchFlushCommand, IMessageBus, services, isResponseSuccess, RequestOptionsPair, Config, MessageOptionsPair } from "core-lib";

export class DispatchFlushRequestHandler extends RequestHandler<DispatchFlushRequest, DispatchFlushResponse> {

    constructor(
        private logger: Logger,
        private messageBus: IMessageBus,
        private config: Config,
    ) {
        super();
    }

    get description(): string {
        return `Dispatches a flush command to the assigned collectors (request/reply)`;
    }

    get messageTypes(): string[] {
        return ['dispatch-flush-request'];
    }

    protected async processRequest(req: IncomingMessageEnvelope<Request<DispatchFlushRequest>>): Promise<DispatchFlushResponse> {
        this.logger.warn('Dispatch flush request');
        const flushReq: FlushRequest = {
            type: 'flush-request',
        }
        try {
            const flushRequests: RequestOptionsPair<FlushRequest>[] = [];
            for (let i = 0; i < this.config.collector.instances; i++) {
                flushRequests.push([
                    flushReq, 
                    {
                        path: services.collectors.assigned.publish({ index: i.toString(), rest: 'commands/flush' }),
                        limit: 1,
                        timeout: 30000,
                    },
                ]);

            }
            for await (const resp of this.messageBus.requestBatch(flushRequests)) {
                if (isResponseSuccess(resp)) {
                    this.logger.debug('Received flush response', resp.body);
                }
            }
        } catch(err: any) {
            this.logger.error(`wait for flush-request failed: ${err}`);
        }
        return { type: 'dispatch-flush-response' };
    }
}

export class DispatchFlushDataHandler extends MessageHandler<DispatchFlushCommand> {

    constructor(
        private logger: Logger,
        private messageBus: IMessageBus,
        private config: Config,
    ) {
        super();
    }

    get description(): string {
        return `Dispatches a flush command to the assigned collectors. (fire and forget command)`;
    }

    get messageTypes(): string[] {
        return ['dispatch-flush'];
    }

    public async process(req: IncomingMessageEnvelope<DispatchFlushCommand>): Promise<void> {
        this.logger.warn('dispatch flush');
        const flushCmd: FlushCommand = {
            type: 'flush',
        }
        try {
            const flushCommands: MessageOptionsPair<FlushCommand>[] = [];
            for (let i = 0; i < this.config.collector.instances; i++) {
                flushCommands.push([
                    flushCmd, 
                    {
                        path: services.collectors.assigned.publish({ index: i.toString(), rest: 'commands/flush' }),
                    },
                ]);

            }        
            await this.messageBus.publishBatch(flushCommands)
        } catch(err: any) {
            this.logger.error(`send flush commands failed: ${err}`);
        }
    }
}
