import { MessageHandler } from "./MessageHandler.js";
import { BaseMessageEnvelope, IncomingMessageEnvelope, MessageEnvelope, MessageHeaders } from "./MessageEnvelopes.js";
import { Request, Response, RequestOptions, RequestOptionsPair } from "./Requests.js";
import { TypedMessage } from "./TypedMessage.js";
import { ServiceIdentity } from "./ServiceIdentity.js";
import { ProtoBufCodec } from "./ProtoBufRegistry.js";
import { MessageSubscription } from "./MessageSubscription.js";
import { PublicationMessagePath } from "./MessagePath.js";

export type MessageOptions = {
    path: PublicationMessagePath;
    headers?: MessageHeaders;
}

export type MessageOptionsPair<TMessage extends TypedMessage = TypedMessage> = [TMessage, MessageOptions];

export type MessageBusFeatures = {
    supportsAbstractSubjects: boolean;
    supportsTemporaryQueues: boolean;
}
export type ConnectionStatus = 'stopped' | 'connecting' | 'connected' | 'error';

export type ConnectionInfo = {
    status: ConnectionStatus;
    connectionError?: any;
}

export type IMessageBus = {
    get identity(): ServiceIdentity;
    get features(): MessageBusFeatures;
    get connectionInfo(): ConnectionInfo;
    get privateInbox(): PublicationMessagePath;
    registerHandlers(...handlers: MessageHandler[]): void;
    unregisterHandler(handler: MessageHandler): void;
    registerMessageCodec(messageType: string, codec: ProtoBufCodec): void;
    subscribe(subscription: MessageSubscription): void;
    publish(path: PublicationMessagePath, message: any, headers?: MessageHeaders): Promise<void>;
    publishBatch(messages: MessageOptionsPair[]): Promise<void>;
    publishEnvelope(message: MessageEnvelope): Promise<void>;
    publishLocal(message: any, headers?: MessageHeaders): Promise<void> ;
    request(request: TypedMessage, options: RequestOptions): Promise<MessageEnvelope<Response>>;
    requestMany(request: TypedMessage, options: RequestOptions): AsyncGenerator<MessageEnvelope<Response>>;
    requestBatch(requests: RequestOptionsPair[]): AsyncGenerator<MessageEnvelope<Response>>;
    reply(request: IncomingMessageEnvelope<Request>, response: BaseMessageEnvelope<Response>): Promise<void>;
}