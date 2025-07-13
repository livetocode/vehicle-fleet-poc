import { MessageHandler, MessageHandlerContext } from "./MessageHandler.js";
import { Request, Response, RequestOptions, RequestOptionsPair, isRequest, CancelRequestByType, CancelRequestById, isReplyResponse } from './Requests.js';
import { BaseMessageEnvelope, IncomingMessageEnvelope, MessageEnvelope, MessageHeaders } from "./MessageEnvelopes.js";
import { Logger } from "../logger.js";
import { randomUUID, sleep } from "../utils.js";
import { PingOptions, PingResponse, PingService } from "./handlers/ping.js";
import { MessageBusMetrics, normalizeSubject } from "./MessageBusMetrics.js";
import { MessageBusDriver } from "./MessageBusDriver.js";
import { TypedMessage } from "./TypedMessage.js";
import { MessageHandlerRegistry } from "./MessageHandlerRegistry.js";
import { ResponseMatcherCollection } from "./ResponseMatcherCollection.js";
import { MessageDispatcher } from "./MessageDispatcher.js";
import { CancelRequestService } from "./handlers/cancel.js";
import { ServiceIdentity } from "./ServiceIdentity.js";
import { IMessageBus, MessageBusFeatures, MessageOptionsPair } from "./IMessageBus.js";
import { MessageSubscriptions } from "./MessageSubscriptions.js";
import { InfoOptions, InfoResponse, InfoService } from "./handlers/info.js";
import { MessageRoutes } from "./MessageRoutes.js";
import { ProtoBufCodec, ProtoBufRegistry } from "./ProtoBufRegistry.js";
import { MessageSubscription } from "./MessageSubscription.js";
import { PublicationMessagePath } from "./MessagePath.js";
import { ChaosEngineeringConfig } from "../config.js";

export abstract class MessageBus implements IMessageBus {
    private started = false;
    private inboxPath: PublicationMessagePath;
    private responseMatchers = new ResponseMatcherCollection();
    private pingService: PingService;
    private infoService: InfoService;
    private cancelService: CancelRequestService;
    private handlers = new MessageHandlerRegistry();
    private subscriptions = new MessageSubscriptions();
    protected messageDispatcher: MessageDispatcher;

    constructor(
        private _identity: ServiceIdentity,
        protected logger: Logger,
        protected chaosEngineering: ChaosEngineeringConfig,
        protected metrics: MessageBusMetrics,
        protected driver: MessageBusDriver,
        protected protoBufRegistry: ProtoBufRegistry,
    ) {
        const activeEventHandlers = new Map<string, MessageHandlerContext>();
        const messageRoutes = new MessageRoutes();
        this.messageDispatcher = new MessageDispatcher(
            logger, 
            _identity, 
            chaosEngineering,
            metrics, 
            messageRoutes, 
            this.handlers, 
            this.responseMatchers, 
            activeEventHandlers,
        );
        const inbox = driver.privateInboxPath;
        this.inboxPath = inbox.publish;
        this.subscribe({ type: 'queue', path: inbox.subscribe });
        this.pingService = new PingService(this, logger, _identity);
        this.infoService = new InfoService(this, logger, _identity, this.subscriptions, this.handlers, messageRoutes);
        this.cancelService = new CancelRequestService(this, logger, _identity, activeEventHandlers);
    }

    get identity(): ServiceIdentity {
        return this._identity;
    }

    abstract get features(): MessageBusFeatures;

    get privateInbox(): PublicationMessagePath {
        return this.inboxPath;
    }

    async start(connectionString: string): Promise<void> {
        if (this.started) {
            throw new Error('MessageBus is already started!');
        }
        await this.driver.start(connectionString);
        this.started = true;
        for (const subscription of this.subscriptions.entries()) {
            this.driver.subscribe(subscription);
        }
    }
    
    async stop(): Promise<void> {
        if (this.started) {
            await this.driver.stop();
            this.started = false;    
        }
    }

    waitForClose(): Promise<void> {
        return this.driver.waitForClose();
    }

    registerHandlers(...handlers: MessageHandler[]): void {
        for (const handler of handlers) {
            this.handlers.register(handler);
        }
    }

    unregisterHandler(handler: MessageHandler): void {
        this.handlers.unregister(handler);
    }

    registerMessageCodec(messageType: string, codec: ProtoBufCodec): void {
        this.protoBufRegistry.register(messageType, codec);
    }

    subscribe(subscription: MessageSubscription): void {
        if (this.subscriptions.add(subscription)) {
            if (this.started) {
                this.driver.subscribe(subscription);
            }
        }
    }

    publish(path: PublicationMessagePath, message: TypedMessage, headers?: MessageHeaders): Promise<void> {
        const envelope: MessageEnvelope = {
            subject: this.driver.renderPath(path),
            body: message,
            headers: headers ?? {},
        }
        return this.publishEnvelope(envelope);
    }
    
    async publishBatch(messages: MessageOptionsPair[]): Promise<void> {
        if (this.chaosEngineering.enabled) {
            await sleep(this.chaosEngineering.messageWriteDelayInMS);
        }
        const envelopes = messages.map(([msg, opt]) => ({
            subject: this.driver.renderPath(opt.path),
            body: msg,
            headers: opt.headers ?? {},
        }));
        await this.driver.publishBatch(envelopes);
    }

    
    async publishEnvelope(message: MessageEnvelope): Promise<void> {
        if (this.chaosEngineering.enabled) {
            await sleep(this.chaosEngineering.messageWriteDelayInMS);
        }
        message.headers.serviceName = this.identity.name;
        this.metrics.publish(normalizeSubject(message.subject), message.body.type ?? 'unknown');
        return this.driver.publish(message);
    }

    publishLocal(message: TypedMessage, headers?: MessageHeaders): Promise<void> {
        const self = this;
        const envelope: IncomingMessageEnvelope = {
            subject: '@local',
            subscribedSubject: '@local',
            body: message,
            headers: {
                ...headers,
                senderName: this.identity.name,
            },
            reply(replyMsg) {
                return self.publishLocal(replyMsg.body, replyMsg.headers);
            }
        }
        return this.messageDispatcher.dispatch(envelope);
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
            const envelopes = requests.map(([req, opt]) => {
                const envelope = this.createRequestEnvelope(req, opt);
                matcher.register(envelope.body.id, opt);
                return envelope;
            });
            await this.driver.publishBatch(envelopes);

            while (!matcher.isDone) {
                for (const resp of matcher.getMatches()) {
                    yield resp;
                }
                await matcher.wait();
            }
        } finally {
            this.responseMatchers.release(matcher);
        }
    }

    reply(request: IncomingMessageEnvelope<Request>, response: BaseMessageEnvelope<Response>): Promise<void> {
        if (response.body.requestId !== request.body.id) {
            throw new Error(`Response mismatch error: expected response's requestId "${response.body.requestId}" to match request ID "${request.body.id}"`);
        }
        return this.publishEnvelope({
            ...response,
            subject: request.body.replyTo,
        });
    }

    cancel(request: CancelRequestById, options: Partial<RequestOptions>): Promise<MessageEnvelope<Response>> {
        return this.cancelService.cancel(request, options);
    }

    async *cancelMany(request: CancelRequestByType, options: Partial<RequestOptions>): AsyncGenerator<MessageEnvelope<Response>> {
        yield* this.cancelService.cancelMany(request, options);
    }

    ping(options?: PingOptions): AsyncGenerator<PingResponse> {
        return this.pingService.ping(options);
    }

    info(options?: InfoOptions): AsyncGenerator<InfoResponse> {
        return this.infoService.info(options);
    }

    protected envelopeReply(request: IncomingMessageEnvelope, response: BaseMessageEnvelope): Promise<void> {
        if (!isRequest(request)) {
            throw new Error('Cannot reply to message because it is not a request');
        }
        if (!isReplyResponse(response)) {
            throw new Error('Submitted message is not a response');
        }
        return this.reply(request, response);
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
        return {
            headers: opt.headers ?? {},
            subject: this.driver.renderPath(opt.path),
            body: {
                type: 'request',
                id: opt.id ?? randomUUID(),
                replyTo: this.driver.renderPath(this.privateInbox),
                parentId: opt.parentId,
                timeout: opt.timeout,
                expiresAt: computeExpiresAt(opt.timeout),
                body: req,    
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