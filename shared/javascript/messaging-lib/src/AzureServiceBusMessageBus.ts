import { ChaosEngineeringConfig, Logger, MessageBusFeatures, ProtoBufRegistry, ServiceIdentity } from "core-lib";
import { MessageBus } from "core-lib";
import { PrometheusMessageBusMetrics } from "./PrometheusMessageBusMetrics.js";
import { AzureServiceBusMessageBusDriver } from "./AzureServiceBusMessageBusDriver.js";

export class AzureServiceBusMessageBus extends MessageBus {

    constructor(identity: ServiceIdentity, logger: Logger, chaosEngineering: ChaosEngineeringConfig) {
        const protoBufRegistry = new ProtoBufRegistry();
        const driver = new AzureServiceBusMessageBusDriver(
            (msg) => this.messageDispatcher.dispatch(msg),
            (req, res) => this.envelopeReply(req, res),
            identity,
            logger,
            protoBufRegistry,
        );
        super(identity, logger, chaosEngineering, new PrometheusMessageBusMetrics(), driver, protoBufRegistry);
    }

    get features(): MessageBusFeatures {
        return {
            supportsAbstractSubjects: false, // Azure does not allow to share the same name for a queue and a topic
            supportsTemporaryQueues: false, // Azure requires the queue to be created in advance and won't delete it once the client has been disconnected.
        }
    }
}
