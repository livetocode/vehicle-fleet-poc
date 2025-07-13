import { MessageEnvelope, IncomingMessageEnvelope, BaseMessageEnvelope } from "./MessageEnvelopes";
import { MessagePath, PublicationMessagePath, SubscriptionMessagePath } from "./MessagePath";
import { MessageSubscription } from "./MessageSubscription";

export type ReceiveMessageCallback = (msg: IncomingMessageEnvelope) => Promise<void>;

export type ReplyToCallback = (request: IncomingMessageEnvelope, response: BaseMessageEnvelope) => Promise<void>;

export type MessageBusDriver = {
    get privateInboxPath(): { publish: PublicationMessagePath; subscribe: SubscriptionMessagePath };
    start(connectionString: string): Promise<void>;
    stop(): Promise<void>;
    waitForClose(): Promise<void>;
    subscribe(subscription: MessageSubscription): void;
    publish(msg: MessageEnvelope): Promise<void>;
    publishBatch(messages: MessageEnvelope[]): Promise<void>;
    renderPath(path: MessagePath): string;
    onReceiveMessage: ReceiveMessageCallback;
    onReplyTo: ReplyToCallback;
}