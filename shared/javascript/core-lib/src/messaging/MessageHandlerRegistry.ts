import { MessageHandler } from "./MessageHandler";

export class MessageHandlerRegistry {
    private handlersByMessageType = new Map<string, MessageHandler[]>();

    register(handler: MessageHandler) {
        for (const eventType of handler.messageTypes) {
            let eventTypeHandlers = this.handlersByMessageType.get(eventType);
            if (!eventTypeHandlers) {
                eventTypeHandlers = [];
                this.handlersByMessageType.set(eventType, eventTypeHandlers);
            }
            eventTypeHandlers.push(handler);
        }
    }

    unregister(handler: MessageHandler): void {
        for (const type of handler.messageTypes) {
            const handlers = this.handlersByMessageType.get(type);
            if (handlers) {
                const idx = handlers?.indexOf(handler);
                if (idx >= 0) {
                    handlers?.splice(idx, 1);
                }    
            }
        }
    }

    find(eventType: string): MessageHandler[] | undefined {
        return this.handlersByMessageType.get(eventType);
    }

    handlers(): MessageHandler[] {
        const result: MessageHandler[] = [];
        for (const val of this.handlersByMessageType.values()) {
            for (const handler of val) {
                if (!result.includes(handler)) {
                    result.push(handler);
                }
            }
        }
        return result;
    }

    get size() {
        return this.handlersByMessageType.size;
    }
}