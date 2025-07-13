// export type MessageSubscription = {
//     subject: string;
//     consumerGroupName?: string;
// }

import { MessageSubscription } from "./MessageSubscription";

export class MessageSubscriptions {
    private subscriptions = new Map<string, MessageSubscription>();

    add(subscription: MessageSubscription): boolean {
        const key = makeKey(subscription)
        if (this.subscriptions.has(key)) {
            return false;
        }
        this.subscriptions.set(key, subscription);
        return true;
    }

    entries() {
        return [...this.subscriptions.values()];
    }

    get size() {
        return this.subscriptions.size;
    }
}

function makeKey(subscription: MessageSubscription) {
    const path = subscription.path.toString();
    return `${subscription.type}:${path}`;
}
