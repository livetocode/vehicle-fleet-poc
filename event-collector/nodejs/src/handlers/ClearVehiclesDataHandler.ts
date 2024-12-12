import { ClearVehiclesData, ClearVehiclesDataResult, Logger } from "core-lib";
import { DataFrameRepository } from "data-lib";
import { GenericEventHandler, MessageBus } from "messaging-lib";

export class ClearVehiclesDataHandler extends GenericEventHandler<ClearVehiclesData> {
    constructor(
        private logger: Logger,
        private messageBus: MessageBus,
        private repo: DataFrameRepository,
    ) {
        super();
    }

    get eventTypes(): string[] {
        return ['clear-vehicles-data'];
    }

    protected async processTypedEvent(event: ClearVehiclesData): Promise<void> {
        this.logger.info(event);
        try {
            //await this.repo.clear();
            const resp: ClearVehiclesDataResult = {
                type: 'clear-vehicles-data-result',
                requestId: event.id,
                success: true,
            };
            this.messageBus.publish(event.replyTo, resp);
        } catch(err: any) {
            this.logger.error(err);
            const resp: ClearVehiclesDataResult = {
                type: 'clear-vehicles-data-result',
                requestId: event.id,
                success: false,
            };
            this.messageBus.publish(event.replyTo, resp);
        }
    }
}