import { JSONCodec, connect, type Msg, type MsgHdrs, type NatsConnection, headers, Match } from "nats.ws";
import type {ChaosEngineeringConfig, Deferred, IncomingMessageEnvelope, MessageBusFeatures, MessageEnvelope, MessageHeaders, MessageSubscription, ReceiveMessageCallback, ReplyToCallback, TypedMessage } from "core-lib";
import { type MessageBusDriver, deferred, formatIdentity, MessageBus, MessagePath, NoopMessageBusMetrics, ProtoBufRegistry, PublicationMessagePath, randomUUID, ReplyPath, sleep, Stopwatch, SubscriptionMessagePath } from "core-lib";
import type { Logger, ServiceIdentity } from "core-lib";
import { ServiceBusClient, type ServiceBusSender, type ServiceBusReceiver, type ServiceBusMessage, type ServiceBusReceivedMessage, type ProcessErrorArgs, ServiceBusAdministrationClient, type ServiceBusMessageBatch } from '@azure/service-bus';

const MessageTypeHeader = 'proto/type';

export class NatsMessageBus extends MessageBus {

    constructor(identity: ServiceIdentity, logger: Logger, chaosEngineering: ChaosEngineeringConfig) {
        const protoBufRegistry = new ProtoBufRegistry();
        const driver = new NatsMessageBusDriver(
            (msg) => this.messageDispatcher.dispatch(msg),
            (req, res) => this.envelopeReply(req, res),
            identity,
            logger,
            protoBufRegistry,
        );
        super(identity, logger, chaosEngineering, new NoopMessageBusMetrics(), driver, protoBufRegistry);
    }
    
    get features(): MessageBusFeatures {
        return {
            supportsAbstractSubjects: true,
            supportsTemporaryQueues: true,
        }
    }
}


export class NatsMessageBusDriver implements MessageBusDriver {
    private uid = randomUUID();
    private connection?: NatsConnection;
    private codec = JSONCodec();
    private watch = new Stopwatch();

    constructor (
        public readonly onReceiveMessage: ReceiveMessageCallback, 
        public readonly onReplyTo: ReplyToCallback, 
        private identity: ServiceIdentity,
        private logger: Logger,
        private protoBufRegistry: ProtoBufRegistry,
    ) {}

    get privateInboxPath(): { publish: PublicationMessagePath; subscribe: SubscriptionMessagePath } {
        const inboxPath = MessagePath.fromPath(`inbox/{name(required)}/{id(required)}`);
        const inboxVars: Record<string, string> = {
            name: this.identity.name, 
            id: this.uid,
        };
        return {
            publish: inboxPath.publish(inboxVars),
            subscribe: inboxPath.subscribe(inboxVars),
        };
    }

    async start(connectionString: string): Promise<void> {
        const servers = (process.env.NATS_SERVERS ?? connectionString).split(',');
        for (let i = 0; i < 30; i++) {
            try {
                this.logger.info(`NATS connection attempt #${i} on servers ${servers}`);
                this.connection = await connect({ servers });
                this.logger.info('NATS connection is ready.');
                this.watch.restart();
                return;
            } catch(err: any) {
                this.logger.error(`Could not connect to NATS server: ${err}`);
                await sleep(1000);
            }
        }
        throw new Error('Could not connect to NATS server after multiple attemps');
    }
    
    async stop(): Promise<void> {
        if (this.connection) {
            await this.connection.drain();
            const stats = this.connection.stats();
            this.connection = undefined;
            this.watch.stop();
            this.logger.info(`NATS connection closed after processing `, stats.inMsgs, " messages in ", this.watch.elapsedTimeAsString());
        }
    }
    
    async waitForClose(): Promise<void> {
        if (this.connection) {
            const result = await this.connection.closed();
            if (result) {
                this.logger.error('Closed with error', result);
            }
        }
    }
    
    subscribe(subscription: MessageSubscription): void {
        this.doSubscribe(subscription).catch(err => {
            this.logger.error(err);
        });
    }    
    
    private async doSubscribe(subscription: MessageSubscription): Promise<void> {
        if (!this.connection) {
            throw new Error('Expected MessageBus to be started');
        }

        const queueName = subscription.type === 'queue' ? this.identity.name : undefined;
        const subject = this.renderPath(subscription.path);
        this.logger.info(`NATS subscribed to ${subscription.type}: ${subject}'`);
        for await (const msg of this.connection.subscribe(subject, { queue: queueName })) {
            const msgEnv = this.createMessageEnvelope(subject, msg);
            try {
                await this.onReceiveMessage(msgEnv);
            } catch(err) {
                this.logger.error('onReceiveMessage failed', err);
            }
        }
    }
    
    publish(msg: MessageEnvelope): Promise<void> {
        if (!this.connection) {
            throw new Error('Expected to have established a connexion!');
        }
        let data: Uint8Array;
        const codec = this.protoBufRegistry.find(msg.body.type);
        if (codec) {
            data = codec.encode(msg.body);
            msg.headers[MessageTypeHeader] = msg.body.type;
        } else {
            data = this.codec.encode(msg.body);
        }
        this.connection.publish(msg.subject, data, { headers: convertToMsgHdrs(msg.headers)});
        return Promise.resolve();
    }

    async publishBatch(messages: MessageEnvelope[]): Promise<void> {
        for (const msg of messages) {
            this.publish(msg);
        }
        if (this.connection) {
            await this.connection.flush();
        }
    }


    renderPath(path: MessagePath): string {
        if (path instanceof PublicationMessagePath)  {
            const segments: string[] = [];
            for (const segment of path.segments) {
                if (segment.type === 'string') {
                    segments.push(segment.value);
                } else if (segment.type === 'var') {
                    const val = path.vars[segment.name];
                    if (val) {
                        segments.push(val);
                    } else {
                        throw new Error(`Expected to have a value for message path var '${segment.name}' when publishing`);
                    }
                } else if (segment.type === 'rest') {
                    const val = path.vars['rest'];
                    if (val) {
                        for (const item of val.split('/')) {
                            segments.push(item);
                        }
                    }
                }
            }
            return segments.join('.');    
        } else if (path instanceof SubscriptionMessagePath) {
            const segments: string[] = [];
            for (const segment of path.segments) {
                if (segment.type === 'string') {
                    segments.push(segment.value);
                } else if (segment.type === 'var') {
                    const val = path.vars[segment.name];
                    if (val) {
                        segments.push(val);
                    } else {
                        if (segment.isRequired) {
                            throw new Error(`Expected to have a value for required var '${segment.name}' of path '${path}'`);
                        } else {
                            segments.push('*');
                        }
                    }
                } else if (segment.type === 'rest') {
                    segments.push('>');
                }
            }
            return segments.join('.');
        } else if (path instanceof ReplyPath) {
            return path.replyTo;
        } else {
            throw new Error(`Unknown message path: ${path.constructor.name}`);
        }
    }

    private createMessageEnvelope(subject: string, msg: Msg): IncomingMessageEnvelope {
        const messageType = msg.headers?.get(MessageTypeHeader, Match.Exact);
        let data: any;
        if (messageType) {
            const codec = this.protoBufRegistry.get(messageType);
            data = codec.decode(msg.data);
        } else {
            data = this.codec.decode(msg.data);
        }
        const onReplyTo = this.onReplyTo;
        return {
            subject: msg.subject,
            subscribedSubject: subject,
            headers: convertFromMsgHdrs(msg.headers),
            body: data,
            reply(replyMsg) {
                return onReplyTo(this, replyMsg);
            }
        };
    }    
}

function convertFromMsgHdrs(source?: MsgHdrs): MessageHeaders {
    const result: MessageHeaders = {};
    if (source) {
        for (const [k, v] of source) {
            if (Array.isArray(v)) {
                result[k] = v.join(',');
            } else {
                result[k] = v;
            }
        }
    }
    return result;
}

function convertToMsgHdrs(source: MessageHeaders): MsgHdrs {
    const result = headers();
    for (const [k, v] of Object.entries(source)) {
        result.set(k, v);
    }
    return result;
}

export class AzureServiceBusMessageBus extends MessageBus {

    constructor(identity: ServiceIdentity, logger: Logger, chaosEngineering: ChaosEngineeringConfig) {
        const protoBufRegistry = new ProtoBufRegistry();
        const driver = new AzureServiceBusMessageBusDriver(
            (msg) => this.messageDispatcher.dispatch(msg),
            (req, res) => this.envelopeReply(req, res),
            identity,
            logger,
            protoBufRegistry,
        );
        super(identity, logger, chaosEngineering, new NoopMessageBusMetrics(), driver, protoBufRegistry);
    }

    get features(): MessageBusFeatures {
        return {
            supportsAbstractSubjects: false,
            supportsTemporaryQueues: false,
        }
    }
}

export class AzureServiceBusMessageBusDriver implements MessageBusDriver {
    private client?: ServiceBusClient;
    private adminClient?: ServiceBusAdministrationClient;
    private senders: Map<string, ServiceBusSender> = new Map(); 
    private receivers: Map<string, ServiceBusReceiver> = new Map(); 
    private stoppedEvent?: Deferred<void>;

    constructor(
        public readonly onReceiveMessage: ReceiveMessageCallback,
        public readonly onReplyTo: ReplyToCallback,
        private identity: ServiceIdentity,
        private logger: Logger,
        private protoBufRegistry: ProtoBufRegistry,
    ) {
    }

    get privateInboxPath(): { publish: PublicationMessagePath; subscribe: SubscriptionMessagePath } {
        const inboxPath = MessagePath.fromPath(`inbox/{name(required)}/{instance(required)}`);
        const inboxVars: Record<string, string> = {
            name: this.identity.name, 
            instance: this.identity.instance.toString(),
        };
        return {
            publish: inboxPath.publish(inboxVars),
            subscribe: inboxPath.subscribe(inboxVars),
        };
    }

    async start(connectionString: string): Promise<void> {
        this.stoppedEvent = deferred();
        this.client = new ServiceBusClient(connectionString, {
            identifier: formatIdentity(this.identity),
        });
        this.adminClient = new ServiceBusAdministrationClient(connectionString);
    }

    async stop(): Promise<void> {
        if (!this.stoppedEvent) {
            throw new Error('Cannot stop because the bus has not been started.');
        }
        try {
            // Close receivers
            for (const [key, receiver] of this.receivers.entries()) {
                try {
                    await receiver.close();

                } catch(err: any) {
                    this.logger.error(`Error while closing receiver ${key}:`, err);
                }            
            }
            this.receivers.clear();

            // Close senders
            for (const [key, sender] of this.senders.entries()) {
                try {
                    await sender.close();
                } catch(err: any) {
                    this.logger.error(`Error while closing sender ${key}:`, err);
                }
                
            }
            this.senders.clear();

            // Close client
            if (this.client) {
                try {
                    await this.client.close();
                } finally {
                    this.client = undefined;
                }
            }
            this.logger.info("AzureServiceBusMessageBusDriver stopped.");
        } finally {
            this.stoppedEvent?.resolve();            
        }
    }

    async waitForClose(): Promise<void> {
        if (!this.stoppedEvent) {
            throw new Error('Cannot wait on close until the bus has been started.');
        }
        await this.stoppedEvent;
    }

    subscribe(subscription: MessageSubscription): void {
        this.doSubscribe(subscription).catch(err => {
            this.logger.error(err);
        });
    }

    private async doSubscribe(subscription: MessageSubscription): Promise<void> {

        if (!this.client) {
            throw new Error('Expected AzureServiceBusMessageBusDriver to be started before subscribing.');
        }
        if (!this.adminClient) {
            throw new Error('Expected AzureServiceBusMessageBusDriver to be started before subscribing.');
        }

        const receiveMode: 'peekLock' | 'receiveAndDelete' = 'receiveAndDelete'; // 'peekLock'; // Default to peekLock for reliability
        const destinationName = this.renderPath(subscription.path);

        let receiver: ServiceBusReceiver;
        let receiverKey: string;

        if (subscription.type === 'queue') {
            const exists = await this.adminClient.queueExists(destinationName);
            if (!exists) {
                await this.adminClient?.createQueue(destinationName);
            }
            receiverKey = destinationName;
            receiver = this.client.createReceiver(destinationName, { receiveMode });
        } else if (subscription.type === 'topic') {
            let exists = await this.adminClient.topicExists(destinationName);
            if (!exists) {
                await this.adminClient?.createTopic(destinationName);
            }
            const subscriptionName = formatIdentity(this.identity);
            exists = await this.adminClient.subscriptionExists(destinationName, subscriptionName);
            if (!exists) {
                await this.adminClient?.createSubscription(destinationName, subscriptionName);
            }
            receiverKey = destinationName;
            receiver = this.client.createReceiver(destinationName, subscriptionName, { receiveMode });
        } else {
            throw new Error(`Unknown subscription type '${subscription.type}'`);
        }

        const messageHandler = async (message: ServiceBusReceivedMessage) => {
            const incomingMsg = this.createMessageEnvelope(message, destinationName);
            await this.onReceiveMessage(incomingMsg);
        };

        const errorHandler = async (args: ProcessErrorArgs) => {
            this.logger.error(`Error while processing message for  ${receiverKey}:`, args);
        };
        this.logger.info(`Azure Service Bus subscribed to ${subscription.type}: ${destinationName}'`);
        receiver.subscribe({
            processMessage: messageHandler,
            processError: errorHandler
        });

        this.receivers.set(receiverKey, receiver);
    }

    publish(msg: MessageEnvelope): Promise<void> {
        if (!this.client) {
            throw new Error('ServiceBusClient is not initialized.');
        }

        const destinationName = msg.subject;

        let sender = this.senders.get(destinationName);
        if (!sender) {
            sender = this.client.createSender(msg.subject);
            this.senders.set(destinationName, sender);
        }

        const serviceBusMessage = this.createServiceBusMessageFrom(msg);

        return sender.sendMessages(serviceBusMessage);
    }

    async publishBatch(messages: MessageEnvelope[]): Promise<void> {
        if (!this.client) {
            this.logger.error("ServiceBusClient non initialisé ou fermé. Impossible de publier le message.");
            return;
        }
        const batches = new Map<string, ServiceBusMessageBatch>();
        for (const msg of messages) {

            const destinationName = msg.subject;

            let sender = this.senders.get(destinationName);
            if (!sender) {
                sender = this.client.createSender(msg.subject);
                this.senders.set(destinationName, sender);
            }
            let batch = batches.get(destinationName);
            if (!batch) {
                batch = await sender.createMessageBatch();
                batches.set(destinationName, batch);
            }

            const serviceBusMessage = this.createServiceBusMessageFrom(msg);

            if (!batch.tryAddMessage(serviceBusMessage)) {
                await sender.sendMessages(batch);
                batches.delete(destinationName);
            }
        }
        for (const [destinationName, batch] of batches.entries()) {
            const sender = this.senders.get(destinationName);
            if (!sender) {
                throw new Error(`Expected to find a sender for destination '${destinationName}'`);
            }
            await sender.sendMessages(batch);
        }
    }

    renderPath(path: MessagePath): string {
        if (path instanceof PublicationMessagePath)  {
            const segments: string[] = [];
            for (const segment of path.segments) {
                if (segment.type === 'string') {
                    segments.push(segment.value);
                } else if (segment.type === 'var') {
                    if (segment.isRequired) {
                        const val = path.vars[segment.name];
                        if (val) {
                            segments.push(val);
                        } else {
                            throw new Error(`Expected to have a value for message path var '${segment.name}' when publishing`);
                        }    
                    } else {
                        // patterns don't exist in Azure Service Bus, so stop now in order to produce a more generic subject.
                        break;
                    }
                } else if (segment.type === 'rest') {
                    const val = path.vars['rest'];
                    if (Array.isArray(val)) {
                        for (const item of val) {
                            segments.push(item);
                        }
                    }
                    break; // rest should be at the end and exist only once
                }
            }
            return segments.join('.');    
        } else if (path instanceof SubscriptionMessagePath) {
            const segments: string[] = [];
            for (const segment of path.segments) {
                if (segment.type === 'string') {
                    segments.push(segment.value);
                } else if (segment.type === 'var') {
                    const val = path.vars[segment.name];
                    if (val) {
                        segments.push(val);
                    } else {
                        if (segment.isRequired) {
                            throw new Error(`Expected to have a value for required var '${segment.name}' of path '${path}'`);
                        } else {
                            // patterns don't exist in Azure Service Bus, so stop now in order to produce a more generic subject.
                            break;
                        }
                    }
                } else if (segment.type === 'rest') {
                    // patterns don't exist in Azure Service Bus, so stop now in order to produce a more generic subject.
                    break;
                }
            }
            return segments.join('.');
        } else if (path instanceof ReplyPath) {
            return path.replyTo;
        } else {
            throw new Error(`Unknown message path: ${path.constructor.name}`);
        }
    }

    private createServiceBusMessageFrom(msg: MessageEnvelope): ServiceBusMessage {
        let bodyBuffer: any;
        const applicationProperties: ServiceBusMessage['applicationProperties'] = {};
    
        const codec = this.protoBufRegistry.find(msg.body.type);
        if (codec) {
            bodyBuffer = codec.encode(msg.body);
            applicationProperties[MessageTypeHeader] = msg.body.type;
        } else {
            bodyBuffer = Buffer.from(JSON.stringify(msg.body), 'utf-8');
        }
    
        for (const [key, value] of Object.entries(msg.headers)) {
            applicationProperties[key] = value;
        }
    
        const serviceBusMessage: ServiceBusMessage = {
            body: bodyBuffer,
            applicationProperties: applicationProperties,
            //replyTo: msg.headers['replyTo'],
            //correlationId: msg.headers['correlationId'],
            contentType: codec ? 'application/x-protobuf' : 'application/json',
        };

        return serviceBusMessage;
    }

    private createMessageEnvelope(
        serviceBusMessage: ServiceBusReceivedMessage,
        subscribedSubject: string,
    ): IncomingMessageEnvelope {
        const messageType = serviceBusMessage.applicationProperties?.[MessageTypeHeader] as string | undefined;
        let body: TypedMessage;

        if (messageType && serviceBusMessage.body instanceof Buffer) {
            const codec = this.protoBufRegistry.get(messageType);
            body = codec.decode(serviceBusMessage.body as any) as TypedMessage;
        } else {
            if (serviceBusMessage.body instanceof Buffer) {
                body = JSON.parse(serviceBusMessage.body.toString('utf-8')) as TypedMessage;
            } else {
                body = serviceBusMessage.body as TypedMessage;
            }
        }

        const headers: MessageHeaders = {};
        if (serviceBusMessage.applicationProperties) {
            for (const key in serviceBusMessage.applicationProperties) {
                if (Object.prototype.hasOwnProperty.call(serviceBusMessage.applicationProperties, key)) {
                    headers[key] = String(serviceBusMessage.applicationProperties[key]);
                }
            }
        }
        
        const onReplyTo = this.onReplyTo;
        return {
            subject: serviceBusMessage.to || subscribedSubject, 
            subscribedSubject: subscribedSubject,
            headers: headers,
            body: body,
            reply(replyMsg) {
                return onReplyTo(this, replyMsg);
            }
        };
    }
}
