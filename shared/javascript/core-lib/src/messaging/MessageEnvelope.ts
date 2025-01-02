export type MessageHeaders = Record<string, string | string[]>;

export type ReplyMessageCallback = (msg: MessageEnvelope) => void;

export type MessageEnvelope<T = any> = {
    subject: string;
    headers: MessageHeaders;
    body: T;
    reply: ReplyMessageCallback;
}
