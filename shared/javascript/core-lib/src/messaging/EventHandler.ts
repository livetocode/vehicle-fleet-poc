import { MessageEnvelope } from "./MessageEnvelope.js";
import { TypedMessage } from "./TypedMessage.js";

export abstract class EventHandler<TEvent extends TypedMessage = TypedMessage> {
    get isNonBlocking() {
        return false;
    }

    abstract get eventTypes(): string[];
    
    abstract process(msg: MessageEnvelope<TEvent>): Promise<void>;
}

export type EventHandlerContext = {
    msg: MessageEnvelope;
    handler: EventHandler;
}

export type ActiveEventHandlers = Map<string, EventHandlerContext>;
