import { EventHandler } from "./EventHandler.js";

export interface MessageBus {
    get privateInboxName(): string;
    start(): Promise<void>;
    publish(subject: string, message: any): void;
    subscribe(subject: string, consumerGroupName?: string): void;
    stop(): Promise<void>;
    waitForClose(): Promise<void>;
    registerHandlers(...handlers: EventHandler[]): void;
}
