import type { Logger, MessageBus, MessageSubscription, MessageHandlerInfo } from "core-lib";


export type Subscription = MessageSubscription & {
    id: number;
    services: string[];
}

export type Handler = MessageHandlerInfo & {
    id: number;
    services: string[];    
}

export class MessagesViewModel {
    subscriptions = ref<Subscription[]>([]);
    handlers = ref<Handler[]>([]);
    isFetching = ref(false);
    
    constructor(private _messageBus: MessageBus, private logger: Logger) {}

    async init(): Promise<void> {
        await this.fetch();
    }

    async dispose(): Promise<void> {
    }

    refresh() {
        this.fetch().catch(err => this.logger.error(err));
    }

    async fetch() {
        this.isFetching.value = true;
        try {
            const subscriptions: Subscription[] = [];
            const handlers: Handler[] = [];
            let nextSubscriptionId = 0;
            let nextHandlerId = 0;
            for await (const resp of this._messageBus.info({ timeout: 1000 })) {
                for (const sub of resp.subscriptions) {
                    if (!sub.subject.startsWith('inbox.')) {
                        const item = subscriptions.find(x => x.subject === sub.subject && x.consumerGroupName === sub.consumerGroupName);
                        if (item) {
                            if (!item.services.includes(resp.identity.name)) {
                                item.services.push(resp.identity.name)
                            }
                        } else {
                            nextSubscriptionId += 1
                            subscriptions.push({
                                id: nextSubscriptionId,
                                ...sub,
                                services: [resp.identity.name],
                            });    
                        }    
                    }
                }
                for (const h of resp.handlers) {
                    const item = handlers.find(x => x.name === h.name && x.messageTypes.toString() === h.messageTypes.toString());
                    if (item) {
                        if (!item.services.includes(resp.identity.name)) {
                            item.services.push(resp.identity.name)
                        }
                    } else {
                        nextHandlerId += 1
                        handlers.push({
                            id: nextHandlerId,
                            ...h,
                            services: [resp.identity.name],
                        });
                    }
                }
            }
            subscriptions.sort((a, b) => {
                const delta = a.subject.localeCompare(b.subject);
                if (delta !== 0) {
                    return delta;
                }
                if (a.consumerGroupName === undefined && b.consumerGroupName === undefined) {
                    return 0;
                }
                if (a.consumerGroupName !== undefined && b.consumerGroupName === undefined) {
                    return 1;
                }
                if (a.consumerGroupName === undefined && b.consumerGroupName !== undefined) {
                    return -1;
                }
                return a.consumerGroupName?.localeCompare(b.consumerGroupName ?? '') ?? 0;
            });
            for (const sub of subscriptions) {
                sub.services.sort();
            }
            handlers.sort((a, b) => a.name.localeCompare(b.name));
            for (const handler of handlers) {
                handler.services.sort();
            }
            this.subscriptions.value = subscriptions;    
            this.handlers.value = handlers;    
        } finally {
            this.isFetching.value = false;
        }
    }
}