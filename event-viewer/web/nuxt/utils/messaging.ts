import { JSONCodec, connect, type NatsConnection } from "nats.ws";
import type {NatsHubConfig } from "core-lib";
import { Stopwatch } from "core-lib";
import type { Logger } from "core-lib";

export abstract class EventHandler {
    abstract get eventTypes(): string[];
    abstract process(event: any): Promise<void>;
}

export class LambdaEventHandler implements EventHandler {
    constructor(private _eventTypes: string[], private handler: (e: any) => Promise<void>) {}

    get eventTypes(): string[] {
        return this._eventTypes;
    }

    process(event: any): Promise<void> {
        return this.handler(event);
    }
}

export interface MessageBus {
    get privateInboxName(): string;
    start(): Promise<void>;
    publish(subject: string, message: any): void;
    watch(subject: string): Promise<void>;
    stop(): Promise<void>;
    registerHandlers(...handlers: EventHandler[]): void;
    unregisterHandler(handler: EventHandler): void;
}

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
        this.logger.info('NATS connecting...');
        this.connection = await connect({ servers: this.hub.protocols.websockets.servers });
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
    
    async watch(subject: string): Promise<void> {
        if (!this.connection) {
            throw new Error('Expected MessageBus to be initialized');
        }

        this.logger.info(`NATS is listening to '${subject}' messages...`);
        const sub = this.connection.subscribe(subject);
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
                        this.logger.error('NATS handler failed to process command', data, err);
                    }
                }                
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
    
    unregisterHandler(handler: EventHandler): void {
        for (const type of handler.eventTypes) {
            const handlers = this.handlers.get(type);
            if (handlers) {
                const idx = handlers?.indexOf(handler);
                if (idx >= 0) {
                    handlers?.splice(idx, 1);
                }    
            }
        }
    }

}
