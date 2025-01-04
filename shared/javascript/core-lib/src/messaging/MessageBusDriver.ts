import { MessageEnvelope, ReplyMessageEnvelope } from "./MessageEnvelope";

export type ReceiveMessageCallback = (msg: MessageEnvelope) => Promise<void>;

export type ReplyToCallback = (request: MessageEnvelope, response: ReplyMessageEnvelope) => void;

export type Subscription = {
    subject: string;
    consumerGroupName?: string;
}

export type MessageBusDriver = {
    start(connectionString: string): Promise<void>;
    stop(): Promise<void>;
    waitForClose(): Promise<void>;
    subscribe(subscription: Subscription): void;
    publish(msg: MessageEnvelope): void;
    onReceiveMessage: ReceiveMessageCallback;
    onReplyTo: ReplyToCallback;
}