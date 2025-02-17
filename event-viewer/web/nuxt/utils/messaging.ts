import { JSONCodec, connect, type Msg, type MsgHdrs, type NatsConnection, headers } from "nats.ws";
import type {IncomingMessageEnvelope, MessageEnvelope, MessageHeaders, ReceiveMessageCallback, ReplyToCallback, Subscription } from "core-lib";
import { type MessageBusDriver, MessageBus, NoopMessageBusMetrics, sleep, Stopwatch } from "core-lib";
import type { Logger, ServiceIdentity } from "core-lib";

export class NatsMessageBus extends MessageBus {

    constructor(identity: ServiceIdentity, logger: Logger) {
        const driver = new NatsMessageBusDriver(
            (msg) => this.messageDispatcher.dispatch(msg),
            (req, res) => this.envelopeReply(req, res),
            logger,
        );
        super(identity, logger, new NoopMessageBusMetrics(), driver);
    }
}

export class NatsMessageBusDriver implements MessageBusDriver {
    private connection?: NatsConnection;
    private codec = JSONCodec();
    private _watch = new Stopwatch();

    constructor (
        public readonly onReceiveMessage: ReceiveMessageCallback, 
        public readonly onReplyTo: ReplyToCallback, 
        private logger: Logger,
    ) {}

    async start(connectionString: string): Promise<void> {
        const servers = connectionString.split(',');
        for (let i = 0; i < 30; i++) {
            try {
                this.logger.info(`NATS connection attempt #${i} on servers ${servers}`);
                this.connection = await connect({ servers });
                this.logger.info('NATS connection is ready.');
                this._watch.restart();
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
            this._watch.stop();
            this.logger.info(`NATS connection closed after processing `, stats.inMsgs, " messages in ", this._watch.elapsedTimeAsString());
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

    subscribe(subscription: Subscription): void {
        this.doSubscribe(subscription).catch(err => {
            this.logger.error(err);
        });
    }    

    private async doSubscribe(subscription: Subscription): Promise<void> {
        if (!this.connection) {
            throw new Error('Expected MessageBus to be started');
        }

        this.logger.info(`NATS subscribed to '${subscription.subject}'${ subscription.consumerGroupName ? ` for group '${subscription.consumerGroupName}'` : ''}`);
        for await (const msg of this.connection.subscribe(subscription.subject, { queue: subscription.consumerGroupName })) {
            const msgEnv = this.createMessageEnvelope(subscription.subject, msg);
            try {
                await this.onReceiveMessage(msgEnv);
            } catch(err) {
                this.logger.error('onReceiveMessage failed', err);
            }
        }
    }
    
    publish(msg: MessageEnvelope): void {
        this.connection?.publish(msg.subject, this.codec.encode(msg.body), { headers: convertToMsgHdrs(msg.headers)});
    }

    private createMessageEnvelope(subject: string, msg: Msg): IncomingMessageEnvelope {
        const data: any = this.codec.decode(msg.data);
        const onReplyTo = this.onReplyTo;
        return {
            subject: msg.subject,
            subscribedSubject: subject,
            headers: convertFromMsgHdrs(msg.headers),
            body: data,
            reply(replyMsg) {
                onReplyTo(this, replyMsg);
            }
        };
    }
}

function convertFromMsgHdrs(source?: MsgHdrs): MessageHeaders {
    const result: MessageHeaders = {};
    if (source) {
        for (const [k, v] of source) {
            result[k] = v;
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
