import { TypedMessage } from "./TypedMessage";

export type MessageHeaders = Record<string, string | string[]>;

export type ReplyMessageCallback = (msg: BaseMessageEnvelope) => void;

export type BaseMessageEnvelope<T extends TypedMessage = TypedMessage> = {
    headers: MessageHeaders;
    body: T;    
}

export type MessageEnvelope<T extends TypedMessage = TypedMessage> = BaseMessageEnvelope<T> & {
    subject: string;
}

export type IncomingMessageEnvelope<T extends TypedMessage = TypedMessage> = MessageEnvelope<T> & {
    reply: ReplyMessageCallback;
    shouldCancel?: boolean;
}

