import { MessageEnvelope, IncomingMessageEnvelope, BaseMessageEnvelope } from "./MessageEnvelopes";

export type ReceiveMessageCallback = (msg: IncomingMessageEnvelope) => Promise<void>;

export type ReplyToCallback = (request: IncomingMessageEnvelope, response: BaseMessageEnvelope) => void;

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