import { SubscriptionMessagePath } from "./MessagePath";

export type MessageSubscription = {
    type: 'queue' | 'topic';
    path: SubscriptionMessagePath;
}
