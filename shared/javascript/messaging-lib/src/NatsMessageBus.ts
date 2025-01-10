import { Logger, ServiceIdentity } from "core-lib";
import { MessageBus } from "core-lib";
import { PrometheusMessageBusMetrics } from "./PrometheusMessageBusMetrics.js";
import { NatsMessageBusDriver } from "./NatsMessageBusDriver.js";

export class NatsMessageBus extends MessageBus {

    constructor(identity: ServiceIdentity, logger: Logger) {
        const driver = new NatsMessageBusDriver(
            (msg) => this.messageDispatcher.dispatch(msg),
            (req, res) => this.envelopeReply(req, res),
            logger,
        );
        super(identity, logger, new PrometheusMessageBusMetrics(), driver);
    }
}
