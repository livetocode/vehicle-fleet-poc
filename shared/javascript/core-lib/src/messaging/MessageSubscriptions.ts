export type MessageSubscription = {
    subject: string;
    consumerGroupName?: string;
}

export class MessageSubscriptions {
    private subscriptions = new Map<string, MessageSubscription>();

    add(subscription: MessageSubscription): boolean {
        if (this.subscriptions.has(subscription.subject)) {
            return false;
        }
        this.subscriptions.set(subscription.subject, subscription);
        return true;
    }

    find(subject: string): MessageSubscription | undefined {
        return this.subscriptions.get(subject);
    }

    entries() {
        return [...this.subscriptions.values()];
    }

    get size() {
        return this.subscriptions.size;
    }
}