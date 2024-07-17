import { EventHandler } from "./EventHandler.js";

export interface MessageBus {
    init(): Promise<void>;
    publish(subject: string, message: any): void;
    run(subject: string): Promise<void>;
    drain(): Promise<void>;
    registerHandlers(...handlers: EventHandler[]): void;
}
