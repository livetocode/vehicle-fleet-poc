import { MessageHandler } from "./MessageHandler.js";
import { BaseMessageEnvelope, IncomingMessageEnvelope, MessageEnvelope, MessageHeaders } from "./MessageEnvelopes.js";
import { Request, Response, RequestOptions, RequestOptionsPair } from "./Requests.js";
import { TypedMessage } from "./TypedMessage.js";
import { ServiceIdentity } from "./ServiceIdentity.js";
import { ProtoBufCodec } from "./ProtoBufRegistry.js";

export type MessageOptions = {
    subject: string;
    headers?: MessageHeaders;
}

export type MessageOptionsPair<TMessage extends TypedMessage = TypedMessage> = [TMessage, MessageOptions];

export type IMessageBus = {
    get identity(): ServiceIdentity;
    get privateInboxName(): string;
    registerHandlers(...handlers: MessageHandler[]): void;
    unregisterHandler(handler: MessageHandler): void;
    registerMessageCodec(messageType: string, codec: ProtoBufCodec): void;
    subscribe(subject: string, consumerGroupName?: string): void;
    publish(subject: string, message: any, headers?: MessageHeaders): void;
    publishBatch(messages: MessageOptionsPair[]): Promise<void>;
    publishEnvelope(message: MessageEnvelope): void;
    publishLocal(message: any, headers?: MessageHeaders): Promise<void> ;
    request(request: TypedMessage, options: RequestOptions): Promise<MessageEnvelope<Response>>;
    requestMany(request: TypedMessage, options: RequestOptions): AsyncGenerator<MessageEnvelope<Response>>;
    requestBatch(requests: RequestOptionsPair[]): AsyncGenerator<MessageEnvelope<Response>>;
    reply(request: IncomingMessageEnvelope<Request>, response: BaseMessageEnvelope<Response>): void;
}