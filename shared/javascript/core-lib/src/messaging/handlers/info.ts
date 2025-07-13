import { Logger } from "../../logger.js";
import { RequestHandler } from "../RequestHandler.js";
import { IncomingMessageEnvelope } from "../MessageEnvelopes.js";
import { isResponseSuccess, Request, RequestTimeoutError } from "../Requests.js";
import { ServiceIdentity } from "../ServiceIdentity.js";
import { IMessageBus } from "../IMessageBus.js";
import { MessageSubscriptions } from "../MessageSubscriptions.js";
import { MessageHandlerRegistry } from "../MessageHandlerRegistry.js";
import { MessageRoute, MessageRoutes } from "../MessageRoutes.js";
import { MessagePath, PathSegment } from "../MessagePath.js";

export type InfoOptions = {
    serviceName?: string;
    timeout?: number;
}

export type InfoRequest = {
    type: 'info-request';
    serviceName?: string;
};

export type MessageHandlerInfo = {
    name: string;
    messageTypes: string[];
    description: string;
}

export type ExportedMessageSubscription = {
    type: string;
    path: {
        segments: PathSegment[];
        vars: Record<string, string>;
    }    
}

export type InfoResponse = {
    type: 'info-response';
    identity: ServiceIdentity;
    subscriptions: ExportedMessageSubscription[],
    handlers: MessageHandlerInfo[],
    routes: MessageRoute[],
};

function isInfoResponse(resp: any) : resp is InfoResponse {
    return resp.type === 'info-response';
}

export class InfoRequestHandler extends RequestHandler<InfoRequest, InfoResponse> {
    
    constructor(
        private logger: Logger,
        private identity: ServiceIdentity,
        private subscriptions: MessageSubscriptions,
        private registry: MessageHandlerRegistry,
        private messageRoutes: MessageRoutes,
    ) {
        super();
    }

    get name(): string {
        return 'InfoRequestHandler';
    }

    get description(): string {
        return `Returns information about the message types and the subscriptions`;
    }

    get messageTypes(): string[] {
        return ['info-request'];
    }

    protected async processRequest(req: IncomingMessageEnvelope<Request<InfoRequest>>): Promise<InfoResponse> {
        this.logger.debug('Sending info response...');
        return {
            type: 'info-response',
            identity: this.identity,
            subscriptions: this.subscriptions.entries().map(x => ({ 
                type: x.type, 
                path: {
                    segments: x.path.segments,
                    vars: x.path.vars,
                }})),
            handlers: this.registry.handlers().map(x => ({
                name: x.name,
                messageTypes: x.messageTypes,
                description: x.description,
            })),
            routes: this.messageRoutes.routes
        }
    }
}

export class InfoService {
    private handler: InfoRequestHandler;
    private globalPath: MessagePath;
    private specificPath: MessagePath;

    constructor(
        private messageBus: IMessageBus,
        private logger: Logger,
        identity: ServiceIdentity,
        subscriptions: MessageSubscriptions,
        registry: MessageHandlerRegistry,
        routes: MessageRoutes,
    ) {
        this.handler = new InfoRequestHandler(logger, identity, subscriptions, registry, routes);
        this.messageBus.registerHandlers(this.handler);
        this.globalPath = MessagePath.fromPath('messaging/control');
        this.specificPath = MessagePath.fromPath('messaging/control/{name(required)}');
        this.messageBus.subscribe({ type: 'topic', path: this.globalPath.subscribe({}) });
        this.messageBus.subscribe({ type: 'topic', path: this.specificPath.subscribe({ name: identity.name })});
}

    async *info(options?: InfoOptions): AsyncGenerator<InfoResponse> {
        const serviceName = options?.serviceName;
        const req: InfoRequest = {
            type: 'info-request',
            serviceName: serviceName,
        };
        try {
            this.logger.debug('Sending info request...');

            for await (const resp of this.messageBus.requestMany(req, {
                path: serviceName ? this.specificPath.publish({ name: serviceName }) : this.globalPath.publish({}),
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