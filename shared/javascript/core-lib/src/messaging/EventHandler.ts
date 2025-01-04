import { MessageEnvelope } from "./MessageEnvelope.js";
import { TypedMessage } from "./TypedMessage";

export abstract class EventHandler<TEvent extends TypedMessage = TypedMessage> {
    abstract get eventTypes(): string[];
    abstract process(msg: MessageEnvelope<TEvent>): Promise<void>;
}
