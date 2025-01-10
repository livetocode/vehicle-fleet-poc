import { HubConfig, MessageBus, Logger, ServiceIdentity } from "core-lib";
import { NatsMessageBus } from "./NatsMessageBus.js";

export async function createMessageBus(hub: HubConfig, identity: ServiceIdentity, logger: Logger): Promise<MessageBus> {
    switch(hub.type) {
        case 'nats':
            const result = new NatsMessageBus(identity, logger);
            await result.start(hub.protocols.nats.servers.join(','));
            return result;
        default:
            throw new Error(`Unknown message bus type '${hub.type}'`);
    }
}

