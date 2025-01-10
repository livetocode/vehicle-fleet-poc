import { EventHandler, EventHandlerContext } from "./EventHandler.js";
import { Request, Response, RequestOptions, RequestOptionsPair, isRequest, CancelRequestByType, CancelRequestById, isReplyResponse } from './Requests.js';
import { MessageEnvelope, ReplyMessageEnvelope } from "./MessageEnvelope.js";
import { Logger } from "../logger.js";
import { randomUUID, sleep } from "../utils.js";
import { PingResponse, PingService } from "./handlers/ping.js";
import { MessageBusMetrics, normalizeSubject } from "./MessageBusMetrics.js";
import { MessageBusDriver } from "./MessageBusDriver.js";
import { TypedMessage } from "./TypedMessage.js";
import { EventHandlerRegistry } from "./EventHandlerRegistry.js";
import { ResponseMatcherCollection } from "./ResponseMatcherCollection.js";
import { MessageDispatcher } from "./MessageDispatcher.js";
import { CancelRequestService } from "./handlers/cancel.js";
import { ServiceIdentity } from "./ServiceIdentity.js";
import { IMessageBus } from "./IMessageBus.js";

export class MessageBus implements IMessageBus {
    private started = false;
    private uid = randomUUID();
    private subjects = new Set<string>();
    private pendingSubscriptions: { subject: string;  consumerGroupName?: string }[] = [];
    private responseMatchers = new ResponseMatcherCollection();
    private pingService: PingService;
    private cancelService: CancelRequestService;
    private handlers = new EventHandlerRegistry();
    protected messageDispatcher: MessageDispatcher;        

    constructor(
        protected identity: ServiceIdentity,
        protected logger: Logger,
        protected metrics: MessageBusMetrics,
        protected driver: MessageBusDriver,
    ) {
        const activeEventHandlers = new Map<string, EventHandlerContext>();
        this.messageDispatcher = new MessageDispatcher(logger, metrics, this.handlers, this.responseMatchers, activeEventHandlers);
        this.subscribe(this.privateInboxName);
        this.pingService = new PingService(this, logger, identity);
        this.cancelService = new CancelRequestService(this, logger, identity, activeEventHandlers);
    }

    get privateInboxName(): string {
        return `inbox.${this.identity.name}.${this.uid}`;
    }

    async start(connectionString: string): Promise<void> {
        await this.driver.start(connectionString);
        this.started = true;
        for (const pendingSubscription of this.pendingSubscriptions) {
            this.driver.subscribe(pendingSubscription);
        }
        this.pendingSubscriptions = [];
    }
    
    async stop(): Promise<void> {
        await this.driver.stop();
        this.started = false;
    }

    waitForClose(): Promise<void> {
        return this.driver.waitForClose();
    }

    registerHandlers(...handlers: EventHandler[]): void {
        for (const handler of handlers) {
            this.handlers.register(handler);
        }
    }

    unregisterHandler(handler: EventHandler): void {
        this.handlers.unregister(handler);
    }

    subscribe(subject: string, consumerGroupName?: string): void {
        if (this.subjects.has(subject)) {
            return;
        }
        this.subjects.add(subject);
        if (this.started) {
            this.driver.subscribe({ subject, consumerGroupName });
        } else {
            this.pendingSubscriptions.push({ subject, consumerGroupName });
        }
    }

    publish(subject: string, message: any): void {
        const envelope: MessageEnvelope = {
            subject,
            body: message,
            headers: {},
            reply(_resp) {
                throw new Error('not implemented when publishing a message');
            },
        }
        this.publishEnvelope(envelope);
    }
    
    publishEnvelope(message: MessageEnvelope): void {
        this.driver.publish(message);
        this.metrics.publish(normalizeSubject(message.subject), message.body.type ?? 'unknown');
    }

    async request(request: TypedMessage, options: RequestOptions): Promise<MessageEnvelope<Response>> {
        for await (const resp of this.requestMany(request, options)) {
            return resp;
        }
        throw new Error('no response');
    }

    async *requestMany(request: TypedMessage, options: RequestOptions): AsyncGenerator<MessageEnvelope<Response>> {
        for await (const resp of this.requestBatch([[request, options]])) {
            yield resp;
        }
    }

    async *requestBatch(requests: RequestOptionsPair[]): AsyncGenerator<MessageEnvelope<Response>> {
        const matcher = this.responseMatchers.acquire();
        try {
            for (const [req, opt] of requests) {
                const envelope = this.createRequestEnvelope(req, opt)
                matcher.register(envelope.body.id, opt);
                this.publishEnvelope(envelope);
            }
            while (!matcher.isDone) {
                for (const resp of matcher.getMatches()) {
                    yield resp;
                }
                await sleep(100);
            }
        } finally {
            this.responseMatchers.release(matcher);
        }
    }

    reply(request: Request, response: Response): void {
        if (response.requestId !== request.id) {
            throw new Error(`Response mismatch error: expected response's requestId "${response.requestId}" to match request ID "${request.id}"`);
        }
        this.publish(request.replyTo, response);
    }

    cancel(request: CancelRequestById, options: Partial<RequestOptions>): Promise<MessageEnvelope<Response>> {
        return this.cancelService.cancel(request, options);
    }

    async *cancelMany(request: CancelRequestByType, options: Partial<RequestOptions>): AsyncGenerator<MessageEnvelope<Response>> {
        yield* this.cancelService.cancelMany(request, options);
    }

    ping(): AsyncGenerator<PingResponse> {
        return this.pingService.ping();
    }

    protected envelopeReply(request: MessageEnvelope, response: ReplyMessageEnvelope): void {
        if (!isRequest(request)) {
            throw new Error('Cannot reply to message because it is not a request');
        }
        if (!isReplyResponse(response)) {
            throw new Error('Submitted message is not a response');
        }
        this.reply(request.body, response.body);
    }
    
    private createRequestEnvelope(req: TypedMessage, opt: RequestOptions): MessageEnvelope<Request> {
        if (opt.limit !== undefined) {
            if (opt.limit < 1) {
                throw new Error(`limit should be greater than zero, but received: ${opt.limit}`);
            }
        }
        if (opt.timeout !== undefined) {
            if (opt.timeout < 1) {
                throw new Error(`timeout should be greater than zero, but received: ${opt.timeout}`);
            }
        }
        const onReplyTo = this.driver.onReplyTo;
        return {
            headers: opt.headers ?? {},
            subject: opt.subject,
            body: {
                type: 'request',
                id: opt.id ?? randomUUID(),
                replyTo: this.privateInboxName,
                parentId: opt.parentId,
                timeout: opt.timeout,
                expiresAt: computeExpiresAt(opt.timeout),
                body: req,    
            },
            reply(replyMsg) {
                onReplyTo(this, replyMsg);
            },
        }
    }
}

function computeExpiresAt(timeout?: number) {
    if (timeout !== undefined) {
        const now = new Date();
        return new Date(now.getTime() + timeout).toISOString();
    }
    return undefined;
}