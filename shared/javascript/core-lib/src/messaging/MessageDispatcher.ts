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
        const msgRequest = isRequest(msg) ? msg : undefined;
        const bodyType = msgRequest ? msgRequest.body.body.type : msg.body.type;
        const handlers = this.handlers.find(bodyType);
        if (handlers) {
            const blockingHandlers = handlers.filter(x => !x.isNonBlocking);
            const nonBlockingHandlers = handlers.filter(x => x.isNonBlocking);
            if (nonBlockingHandlers.length > 0) {
                setTimeout(() => {
                    this.dispatchHandlers(msg, nonBlockingHandlers).catch(err => {
                        this.logger.error('non blocking dispatchHandlers failed', err);
                    });
                }, 10);
            }
            if (blockingHandlers.length > 0) {
                await this.dispatchHandlers(msg, blockingHandlers);
            }
        } else {
            const subject = normalizeSubject(msg.subject);
            this.metrics.processMessage(subject, bodyType ?? 'unknown', 'ignored');
        }
    }

    async dispatchHandlers(msg: MessageEnvelope, handlers: EventHandler[]) {
        const executeHandler = async (handler: EventHandler) => {
            const watch = Stopwatch.startNew();
            const msgRequest = isRequest(msg) ? msg : undefined;
            const reqId = msgRequest?.body.id;
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
            const subject = normalizeSubject(msg.subject);
            const bodyType = msgRequest ? msgRequest.body.body.type : msg.body.type;    
            this.metrics.processMessage(subject, bodyType ?? 'unknown', status, watch.elapsedTimeInMS());
        }
        if (handlers.length === 1) {
            await executeHandler(handlers[0]);
        } else {
            await Promise.all(handlers.map(executeHandler));
        }
    }

    private processResponse(msg: MessageEnvelope<Response>) {
        this.responseMatchers.match(msg);
    }
}
