import { MessageHandler } from "./MessageHandler.js";
import { BaseMessageEnvelope, IncomingMessageEnvelope, MessageEnvelope, MessageHeaders } from "./MessageEnvelopes.js";
import { Request, Response, RequestOptions, RequestOptionsPair } from "./Requests.js";
import { TypedMessage } from "./TypedMessage.js";

export type IMessageBus = {
    get privateInboxName(): string;
    registerHandlers(...handlers: MessageHandler[]): void;
    unregisterHandler(handler: MessageHandler): void;
    subscribe(subject: string, consumerGroupName?: string): void;
    publish(subject: string, message: any, headers?: MessageHeaders): void;
    publishEnvelope(message: MessageEnvelope): void;
    publishLocal(message: any, headers?: MessageHeaders): Promise<void> ;
    request(request: TypedMessage, options: RequestOptions): Promise<MessageEnvelope<Response>>;
    requestMany(request: TypedMessage, options: RequestOptions): AsyncGenerator<MessageEnvelope<Response>>;
    requestBatch(requests: RequestOptionsPair[]): AsyncGenerator<MessageEnvelope<Response>>;
    reply(request: IncomingMessageEnvelope<Request>, response: BaseMessageEnvelope<Response>): void;
}