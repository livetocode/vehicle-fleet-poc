import { Logger } from "../logger.js";
import { Stopwatch } from "../stopwatch.js";
import { randomUUID } from "../utils.js";
import { EventHandler } from "./EventHandler.js";
import { EventHandlerRegistry } from "./EventHandlerRegistry.js";
import { MessageBusMetrics, normalizeSubject } from "./MessageBusMetrics.js";
import { MessageEnvelope } from "./MessageEnvelope.js";
import { Request, Response, CancelRequest, isCancelRequest, isRequest, isResponse, CancelResponse, ResponseSuccess } from "./Requests.js";
import { ResponseMatcherCollection } from "./ResponseMatcherCollection.js";

type MessageHandlerContext = {
    msg: MessageEnvelope;
    handler: EventHandler;
}

export class MessageDispatcher {
    private activeHandlers = new Map<string, MessageHandlerContext>();
    constructor (
        private logger: Logger,
        private metrics: MessageBusMetrics,
        private handlers: EventHandlerRegistry,
        private responseMatchers: ResponseMatcherCollection,
    ) {}
    
    async dispatch(msg: MessageEnvelope) {
        if (isCancelRequest(msg)) {
            this.notifyCancelRequest(msg);
            return;
        }
        if (isResponse(msg)) {
            this.processResponse(msg);
            return;
        }
        const subject = normalizeSubject(msg.subject);
        const msgRequest = isRequest(msg) ? msg : undefined;
        const reqId = msgRequest ? msg.body.id : undefined;
        const bodyType = msgRequest ? msgRequest.body.body.type : msg.body.type;
        const handlers = this.handlers.find(bodyType);
        if (handlers) {
            const executeHandler = async (handler: EventHandler) => {
                const watch = Stopwatch.startNew();
                let status = 'unknown';
                try {
                    if (reqId) {
                        this.activeHandlers.set(reqId, { msg, handler });
                    }
                    await handler.process(msg);
                    status = 'success';
                } catch(err) {
                    status = 'error';
                    this.logger.error('NATS handler failed to process command', msg.body, err);
                } finally {
                    if (reqId) {
                        this.activeHandlers.delete(reqId);
                    }
                }
                watch.stop();
                this.metrics.processMessage(subject, bodyType ?? 'unknown', status, watch.elapsedTimeInMS());
            }
            if (handlers.length === 1) {
                await executeHandler(handlers[0]);
            } else {
                await Promise.all(handlers.map(executeHandler));
            }
        } else {
            this.metrics.processMessage(subject, bodyType ?? 'unknown', 'ignored');
        }
    }

    private processResponse(msg: MessageEnvelope<Response>) {
        this.responseMatchers.match(msg);
    }

    private notifyCancelRequest(msg: MessageEnvelope<Request<CancelRequest>>) {
        let found = false;
        const req = msg.body.body;
        if (req.type === 'cancel-request-id') {
            const ctx = this.activeHandlers.get(req.requestId);
            if (ctx) {
                found = true;
                ctx.msg.shouldCancel = true;
            }
        }
        if (req.type === 'cancel-request-type') {
            for (const ctx of this.activeHandlers.values()) {
                const isSameMessageType = ctx.msg.body.type === req.requestType;
                const isSameRequestType = isRequest(ctx.msg) && ctx.msg.body.body.type === req.requestType;
                if (isSameMessageType || isSameRequestType) {
                    found = true;
                    ctx.msg.shouldCancel = true;
                }
            }
        }
        this.logger.warn(`Cancel request: found=${found}`, msg.body);
        const resp: ResponseSuccess<CancelResponse> = {
            type: 'response-success',
            id: randomUUID(),
            requestId: msg.body.id,
            body: {
                type: 'cancel-response',
                found,
            }
        };
        msg.reply({
            headers: {},
            body: resp,
        })
    }
}
