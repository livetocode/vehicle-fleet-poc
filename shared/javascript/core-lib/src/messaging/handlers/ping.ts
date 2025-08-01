import { Logger } from "../../logger.js";
import { RequestHandler } from "../RequestHandler.js";
import { IncomingMessageEnvelope } from "../MessageEnvelopes.js";
import { isResponseSuccess, Request, RequestTimeoutError } from "../Requests.js";
import { ServiceIdentity } from "../ServiceIdentity.js";
import { IMessageBus } from "../IMessageBus.js";
import { MessagePath } from "../MessagePath.js";

export type PingOptions = {
    serviceName?: string;
    timeout?: number;
}

export type PingRequest = {
    type: 'ping';
    serviceName?: string;
};

export type PingResponse = {
    type: 'pong';
    identity: ServiceIdentity;
};

function isPingResponse(resp: any) : resp is PingResponse {
    return resp.type === 'pong';
}

export class PingRequestHandler extends RequestHandler<PingRequest, PingResponse> {
    
    constructor(private logger: Logger, public identity: ServiceIdentity) {
        super();
    }

    get name(): string {
        return 'PingRequestHandler';
    }
    
    get description(): string {
        return `Returns information about the service that participates to the system`;
    }

    get messageTypes(): string[] {
        return ['ping'];
    }

    protected async processRequest(req: IncomingMessageEnvelope<Request<PingRequest>>): Promise<PingResponse> {
        this.logger.debug('Sending pong response...');
        return {
            type: 'pong',
            identity: this.identity,
        }
    }
}

export class PingService {
    private handler: PingRequestHandler;
    private globalPath: MessagePath;
    private specificPath: MessagePath;

    constructor(private messageBus: IMessageBus, private logger: Logger, identity: ServiceIdentity) {
        this.handler = new PingRequestHandler(logger, identity);
        this.messageBus.registerHandlers(this.handler);
        this.globalPath = MessagePath.fromPath('messaging/control');
        this.specificPath = MessagePath.fromPath('messaging/control/{name(required)}');
        this.messageBus.subscribe({ type: 'topic', path: this.globalPath.subscribe({}) });
        this.messageBus.subscribe({ type: 'topic', path: this.specificPath.subscribe({ name: identity.name })});
}

    async *ping(options?: PingOptions): AsyncGenerator<PingResponse> {
        const serviceName = options?.serviceName;
        const req: PingRequest = {
            type: 'ping',
            serviceName: serviceName,
        };
        try {
            this.logger.debug('Sending ping request...');

            for await (const resp of this.messageBus.requestMany(req, {
                path: serviceName ? this.specificPath.publish({ name: serviceName }) : this.globalPath.publish({}),
                timeout: options?.timeout ?? 3*1000,
                limit: 1000,
            })) {
                this.logger.debug('Received pong response', resp.body);
                if (isResponseSuccess(resp)) {
                    if (isPingResponse(resp.body.body)) {
                        yield resp.body.body;
                    }
                }
            }
        } catch(err) {
            if (err instanceof RequestTimeoutError) {
                this.logger.trace("Ping timed out");
            } else {
                throw err;
            }
        }
    }
}