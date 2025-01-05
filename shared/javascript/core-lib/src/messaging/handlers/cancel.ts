import { Logger } from "../../logger.js";
import { EventHandlerContext } from "../EventHandler.js";
import { MessageBus } from "../MessageBus.js";
import { MessageEnvelope } from "../MessageEnvelope.js";
import { RequestHandler } from "../RequestHandler.js";
import { Request, Response, CancelRequest, CancelResponse, RequestOptions, CancelRequestByType, CancelRequestById, isRequest } from "../Requests.js";

export class CancelRequestHandler extends RequestHandler<CancelRequest, CancelResponse> {
    
    constructor(
        messageBus: MessageBus,
        private logger: Logger,
        public appName: string,
        private activeHandlers: Map<string, EventHandlerContext>,
    ) {
        super(messageBus);
    }

    get eventTypes(): string[] {
        return ['cancel-request-id', 'cancel-request-type'];
    }

    protected async processRequest(req: MessageEnvelope<Request<CancelRequest>>): Promise<CancelResponse> {
        let found = false;
        const body = req.body.body;
        if (body.type === 'cancel-request-id') {
            const ctx = this.activeHandlers.get(body.requestId);
            if (ctx) {
                found = true;
                ctx.msg.shouldCancel = true;
            }
        }
        if (body.type === 'cancel-request-type') {
            for (const ctx of this.activeHandlers.values()) {
                const isSameMessageType = ctx.msg.body.type === body.requestType;
                const isSameRequestType = isRequest(ctx.msg) && ctx.msg.body.body.type === body.requestType;
                if (isSameMessageType || isSameRequestType) {
                    found = true;
                    ctx.msg.shouldCancel = true;
                }
            }
        }
        this.logger.warn(`Cancel request: found=${found}`, body);
        return {
            type: 'cancel-response',
            found,
            appName: this.appName,
        };        
    }
}

export class CancelRequestService {
    private handler: CancelRequestHandler;

    constructor(
        private messageBus: MessageBus,
        private logger: Logger,
        appName: string,
        activeHandlers: Map<string, EventHandlerContext>,
    ) {
        this.handler = new CancelRequestHandler(messageBus, logger, appName, activeHandlers);
        this.messageBus.registerHandlers(this.handler);
        // this.messageBus.subscribe('messaging.control.*');
    }

    cancel(request: CancelRequestById, options: Partial<RequestOptions>): Promise<MessageEnvelope<Response>> {
        const opt: RequestOptions = {
            ...options,
            subject: options.subject ?? 'messaging.control.cancel',
        }
        return this.messageBus.request(request, opt);
    }

    async *cancelMany(request: CancelRequestByType, options: Partial<RequestOptions>): AsyncGenerator<MessageEnvelope<Response>> {
        const opt: RequestOptions = {
            ...options,
            subject: options.subject ?? 'messaging.control.cancel',
        }
        for await (const resp of this.messageBus.requestBatch([[request, opt]])) {
            yield resp;
        }
    }

}