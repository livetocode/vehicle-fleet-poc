export type MessageRoute = {
    messageType: string;
    subject: string;
    subscription: string;
    sender: string;
    receiver: string;
}

export class MessageRoutes {
    private _routes = new Map<string, MessageRoute>();

    add(route: MessageRoute): void {
        const id = makeRouteId(route);
        if (!this._routes.has(id)) {
            this._routes.set(id, route);
        }
    }

    get routes(): MessageRoute[] {
        return [...this._routes.values()];
    }
}

export function makeRouteId(route: MessageRoute): string {
    return `${route.subject}:${route.subscription}:${route.messageType}:${route.sender}:${route.receiver}`;
}