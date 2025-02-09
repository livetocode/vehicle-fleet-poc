import { MessageHandler } from "./MessageHandler.js";
import { IncomingMessageEnvelope } from "./MessageEnvelopes.js";
import { TypedMessage } from "./TypedMessage.js";

export class LambdaMessageHandler<TEvent extends TypedMessage = TypedMessage> extends MessageHandler<TEvent> {
    constructor(private _messageTypes: string[], private _description: string, private handler: (e: TEvent) => Promise<void>) {
        super();
    }

    get name(): string {
        return  `Lambda<${this.messageTypes.join(', ')}>`;
    }

    get description(): string {
        return this._description;
    }

    get messageTypes(): string[] {
        return this._messageTypes;
    }

    process(msg: IncomingMessageEnvelope<TEvent>): Promise<void> {
        return this.handler(msg.body);
    }
}
