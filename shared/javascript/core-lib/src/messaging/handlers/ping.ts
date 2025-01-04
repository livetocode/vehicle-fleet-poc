import { Logger } from "../../logger.js";
import { RequestHandler } from "../RequestHandler.js";
import { MessageBus } from "../MessageBus.js";
import { MessageEnvelope } from "../MessageEnvelope.js";
import { Request, RequestTimeoutError, Response, ResponseSuccess } from "../Requests.js";

export type PingRequest = {
    type: 'ping';
};

export type PingResponse = {
    type: 'pong';
    appName: string;
};

function isPingResponse(resp: any) : resp is PingResponse {
    return resp.type === 'pong';
}

export class PingRequestHandler extends RequestHandler<PingRequest, PingResponse> {
    
    constructor(messageBus: MessageBus, private logger: Logger, public appName: string) {
        super(messageBus);
    }

    get eventTypes(): string[] {
        return ['ping'];
    }

    protected async processRequest(req: MessageEnvelope<Request<PingRequest>>): Promise<PingResponse> {
        this.logger.debug('Sending pong response...');
        return {
            type: 'pong',
            appName: this.appName,
        }
    }
}

export class PingService {
    private handler: PingRequestHandler;

    constructor(private messageBus: MessageBus, private logger: Logger, appName: string) {
        this.handler = new PingRequestHandler(messageBus, logger, appName);
        this.messageBus.registerHandlers(this.handler);
        // this.messageBus.subscribe('messaging.control.*');
}

    async *ping(): AsyncGenerator<PingResponse> {
        const req: PingRequest = {
            type: 'ping',
        };
        try {
            this.logger.debug('Sending ping request...');

            for await (const resp of this.messageBus.requestMany(req, {
                subject: 'messaging.control.ping',
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