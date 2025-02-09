import { ClearVehiclesDataRequest, ClearVehiclesDataResponse, RequestHandler, Logger, IncomingMessageEnvelope, Request } from "core-lib";
import { DataFrameRepository } from "data-lib";

export class ClearVehiclesDataHandler extends RequestHandler<ClearVehiclesDataRequest, ClearVehiclesDataResponse> {

    constructor(
        private logger: Logger,
        private repo: DataFrameRepository,
    ) {
        super();
    }

    get description(): string {
        return `Deletes all vehicle positions before running a new simulation.`;
    }

    get messageTypes(): string[] {
        return ['clear-vehicles-data-request'];
    }

    protected async processRequest(req: IncomingMessageEnvelope<Request<ClearVehiclesDataRequest>>): Promise<ClearVehiclesDataResponse> {
        this.logger.info("Clearing");
        try {
            await this.repo.clear();
            return {
                type: 'clear-vehicles-data-response',
                success: true,
            };
        } catch(err: any) {
            this.logger.error(err);
            return {
                type: 'clear-vehicles-data-response',
                success: false,
            };
        }
    }
}