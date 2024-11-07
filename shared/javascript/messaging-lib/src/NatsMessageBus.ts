import { JSONCodec, NatsConnection, connect } from "nats";
import { MessageBus } from "./MessageBus.js";
import { NatsHubConfig, Stopwatch } from "core-lib";
import { Logger } from "core-lib";
import { EventHandler } from "./EventHandler.js";
import prom_client from 'prom-client';

const message_sent_counter = new prom_client.Counter({
    name: 'vehicles_message_sent_total',
    help: 'number of messages sent by the vehicle services',
    labelNames: ['subject', 'message_type'],
});

const message_received_counter = new prom_client.Counter({
    name: 'vehicles_message_received_total',
    help: 'number of messages received by the vehicle services',
    labelNames: ['subject', 'message_type', 'status'],
});

const message_received_duration_msec = new prom_client.Gauge({
    name: 'vehicles_message_received_duration',
    help: 'number of messages received by the vehicle services',
    labelNames: ['subject', 'message_type', 'status'],
});

export class NatsMessageBus implements MessageBus {
    private connection?: NatsConnection;
    private codec = JSONCodec();
    private handlers = new Map<string, EventHandler[]>();
    private uid = crypto.randomUUID();

    constructor(private hub: NatsHubConfig, private appName: string, private logger: Logger) {
    }

    get privateInboxName(): string {
        return `inbox.${this.appName}.${this.uid}`;
    }

    async start(): Promise<void> {
        this.connection = await connect({ servers: this.hub.protocols.nats.servers });
        this.logger.info('NATS connection is ready.');
    }
    
    publish(subject: string, message: any): void {
        this.connection?.publish(subject, this.codec.encode(message));
        message_sent_counter.inc({
            subject: this.normalizeSubject(subject), 
            message_type: message.type ?? 'unknown',
        })
    }

    async stop(): Promise<void> {
        if (this.connection) {
            await this.connection.drain();
            this.connection = undefined;
        }
    }
    
    async watch(subject: string, consumerGroupName?: string): Promise<void> {
        if (!this.connection) {
            throw new Error('Expected MessageBus to be started');
        }
        if (this.handlers.size === 0) {
            throw new Error('Expected MessageBus to have registered event handlers');
        }

        this.logger.info(`NATS is listening to '${subject}' messages${ consumerGroupName ? ` for group '${consumerGroupName}'` : ''}...`);
        const sub = this.connection.subscribe(subject, { queue: consumerGroupName });
        const watch = new Stopwatch();
        watch.start();
        let messageCount = 0;
        for await (const m of sub) {
            messageCount++;
            const data: any = this.codec.decode(m.data);
            const handlers = this.handlers.get(data.type);
            if (handlers) {
                for (const handler of handlers) {
                    const msgProcessingWatch = new Stopwatch();
                    msgProcessingWatch.start();
                    let status = 'unknown';
                    try {
                        await handler.process(data);
                        status = 'success';
                    } catch(err) {
                        status = 'error';
                        this.logger.error('NATS handler failed to process command', data, err);
                    }
                    msgProcessingWatch.stop();
                    message_received_counter.inc({
                        subject: this.normalizeSubject(subject), 
                        message_type: data.type ?? 'unknown',
                        status,
                    });
                    message_received_duration_msec.set({
                        subject: this.normalizeSubject(subject), 
                        message_type: data.type ?? 'unknown',
                        status,
                    }, msgProcessingWatch.elapsedTimeInMS());
                }                
            } else {
                message_received_counter.inc({
                    subject: this.normalizeSubject(subject), 
                    message_type: data.type ?? 'unknown',
                    status: 'ignored',
                });
            }
        }
        watch.stop();
        this.logger.info(`NATS subscription for '${subject}' closed after processing `, messageCount, " messages in ", watch.elapsedTimeAsString());
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

    private normalizeSubject(subject: string) {
        if (subject.startsWith('inbox.')) {
            const idx = subject.lastIndexOf('.');
            return subject.slice(0, idx);
        }
        return subject;
    }
}

