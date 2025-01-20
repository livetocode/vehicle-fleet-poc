import { MessageHandler } from "./MessageHandler.js";
import { IncomingMessageEnvelope } from "./MessageEnvelopes.js";
import { TypedMessage } from "./TypedMessage.js";

export class LambdaMessageHandler<TEvent extends TypedMessage = TypedMessage> extends MessageHandler<TEvent> {
    constructor(private _messageTypes: string[], private handler: (e: TEvent) => Promise<void>) {
        super();
    }

    get messageTypes(): string[] {
        return this._messageTypes;
    }

    process(msg: IncomingMessageEnvelope<TEvent>): Promise<void> {
        return this.handler(msg.body);
    }
}
