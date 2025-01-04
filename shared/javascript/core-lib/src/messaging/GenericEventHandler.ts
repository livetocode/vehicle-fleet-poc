import { EventHandler } from "./EventHandler.js";
import { TypedMessage } from "./TypedMessage.js";

export abstract class GenericEventHandler<T extends TypedMessage> extends EventHandler {

    abstract get eventTypes(): string[];

    process(event: any): Promise<void> {
        return this.processTypedEvent(event);
    }

    protected abstract processTypedEvent(event: T): Promise<void>;
}
