import { HubConfig, MessageBus, Logger, ServiceIdentity, registerCodecs, ChaosEngineeringConfig } from "core-lib";
import { NatsMessageBus } from "./NatsMessageBus.js";
import { AzureServiceBusMessageBus } from "./AzureServiceBusMessageBus.js";

export async function createMessageBus(hub: HubConfig, identity: ServiceIdentity, logger: Logger, chaosEngineering: ChaosEngineeringConfig): Promise<MessageBus> {
    switch(hub.type) {
        case 'nats': {
            const result = new NatsMessageBus(identity, logger, chaosEngineering);
            if (hub.enableProtoBuf) {
                registerCodecs(result);
            }
            await result.start(hub.protocols.nats.servers.join(','));
            return result;
        }
        case 'azureServiceBus': {
            const result = new AzureServiceBusMessageBus(identity, logger, chaosEngineering);
            if (hub.enableProtoBuf) {
                registerCodecs(result);
            }
            await result.start(hub.connectionString);
            return result;
        }
        default:
            throw new Error(`Unknown message bus type '${hub.type}'`);
    }
}

