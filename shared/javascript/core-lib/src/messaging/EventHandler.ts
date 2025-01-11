import { IncomingMessageEnvelope } from "./MessageEnvelopes.js";
import { TypedMessage } from "./TypedMessage.js";

export abstract class EventHandler<TEvent extends TypedMessage = TypedMessage> {
    get isNonBlocking() {
        return false;
    }

    abstract get eventTypes(): string[];
    
    abstract process(msg: IncomingMessageEnvelope<TEvent>): Promise<void>;
}

export type EventHandlerContext = {
    msg: IncomingMessageEnvelope;
    handler: EventHandler;
}

export type ActiveEventHandlers = Map<string, EventHandlerContext>;
