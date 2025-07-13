import { ServiceBusClient, ServiceBusSender, ServiceBusReceiver, ServiceBusMessage, ServiceBusReceivedMessage, ProcessErrorArgs, ServiceBusAdministrationClient, ServiceBusMessageBatch } from '@azure/service-bus';
import { Logger, MessageBusDriver, MessageEnvelope, IncomingMessageEnvelope, ReceiveMessageCallback, ReplyToCallback, TypedMessage, MessageHeaders, ProtoBufRegistry, deferred, Deferred, ServiceIdentity, formatIdentity, MessagePath, PublicationMessagePath, SubscriptionMessagePath, MessageSubscription, ReplyPath } from 'core-lib'; 
import { gracefulTerminationService } from './GracefulTerminationService.js';

const MessageTypeHeader = 'proto/type';

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
        const cs = process.env.AZSB_CONNECTION_STRING ?? connectionString;
        this.stoppedEvent = deferred();
        this.client = new ServiceBusClient(cs, {
            identifier: formatIdentity(this.identity),
        });
        this.adminClient = new ServiceBusAdministrationClient(connectionString);
        gracefulTerminationService.register({
            name: 'azureServiceBus',
            priority: 10,
            overwrite: false,
            handler: async () => {
                await this.stop();
            }
        });
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
            this.stoppedEvent = undefined;
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
                            throw new Error(`Expected to have a value for required var '${segment.name}' of path '${path}' when publishing`);
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
        let bodyBuffer: Uint8Array;
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
            body = codec.decode(serviceBusMessage.body) as TypedMessage;
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

