import { type Logger, type MessageBus, type MessageSubscription, type MessageHandlerInfo, type MessageRoute, normalizeSubject } from "core-lib";
import { makeRouteId } from "core-lib/dist/messaging/MessageRoutes";


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
    routes = ref<MessageRoute[]>([]);
    isFetching = ref(false);
    docs = ref<string>('');
    
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
            const routes = new Map<string, MessageRoute>();
            let nextSubscriptionId = 0;
            let nextHandlerId = 0;
            for await (const resp of this._messageBus.info({ timeout: 1000 })) {
                for (const sub of resp.subscriptions) {
                    if (!sub.subject.startsWith('inbox.')) {
                        const subject = normalizeNumbers(sub.subject);
                        const item = subscriptions.find(x => x.subject === subject && x.consumerGroupName === sub.consumerGroupName);
                        if (item) {
                            if (!item.services.includes(resp.identity.name)) {
                                item.services.push(resp.identity.name)
                            }
                        } else {
                            nextSubscriptionId += 1
                            subscriptions.push({
                                id: nextSubscriptionId,
                                ...sub,
                                subject,
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
                for (const route of resp.routes) {
                    route.subject = normalizeNumbers(normalizeSubject(route.subject));
                    route.subscription = normalizeNumbers(normalizeSubject(route.subscription));
                    const routeId = makeRouteId(route);
                    routes.set(routeId, route);
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
            this.routes.value = [...routes.values()].sort(compareMessageRoute);

            this.generateDocs();
        } finally {
            this.isFetching.value = false;
        }
    }

    private generateDocs() {
        const docs: string[] = [];
        docs.push('# Vehicles tracker documentation');
        docs.push('');
        docs.push('## Subscriptions');
        docs.push('');
        docs.push('|Subject|Consumer Group|Services|');
        docs.push('|-------|--------------|--------|');
        for (const sub of this.subscriptions.value) {
            docs.push(`|${escapeMarkdownChars(sub.subject)}|${sub.consumerGroupName ?? ''}|${sub.services.join(', ')}|`);
        }
        docs.push('');
        docs.push('## Message handlers');
        docs.push('');
        docs.push('|Handler Name|Message Types|Services|Description|');
        docs.push('|------------|-------------|--------|-----------|');
        for (const handler of this.handlers.value) {
            docs.push(`|${handler.name}|${handler.messageTypes.join(', ')}|${handler.services.join(', ')}|${handler.description}|`);
        }
        docs.push('');
        docs.push('## Message routes');
        docs.push('');
        docs.push('|Sender|Message Type|Subject|Receiver|Subscription|');
        docs.push('|------|------------|-------|--------|------------|');
        for (const route of this.routes.value) {
            docs.push(`|${route.sender}|${route.messageType}|${route.subject}|${route.receiver}|${escapeMarkdownChars(route.subscription)}|`);
        }
        docs.push('');

        this.docs.value = docs.join('\n');
    }

    copy() {
        copyToClipboard(this.docs.value).catch(err => {
            alert(err.message);
        });
    }
}

function compareMessageRoute(a: MessageRoute, b: MessageRoute): number {
    let delta = a.sender.localeCompare(b.sender);
    if (delta === 0) {
        delta = a.subject.localeCompare(b.subject);
    }
    if (delta === 0) {
        delta = a.subscription.localeCompare(b.subscription);
    }
    if (delta === 0) {
        delta = a.messageType.localeCompare(b.messageType);
    }
    if (delta === 0) {
        delta = a.receiver.localeCompare(b.receiver);
    }
    return delta;
}

const numberInTheMiddle = /[.]\d+[.]/gm;
const numberAtTheEnd = /[.]\d+$/gm;

function normalizeNumbers(value: string): string {
    return value.replaceAll(numberInTheMiddle, '.{int}.').replaceAll(numberAtTheEnd, '.{int}');
}

const specialChars = [
    ['&', '&amp;'],
    ['>', '&gt;'],
    ['<', '&lt;'],
    ['#', '&#35;'],
    ['|', '&#124;'],
    ['*', '&#42;'],
];

function escapeMarkdownChars(value: string): string {
    let result = value;
    for (const [search, replace] of specialChars) {
        result = result.replaceAll(search, replace);
    }
    return result;
}

async function copyToClipboard(textToCopy: string) {
    // Copied from: https://stackoverflow.com/questions/51805395/navigator-clipboard-is-undefined

    // Navigator clipboard api needs a secure context (https)
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
    } else {
        // Use the 'out of viewport hidden text area' trick
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
            
        // Move textarea out of the viewport so it's not visible
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";
            
        document.body.prepend(textArea);
        textArea.select();

        try {
            document.execCommand('copy');
        } catch (error) {
            console.error(error);
        } finally {
            textArea.remove();
        }
    }
}