import { FlushRequest, FlushResponse, IncomingMessageEnvelope, Logger, MessageHandler, Request, RequestHandler, FlushCommand } from "core-lib";
import { MoveCommandAccumulator } from "./MoveCommandAccumulator.js";

export class FlushRequestHandler extends RequestHandler<FlushRequest, FlushResponse> {

    constructor(
        private logger: Logger,
        private accumulator: MoveCommandAccumulator,
    ) {
        super();
    }

    get description(): string {
        return `Forces the collector to flush its cached data. (sync request/reply)`;
    }

    get messageTypes(): string[] {
        return ['flush-request'];
    }

    protected async processRequest(req: IncomingMessageEnvelope<Request<FlushRequest>>): Promise<FlushResponse> {
        this.logger.warn('Trigger flush');
        await this.accumulator.flush();
        return { type: 'flush-response' };
    }
}

export class FlushDataHandler extends MessageHandler<FlushCommand> {

    constructor(
        private logger: Logger,
        private accumulator: MoveCommandAccumulator,
    ) {
        super();
    }

    get description(): string {
        return `Forces the collector to flush its cached data. (fire and forget command)`;
    }

    get messageTypes(): string[] {
        return ['flush'];
    }

    public async process(req: IncomingMessageEnvelope<FlushCommand>): Promise<void> {
        this.logger.warn('Trigger flush');
        await this.accumulator.flush();
    }
}
