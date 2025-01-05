import { Logger } from "../logger.js";
import { Stopwatch } from "../stopwatch.js";
import { ActiveEventHandlers, EventHandler } from "./EventHandler.js";
import { EventHandlerRegistry } from "./EventHandlerRegistry.js";
import { MessageBusMetrics, normalizeSubject } from "./MessageBusMetrics.js";
import { MessageEnvelope } from "./MessageEnvelope.js";
import { Response, isRequest, isResponse } from "./Requests.js";
import { ResponseMatcherCollection } from "./ResponseMatcherCollection.js";

export class MessageDispatcher {
    constructor (
        private logger: Logger,
        private metrics: MessageBusMetrics,
        private handlers: EventHandlerRegistry,
        private responseMatchers: ResponseMatcherCollection,
        private activeHandlers: ActiveEventHandlers,
    ) {}
    
    async dispatch(msg: MessageEnvelope) {
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
}
