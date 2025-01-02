import { EventHandler } from "./EventHandler.js";
import { Request, Response, RequestOptions, RequestOptionsPair, isResponse, isAbortRequest, AbortRequest, isRequest } from './Requests.js';
import { ResponseMatcher } from "./ResponseMatcher.js";
import { MessageEnvelope } from "./MessageEnvelope.js";
import { Logger } from "../logger.js";
import { Stopwatch } from "../stopwatch.js";
import { randomUUID, sleep } from "../utils.js";
import { PingResponse, PingService } from "./handlers/ping.js";
import { MessageBusMetrics } from "./MessageBusMetrics.js";
import { MessageBusDriver } from "./MessageBusDriver.js";

export class MessageBus {
    private started = false;
    private uid = randomUUID();
    private pendingSubscriptions: { subject: string;  consumerGroupName?: string }[] = [];
    private responseMatchers: ResponseMatcher[] = [];
    private pingService: PingService;
    private handlers = new Map<string, EventHandler[]>();        

    constructor(
        protected appName: string,
        protected logger: Logger,
        protected metrics: MessageBusMetrics,
        protected driver: MessageBusDriver,
    ) {
        this.subscribe(this.privateInboxName);
        this.pingService = new PingService(this, logger, appName);
    }

    get privateInboxName(): string {
        return `inbox.${this.appName}.${this.uid}`;
    }

    async start(connectionString: string): Promise<void> {
        await this.driver.start(connectionString);
        this.started = true;
        for (const pendingSubscription of this.pendingSubscriptions) {
            this.driver.subscribe(pendingSubscription);
        }
        this.pendingSubscriptions = [];
    }
    
    subscribe(subject: string, consumerGroupName?: string): void {
        if (this.started) {
            this.driver.subscribe({ subject, consumerGroupName });
        } else {
            this.pendingSubscriptions.push({ subject, consumerGroupName });
        }
    }

    async stop(): Promise<void> {
        await this.driver.stop();
        this.started = false;
    }

    waitForClose(): Promise<void> {
        return this.driver.waitForClose();
    }

    publish(subject: string, message: any): void {
        const envelope: MessageEnvelope = {
            subject,
            body: message,
            headers: {},
            reply: () => {},
        }
        this.driver.publish(envelope);
        this.metrics.publish(normalizeSubject(subject), message.type ?? 'unknown');
    }

    registerHandlers(...handlers: EventHandler[]) {
        for (const handler of handlers) {
            for (const eventType of handler.eventTypes) {
                let eventTypeHandlers = this.handlers.get(eventType);
                if (!eventTypeHandlers) {
                    eventTypeHandlers = [];
                    this.handlers.set(eventType, eventTypeHandlers);
                }
                eventTypeHandlers.push(handler);
            }
        }
    }

    unregisterHandler(handler: EventHandler): void {
        for (const type of handler.eventTypes) {
            const handlers = this.handlers.get(type);
            if (handlers) {
                const idx = handlers?.indexOf(handler);
                if (idx >= 0) {
                    handlers?.splice(idx, 1);
                }    
            }
        }
    }

    async request(request: Request, options: RequestOptions): Promise<MessageEnvelope<Response>> {
        for await (const resp of this.requestMany(request, options)) {
            return resp;
        }
        throw new Error('no response');
    }

    async *requestMany(request: Request, options: RequestOptions): AsyncGenerator<MessageEnvelope<Response>> {
        for await (const resp of this.requestBatch([[request, options]])) {
            yield resp;
        }
    }

    async *requestBatch(requests: RequestOptionsPair[]): AsyncGenerator<MessageEnvelope<Response>> {
        const matcher = this.acquireResponseMatcher();
        try {
            for (const [req, opt] of requests) {
                matcher.register(req.id, opt);
                this.publish(opt.subject, req);
            }
            while (!matcher.isDone) {
                for (const resp of matcher.getMatches()) {
                    yield resp;
                }
                await sleep(100);
            }
        } finally {
            this.releaseResponseMatcher(matcher);
        }
    }

    reply(request: Request, response: Response): void {
        if (response.requestId !== request.id) {
            throw new Error(`Response mismatch error: expected response's requestId "${response.requestId}" to match request ID "${request.id}"`);
        }
        this.publish(request.replyTo, response);
    }

    ping(): AsyncGenerator<PingResponse> {
        return this.pingService.ping();
    }

    protected envelopeReply(request: MessageEnvelope, response: MessageEnvelope): void {
        if (!isRequest(request)) {
            throw new Error('Cannot reply to message because it is not a request');
        }
        if (!isResponse(response)) {
            throw new Error('Submitted message is not a response');
        }
        this.reply(request.body, response.body);
    }
    
    protected async dispatchMessage(msg: MessageEnvelope) {
        if (isAbortRequest(msg)) {
            this.notifyAbortRequest(msg);
            return;
        }
        if (isResponse(msg)) {
            this.processResponse(msg);
            return;
        }
        const subject = normalizeSubject(msg.subject);
        const msgRequest = isRequest(msg) ? msg : undefined;
        const bodyType = msgRequest ? msgRequest.body.body.type : msg.body.type;
        const handlers = this.handlers.get(bodyType);
        if (handlers) {
            const executeHandler = async (handler: EventHandler) => {
                const watch = Stopwatch.startNew();
                let status = 'unknown';
                try {
                    await handler.process(msg.body);
                    status = 'success';
                } catch(err) {
                    status = 'error';
                    this.logger.error('NATS handler failed to process command', msg.body, err);
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
        for (const responseMatcher of this.responseMatchers) {
            if (responseMatcher.match(msg)) {
                break;
            }    
        }
    }

    private notifyAbortRequest(msg: MessageEnvelope<AbortRequest>) {
        // find message envelope beeing processed by a handler
        // msgToAbort.shouldAbort = true
        throw new Error("not implemented");
    }

    private acquireResponseMatcher() {
        const result = new ResponseMatcher();
        this.responseMatchers.push(result);
        return result;
    }

    private releaseResponseMatcher(matcher: ResponseMatcher) {
        const idx = this.responseMatchers.indexOf(matcher);
        if (idx >= 0) {
            delete this.responseMatchers[idx];
        }
    }    
}

function normalizeSubject(subject: string) {
    if (subject.startsWith('inbox.')) {
        const idx = subject.lastIndexOf('.');
        return subject.slice(0, idx);
    }
    return subject;
}

