import { ChaosEngineeringConfig, Logger, MessageBusFeatures, ProtoBufRegistry, ServiceIdentity } from "core-lib";
import { MessageBus } from "core-lib";
import { PrometheusMessageBusMetrics } from "./PrometheusMessageBusMetrics.js";
import { NatsMessageBusDriver } from "./NatsMessageBusDriver.js";

export class NatsMessageBus extends MessageBus {

    constructor(identity: ServiceIdentity, logger: Logger, chaosEngineering: ChaosEngineeringConfig) {
        const protoBufRegistry = new ProtoBufRegistry();
        const driver = new NatsMessageBusDriver(
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
            supportsAbstractSubjects: true, // NATS allows multiple subscribers of a same subject to decide wether they will consume the messages as a queue or pub/sub
            supportsTemporaryQueues: true, // NATS has temporary queues by default and when a subscriber disconnects, all messages get deleted.
        }
    }

}
