import { Logger, ProtoBufRegistry, ServiceIdentity } from "core-lib";
import { MessageBus } from "core-lib";
import { PrometheusMessageBusMetrics } from "./PrometheusMessageBusMetrics.js";
import { NatsMessageBusDriver } from "./NatsMessageBusDriver.js";

export class NatsMessageBus extends MessageBus {

    constructor(identity: ServiceIdentity, logger: Logger) {
        const protoBufRegistry = new ProtoBufRegistry();
        const driver = new NatsMessageBusDriver(
            (msg) => this.messageDispatcher.dispatch(msg),
            (req, res) => this.envelopeReply(req, res),
            logger,
            protoBufRegistry,
        );
        super(identity, logger, new PrometheusMessageBusMetrics(), driver, protoBufRegistry);
    }
}
