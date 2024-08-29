import { EventHandler } from "./EventHandler.js";

export interface MessageBus {
    start(): Promise<void>;
    publish(subject: string, message: any): void;
    watch(subject: string, consumerGroupName?: string): Promise<void>;
    stop(): Promise<void>;
    registerHandlers(...handlers: EventHandler[]): void;
}
