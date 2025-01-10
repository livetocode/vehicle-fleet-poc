import { EventHandler } from "./EventHandler.js";
import { MessageEnvelope } from "./MessageEnvelope.js";
import { Request, Response, RequestOptions, RequestOptionsPair } from "./Requests.js";
import { TypedMessage } from "./TypedMessage.js";

export type IMessageBus = {
    get privateInboxName(): string;
    registerHandlers(...handlers: EventHandler[]): void;
    unregisterHandler(handler: EventHandler): void;
    subscribe(subject: string, consumerGroupName?: string): void;
    publish(subject: string, message: any): void;
    publishEnvelope(message: MessageEnvelope): void;
    request(request: TypedMessage, options: RequestOptions): Promise<MessageEnvelope<Response>>;
    requestMany(request: TypedMessage, options: RequestOptions): AsyncGenerator<MessageEnvelope<Response>>;
    requestBatch(requests: RequestOptionsPair[]): AsyncGenerator<MessageEnvelope<Response>>;
    reply(request: Request, response: Response): void;
}