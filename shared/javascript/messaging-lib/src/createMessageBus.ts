import { HubConfig } from "core-lib";
import { Logger } from "core-lib";
import { MessageBus } from "./MessageBus.js";
import { NatsMessageBus } from "./NatsMessageBus.js";

export function createMessageBus(hub: HubConfig, appName: string, logger: Logger): MessageBus {
    switch(hub.type) {
        case 'nats':
            return  new NatsMessageBus(hub, appName, logger);
        default:
            throw new Error(`Unknown message bus type '${hub.type}'`);
    }
}

