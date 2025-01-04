import { TypedMessage } from "./TypedMessage";

export type MessageHeaders = Record<string, string | string[]>;

export type ReplyMessageCallback = (msg: ReplyMessageEnvelope) => void;

export type MessageEnvelope<T extends TypedMessage = TypedMessage> = {
    subject: string;
    headers: MessageHeaders;
    body: T;
    reply: ReplyMessageCallback;
    shouldCancel?: boolean;
}

export type ReplyMessageEnvelope<T = any> = {
    headers: MessageHeaders;
    body: T;
}