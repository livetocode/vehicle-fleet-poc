import { JSONCodec, NatsConnection, connect } from "nats";
import { MessageBus } from "./MessageBus.js";
import { NatsHubConfig, Stopwatch } from "core-lib";
import { Logger } from "core-lib";
import { EventHandler } from "./EventHandler.js";

export class NatsMessageBus implements MessageBus {
    private connection?: NatsConnection;
    private codec = JSONCodec();
    private handlers = new Map<string, EventHandler[]>();
    private uid = crypto.randomUUID();

    constructor(private hub: NatsHubConfig, private logger: Logger) {
    }

    get privateInboxName(): string {
        return `inbox.${this.uid}`;
    }

    async start(): Promise<void> {
        this.connection = await connect({ servers: this.hub.protocols.nats.servers });
        this.logger.info('NATS connection is ready.');
    }
    
    publish(subject: string, message: any): void {
        this.connection?.publish(subject, this.codec.encode(message));
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

        this.logger.info(`Listening to '${subject}' messages${ consumerGroupName ? ` for group '${consumerGroupName}'` : ''}...`);
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
                    try {
                        await handler.process(data);
                    } catch(err) {
                        this.logger.error('Handler failed to process command', data, err);
                    }
                }                
            }
        }
        watch.stop();
        this.logger.info(`Subscription for '${subject}' closed after processing `, messageCount, " messages in ", watch.elapsedTimeAsString());
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

}