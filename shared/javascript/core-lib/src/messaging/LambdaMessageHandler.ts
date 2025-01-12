import { MessageHandler } from "./MessageHandler.js";
import { IncomingMessageEnvelope } from "./MessageEnvelopes.js";
import { TypedMessage } from "./TypedMessage.js";

export class LambdaMessageHandler<TEvent extends TypedMessage = TypedMessage> extends MessageHandler<TEvent> {
    constructor(private _eventTypes: string[], private handler: (e: TEvent) => Promise<void>) {
        super();
    }

    get eventTypes(): string[] {
        return this._eventTypes;
    }

    process(msg: IncomingMessageEnvelope<TEvent>): Promise<void> {
        return this.handler(msg.body);
    }
}
