import { PrepareRequest, PrepareResponse, IncomingMessageEnvelope, Logger, MessageTrackingCollection, Request, RequestHandler } from "core-lib";
import { MoveCommandAccumulator } from "./MoveCommandAccumulator.js";

export class PrepareCollectorHandler extends RequestHandler<PrepareRequest, PrepareResponse> {

    constructor(
        private logger: Logger,
        private trackingCollection: MessageTrackingCollection,
        private accumulator: MoveCommandAccumulator,
    ) {
        super();
    }

    get description(): string {
        return `A collector should prepare to receive messages before a new generation.`;
    }

    get messageTypes(): string[] {
        return ['prepare-request'];
    }

    protected async processRequest(req: IncomingMessageEnvelope<Request<PrepareRequest>>): Promise<PrepareResponse> {
        this.logger.warn('Prepare collector');
        this.trackingCollection.clear();
        await this.accumulator.init();
        return { type: 'prepare-response' };
    }
}
