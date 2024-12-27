import { JSONCodec, Msg, NatsConnection, connect } from "nats";
import { MessageBus } from "./MessageBus.js";
import { NatsHubConfig, Stopwatch } from "core-lib";
import { Logger, sleep } from "core-lib";
import { EventHandler } from "./EventHandler.js";
import prom_client from 'prom-client';
import { gracefulTerminationService } from "./GracefulTerminationService.js";

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
    private _watch = new Stopwatch();

    constructor(private hub: NatsHubConfig, private appName: string, private logger: Logger) {
    }

    get privateInboxName(): string {
        return `inbox.${this.appName}.${this.uid}`;
    }

    async start(): Promise<void> {
        const servers = process.env.NATS_SERVERS ? process.env.NATS_SERVERS.split(',') : this.hub.protocols.nats.servers;
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
                this._watch.restart();
                return;
            } catch(err: any) {
                this.logger.error(`Could not connect to NATS server: ${err}`);
                await sleep(1000);
            }
        }
        throw new Error('Could not connect to NATS server after multiple attemps');
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

    subscribe(subject: string, consumerGroupName?: string): void {
        if (!this.connection) {
            throw new Error('Expected MessageBus to be started');
        }
        if (this.handlers.size === 0) {
            throw new Error('Expected MessageBus to have registered event handlers');
        }

        this.logger.info(`NATS subscribed to '${subject}'${ consumerGroupName ? ` for group '${consumerGroupName}'` : ''}`);
        this.connection.subscribe(subject, { 
            queue: consumerGroupName,
            callback: (err, msg) => {
                if (err) {
                    this.logger.error(`Subscription callback failed`, err);
                } else {
                    this.dispatchMessage(subject, msg).catch(err => {
                        this.logger.error('dispatchMessage failed', err);
                    });
                }
            },
        });
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

    private async dispatchMessage(subject: string, msg: Msg) {
        const data: any = this.codec.decode(msg.data);
        const handlers = this.handlers.get(data.type);
        if (handlers) {
            for (const handler of handlers) {
                const watch = new Stopwatch();
                watch.start();
                let status = 'unknown';
                try {
                    await handler.process(data);
                    status = 'success';
                } catch(err) {
                    status = 'error';
                    this.logger.error('NATS handler failed to process command', data, err);
                }
                watch.stop();
                message_received_counter.inc({
                    subject: this.normalizeSubject(subject), 
                    message_type: data.type ?? 'unknown',
                    status,
                });
                message_received_duration_msec.set({
                    subject: this.normalizeSubject(subject), 
                    message_type: data.type ?? 'unknown',
                    status,
                }, watch.elapsedTimeInMS());
            }                
        } else {
            message_received_counter.inc({
                subject: this.normalizeSubject(subject), 
                message_type: data.type ?? 'unknown',
                status: 'ignored',
            });
        }
    }
}

