import { Logger } from "../../logger.js";
import { RequestHandler } from "../RequestHandler.js";
import { IncomingMessageEnvelope } from "../MessageEnvelopes.js";
import { isResponseSuccess, Request, RequestTimeoutError } from "../Requests.js";
import { ServiceIdentity } from "../ServiceIdentity.js";
import { IMessageBus } from "../IMessageBus.js";
import { MessageSubscription, MessageSubscriptions } from "../MessageSubscriptions.js";
import { MessageHandlerRegistry } from "../MessageHandlerRegistry.js";

export type InfoOptions = {
    serviceName?: string;
    timeout?: number;
}

export type InfoRequest = {
    type: 'info-req';
    serviceName?: string;
};

export type MessageHandlerInfo = {
    name: string;
    messageTypes: string[];
    description?: string;
}

export type InfoResponse = {
    type: 'info-resp';
    identity: ServiceIdentity;
    subscriptions: MessageSubscription[],
    handlers: MessageHandlerInfo[],
};

function isInfoResponse(resp: any) : resp is InfoResponse {
    return resp.type === 'info-resp';
}

export class InfoRequestHandler extends RequestHandler<InfoRequest, InfoResponse> {
    
    constructor(
        private logger: Logger,
        private identity: ServiceIdentity,
        private subscriptions: MessageSubscriptions,
        private registry: MessageHandlerRegistry,
    ) {
        super();
    }

    get messageTypes(): string[] {
        return ['info-req'];
    }

    protected async processRequest(req: IncomingMessageEnvelope<Request<InfoRequest>>): Promise<InfoResponse> {
        this.logger.debug('Sending info response...');
        return {
            type: 'info-resp',
            identity: this.identity,
            subscriptions: this.subscriptions.entries(),
            handlers: this.registry.handlers().map(x => ({
                name: x.constructor.name,
                messageTypes: x.messageTypes,
            })),
        }
    }
}

export class InfoService {
    private handler: InfoRequestHandler;

    constructor(
        private messageBus: IMessageBus,
        private logger: Logger,
        identity: ServiceIdentity,
        subscriptions: MessageSubscriptions,
        registry: MessageHandlerRegistry,
    ) {
        this.handler = new InfoRequestHandler(logger, identity, subscriptions, registry);
        this.messageBus.registerHandlers(this.handler);
        this.messageBus.subscribe('messaging.control.*');
}

    async *info(options?: InfoOptions): AsyncGenerator<InfoResponse> {
        const serviceName = options?.serviceName;
        const req: InfoRequest = {
            type: 'info-req',
            serviceName: serviceName,
        };
        try {
            this.logger.debug('Sending info request...');

            for await (const resp of this.messageBus.requestMany(req, {
                subject: serviceName ? `messaging.control.info.${serviceName}` : 'messaging.control.info',
                timeout: options?.timeout ?? 3*1000,
                limit: 1000,
            })) {
                this.logger.debug('Received info response', resp.body);
                if (isResponseSuccess(resp)) {
                    if (isInfoResponse(resp.body.body)) {
                        yield resp.body.body;
                    }
                }
            }
        } catch(err) {
            if (err instanceof RequestTimeoutError) {
                this.logger.trace("Info timed out");
            } else {
                throw err;
            }
        }
    }
}