import { Command } from "core-lib";
import { EventHandler } from "./EventHandler.js";

export abstract class GenericEventHandler<T> extends EventHandler {

    process(event: Command): Promise<void> {
        // TODO: validate event
        return this.processTypedEvent(event as any);
    }

    protected abstract processTypedEvent(event: T): Promise<void>;
}