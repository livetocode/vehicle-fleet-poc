import { IncomingMessageEnvelope, Logger, MessageBusDriver, MessageEnvelope, MessageHeaders, ProtoBufRegistry, ReceiveMessageCallback, ReplyToCallback, sleep, Stopwatch, Subscription } from "core-lib";
import { JSONCodec, Match, Msg, MsgHdrs, NatsConnection, connect, headers } from "nats";
import { gracefulTerminationService } from "./GracefulTerminationService.js";

const MessageTypeHeader = 'proto/type';

export class NatsMessageBusDriver implements MessageBusDriver {
    private connection?: NatsConnection;
    private codec = JSONCodec();
    private watch = new Stopwatch();

    constructor (
        public readonly onReceiveMessage: ReceiveMessageCallback, 
        public readonly onReplyTo: ReplyToCallback, 
        private logger: Logger,
        private protoBufRegistry: ProtoBufRegistry,
    ) {}

    async start(connectionString: string): Promise<void> {
        const servers = (process.env.NATS_SERVERS ?? connectionString).split(',');
        for (let i = 0; i < 30; i++) {
            try {
                this.logger.info(`NATS connection attempt #${i} on servers ${servers}`);
                this.connection = await connect({ servers });
                this.logger.info('NATS connection is ready.');
                gracefulTerminationService.register({
                    name: 'nats',
                    priority: 10,
                    overwrite: false,
                    handler: async () => {
                        await this.stop();
                    }
                });
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
    
    async flush(): Promise<void> {
        if (this.connection) {
            await this.connection.flush();
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
        let data: Uint8Array;
        const codec = this.protoBufRegistry.find(msg.body.type);
        if (codec) {
            data = codec.encode(msg.body);
            msg.headers[MessageTypeHeader] = msg.body.type;
        } else {
            data = this.codec.encode(msg.body);
        }
        this.connection?.publish(msg.subject, data, { headers: convertToMsgHdrs(msg.headers)});
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
                onReplyTo(this, replyMsg);
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
