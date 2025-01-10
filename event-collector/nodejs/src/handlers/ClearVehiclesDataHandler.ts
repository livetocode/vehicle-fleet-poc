import { ClearVehiclesData, ClearVehiclesDataResult, RequestHandler, Logger, IMessageBus, MessageEnvelope, Request } from "core-lib";
import { DataFrameRepository } from "data-lib";

export class ClearVehiclesDataHandler extends RequestHandler<ClearVehiclesData, ClearVehiclesDataResult> {

    constructor(
        private logger: Logger,
        messageBus: IMessageBus,
        private repo: DataFrameRepository,
    ) {
        super(messageBus);
    }

    get eventTypes(): string[] {
        return ['clear-vehicles-data'];
    }

    protected async processRequest(req: MessageEnvelope<Request<ClearVehiclesData>>): Promise<ClearVehiclesDataResult> {
        this.logger.info("Clearing");
        try {
            await this.repo.clear();
            return {
                type: 'clear-vehicles-data-result',
                success: true,
            };
        } catch(err: any) {
            this.logger.error(err);
            return {
                type: 'clear-vehicles-data-result',
                success: false,
            };
        }
    }
}