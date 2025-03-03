import { IncomingMessageEnvelope } from "./MessageEnvelopes.js";
import { TypedMessage } from "./TypedMessage.js";

export abstract class MessageHandler<TEvent extends TypedMessage = TypedMessage> {
    get isNonBlocking() {
        return false;
    }

    get name(): string {
        return this.constructor.name;
    }

    abstract get description(): string;
    
    abstract get messageTypes(): string[];
    
    abstract process(msg: IncomingMessageEnvelope<TEvent>): Promise<void>;
}

export type MessageHandlerContext = {
    msg: IncomingMessageEnvelope;
    handler: MessageHandler;
}

export type ActiveMessageHandlers = Map<string, MessageHandlerContext>;
