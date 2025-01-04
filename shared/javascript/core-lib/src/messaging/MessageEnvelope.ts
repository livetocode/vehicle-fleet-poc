import { TypedMessage } from "./TypedMessage";

export type MessageHeaders = Record<string, string | string[]>;

export type ReplyMessageCallback = (msg: MessageEnvelope) => void;

export type MessageEnvelope<T extends TypedMessage = TypedMessage> = {
    subject: string;
    headers: MessageHeaders;
    body: T;
    reply: ReplyMessageCallback;
}
