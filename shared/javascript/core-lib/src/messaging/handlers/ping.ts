import { Logger } from "../../logger.js";
import { RequestHandler } from "../RequestHandler.js";
import { IncomingMessageEnvelope } from "../MessageEnvelopes.js";
import { isResponseSuccess, Request, RequestTimeoutError } from "../Requests.js";
import { ServiceIdentity } from "../ServiceIdentity.js";
import { IMessageBus } from "../IMessageBus.js";

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

    get eventTypes(): string[] {
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

    constructor(private messageBus: IMessageBus, private logger: Logger, identity: ServiceIdentity) {
        this.handler = new PingRequestHandler(logger, identity);
        this.messageBus.registerHandlers(this.handler);
        this.messageBus.subscribe('messaging.control.*');
}

    async *ping(serviceName?: string): AsyncGenerator<PingResponse> {
        const req: PingRequest = {
            type: 'ping',
            serviceName,
        };
        try {
            this.logger.debug('Sending ping request...');

            for await (const resp of this.messageBus.requestMany(req, {
                subject: serviceName ? `messaging.control.ping.${serviceName}` : 'messaging.control.ping',
                timeout: 5*1000,
                limit: 1000,
            })) {
                this.logger.debug('Received pong response', resp.body);
                if (isResponseSuccess(resp)) {
                    if (isPingResponse(resp.body.body)) {
                        yield resp.body.body;
                    }

                }
                if (resp.body.type === 'response-success') {
                    const respBody = resp.body.body;
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