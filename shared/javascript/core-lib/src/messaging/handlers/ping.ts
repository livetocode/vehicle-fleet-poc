import { Logger } from "../../logger.js";
import { RequestHandler } from "../RequestHandler.js";
import { MessageEnvelope } from "../MessageEnvelope.js";
import { Request, RequestTimeoutError, Response, ResponseSuccess } from "../Requests.js";
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
    
    constructor(messageBus: IMessageBus, private logger: Logger, public identity: ServiceIdentity) {
        super(messageBus);
    }

    get eventTypes(): string[] {
        return ['ping'];
    }

    protected async processRequest(req: MessageEnvelope<Request<PingRequest>>): Promise<PingResponse> {
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
        this.handler = new PingRequestHandler(messageBus, logger, identity);
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
                if (resp.body.type === 'response-success') {
                    const respBody = resp.body.body;
                    if (isPingResponse(respBody)) {
                        yield respBody;
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