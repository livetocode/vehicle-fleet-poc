import { MessageHandler } from "./MessageHandler";

export class MessageHandlerRegistry {
    private handlers = new Map<string, MessageHandler[]>();

    register(handler: MessageHandler) {
        for (const eventType of handler.eventTypes) {
            let eventTypeHandlers = this.handlers.get(eventType);
            if (!eventTypeHandlers) {
                eventTypeHandlers = [];
                this.handlers.set(eventType, eventTypeHandlers);
            }
            eventTypeHandlers.push(handler);
        }
    }

    unregister(handler: MessageHandler): void {
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

    find(eventType: string): MessageHandler[] | undefined {
        return this.handlers.get(eventType);
    }

    get size() {
        return this.handlers.size;
    }
}