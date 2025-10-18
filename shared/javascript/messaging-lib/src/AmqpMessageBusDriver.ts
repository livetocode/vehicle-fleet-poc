
import { IncomingMessageEnvelope, Logger, MessageBusDriver, MessageEnvelope, MessagePath, MessageSubscription, ProtoBufRegistry, PublicationMessagePath, randomUUID, ReceiveMessageCallback, ReplyPath, ReplyToCallback, ServiceIdentity, sleep, Stopwatch, SubscriptionMessagePath } from "core-lib";
import { Channel, ChannelModel, connect, ConsumeMessage } from "amqplib";
import { gracefulTerminationService } from "./GracefulTerminationService.js";

const MessageTypeHeader = 'proto/type';

export class AmqpMessageBusDriver implements MessageBusDriver {
    private uid = randomUUID();
    private model?: ChannelModel;
    private sendChannel?: Channel;
    private watch = new Stopwatch();

    constructor(
        public readonly onReceiveMessage: ReceiveMessageCallback,
        public readonly onReplyTo: ReplyToCallback,
        private identity: ServiceIdentity,
        private logger: Logger,
        private protoBufRegistry: ProtoBufRegistry,
    ) { }

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
        const cs = process.env.AMQP_CONNECTION_STRING ?? connectionString;
        for (let i = 0; i < 30; i++) {
            try {
                this.logger.info(`AMQP connection attempt #${i} on connectAmqp ${cs}`);
                this.model = await connect(cs);
                if (!this.model) {
                    throw new Error('Could not connect to AMQP server');
                }
                this.sendChannel = await this.model.createChannel();
                this.logger.info('AMQP connection is ready.');
                gracefulTerminationService.register({
                    name: 'amqp',
                    priority: 10,
                    overwrite: false,
                    handler: async () => {
                        await this.stop();
                    }
                });
                this.watch.restart();
                return;
            } catch (err: any) {
                this.logger.error(`Could not connect to AMQP server: ${err}`);
                await sleep(1000);
            }
        }
        throw new Error('Could not connect to AMQP server after multiple attemps');
    }

    async stop(): Promise<void> {
        if (this.model) {
            await this.model.close();
            this.model = undefined;
            this.sendChannel = undefined;
            this.watch.stop();
            this.logger.info(`AMQP connection closed after ${this.watch.elapsedTimeAsString()}`);
        }
    }

    async waitForClose(): Promise<void> {
        if (this.model) {
            return new Promise(resolve => {
                this.model?.on('close', () => {
                    this.logger.info('AMQP connection closed');
                    resolve();
                });
            });
        }
    }

    subscribe(subscription: MessageSubscription): void {
        this.doSubscribe(subscription).catch(err => {
            this.logger.error(err);
        });
    }

    private async doSubscribe(subscription: MessageSubscription): Promise<void> {
        if (!this.model) {
            throw new Error('Expected MessageBus to be started');
        }

        const subject = this.renderPath(subscription.path);
        const receiveChannel = await this.model.createChannel();
        receiveChannel.prefetch(1);
        const isTopic = subscription.type === 'topic';
        const queueName = isTopic ? `events.${this.identity.name}-${this.uid}` : `queue.${subject}`;
        const q = await receiveChannel.assertQueue(queueName, { exclusive: isTopic, durable: false, autoDelete: true });
        const exchange_name = 'vehicles';
        await receiveChannel.assertExchange(exchange_name, 'topic', { durable: false });
        await receiveChannel.bindQueue(q.queue, exchange_name, subject);

        this.logger.info(`AMQP subscribed to ${subscription.type}: ${subject}'`);

        await receiveChannel.consume(q.queue, (msg: ConsumeMessage | null) => {
            if (msg) {
                const msgEnv = this.createMessageEnvelope(subject, msg);
                this.onReceiveMessage(msgEnv).catch(err => {
                    this.logger.error('onReceiveMessage failed', err);
                });
            }
        }, { noAck: true });
    }

    publish(msg: MessageEnvelope): Promise<void> {
        this.doPublish(msg);
        return Promise.resolve();
    }

    doPublish(msg: MessageEnvelope): void {
        if (!this.sendChannel) {
            throw new Error('Expected to have established a connexion!');
        }
        let data: Buffer;
        const codec = this.protoBufRegistry.find(msg.body.type);
        if (codec) {
            data = Buffer.from(codec.encode(msg.body));
            msg.headers[MessageTypeHeader] = msg.body.type;
        } else {
            data = Buffer.from(JSON.stringify(msg.body));
        }
        this.sendChannel.publish('vehicles', msg.subject, data, { headers: msg.headers });
    }

    async publishBatch(messages: MessageEnvelope[]): Promise<void> {
        for (const msg of messages) {
            this.doPublish(msg);
        }
    }

    renderPath(path: MessagePath): string {
        if (path instanceof PublicationMessagePath) {
            const segments: string[] = [];
            for (const segment of path.segments) {
                if (segment.type === 'string') {
                    segments.push(segment.value);
                } else if (segment.type === 'var') {
                    const val = path.vars[segment.name];
                    if (val) {
                        segments.push(val);
                    } else {
                        throw new Error(`Expected to have a value for var '${segment.name}' of path '${path}' when publishing`);
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
                    segments.push('#');
                }
            }
            return segments.join('.');
        } else if (path instanceof ReplyPath) {
            return path.replyTo;
        } else {
            throw new Error(`Unknown message path: ${path.constructor.name}`);
        }
    }

    private createMessageEnvelope(subject: string, msg: ConsumeMessage): IncomingMessageEnvelope {
        const messageType = msg.properties.headers?.[MessageTypeHeader];
        let data: any;
        if (messageType) {
            const codec = this.protoBufRegistry.get(messageType as string);
            data = codec.decode(msg.content);
        } else {
            data = JSON.parse(msg.content.toString());
        }
        // console.log(msg.fields, data);
        const onReplyTo = this.onReplyTo;
        return {
            subject: msg.fields.routingKey,
            subscribedSubject: subject,
            headers: msg.properties.headers || {},
            body: data,
            reply(replyMsg) {
                return onReplyTo(this, replyMsg);
            }
        };
    }
}
