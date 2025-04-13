import { FlushRequest, FlushResponse, IncomingMessageEnvelope, Logger, MessageTrackingCollection, Request, RequestHandler } from "core-lib";
import { MoveCommandAccumulator } from "./MoveCommandAccumulator.js";

export class FlushDataHandler extends RequestHandler<FlushRequest, FlushResponse> {

    constructor(
        private logger: Logger,
        private accumulator: MoveCommandAccumulator,
        private trackingCollection: MessageTrackingCollection,
    ) {
        super();
    }

    get description(): string {
        return `Forces the collector to flush its cached data.`;
    }

    get messageTypes(): string[] {
        return ['flush-request'];
    }

    protected async processRequest(req: IncomingMessageEnvelope<Request<FlushRequest>>): Promise<FlushResponse> {
        this.logger.warn('Trigger flush');
        await this.accumulator.flush();
        this.trackingCollection.clear();
        return { type: 'flush-response' };
    }
}
