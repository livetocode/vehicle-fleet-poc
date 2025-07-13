import { MessageHandler, Logger, EnrichedMoveCommand, IncomingMessageEnvelope, MessageTracking, BackpressureConfig, IMessageBus, MessageTrackingAck, MessageTrackingCollection, TrackingState, services } from 'core-lib';
import { EventStore, StoredEvent } from "../core/persistence/EventStore.js";
import { MoveCommandAccumulator, PersistedMoveCommand } from "./MoveCommandAccumulator.js";

export class AssignedMoveCommandHandler extends MessageHandler<EnrichedMoveCommand> {

    constructor(
        private logger: Logger,
        private backpressure: BackpressureConfig,
        private messageBus: IMessageBus,
        private eventStore: EventStore<PersistedMoveCommand>,
        private accumulator: MoveCommandAccumulator,
        private collectorIndex: number,
        private trackingCollection: MessageTrackingCollection,
    ) {
        super();
        if (backpressure.enabled) {
            setInterval(() => {
                this.onTimer();
            }, backpressure.notificationPeriodInMS);
        }
    }

    get description(): string {
        return `Dedicated collector that will accumulate events for its assigned partition key.`;
    }

    get messageTypes(): string[] {
        return ['enriched-move']; 
    }

    async init(): Promise<void> {
        await this.restore();
    }

    async process(msg: IncomingMessageEnvelope<EnrichedMoveCommand>): Promise<void> {
        const event = msg.body;
        const dataPartitionKey = event.partitionKey;
        const collectorIndex = event.collectorIndex;
        if (this.collectorIndex !== collectorIndex) {
            this.logger.warn(`Received event for wrong collector index #${collectorIndex}`);
            return;
        }
        this.logger.trace(event);
        const geoHash = event.geoHash;
        const cmd = event.command;
        const storedEvent: StoredEvent<PersistedMoveCommand> = { 
            timestamp: new Date(event.command.timestamp), 
            partitionKey: dataPartitionKey, 
            collectorIndex,
            event: {
                timestamp: new Date(event.command.timestamp),
                vehicleId: cmd.vehicleId,
                vehicleType: cmd.vehicleType,
                gps_lat: cmd.gps.lat,
                gps_lon: cmd.gps.lon,
                gps_alt: cmd.gps.alt,
                geoHash,
                speed: cmd.speed,
                direction: cmd.direction,
            },
        };
        await this.eventStore.write(storedEvent);
        await this.accumulator.write(storedEvent);
        if (msg.body.command.tracking) {
            await this.checkTracking(msg.body.command.tracking);
        }
    }

    private async restore(): Promise<void> {
        this.logger.info('Restoring move command accumulator from storage...');
        let count = 0;
        for await (const batch of this.eventStore.fetch(this.collectorIndex)) {
            for (const ev of batch) {
                this.accumulator.write(ev);
                count += 1;
            }
        }
        this.logger.info(`Restored ${count} move command accumulator from storage.`);
    }

    private onTimer() {
        for (const state of this.trackingCollection.list()) {
            if (state.dirty) {
                this.sendTracking(state, 'timer').catch(err => {
                    this.logger.error(err);
                });
            }
        }
    }

    private async checkTracking(tracking: MessageTracking): Promise<void> {
        if (!this.backpressure.enabled) {
            return;
        }
        const state = this.trackingCollection.add(tracking);
        const thresholdReached = state.counter >= this.backpressure.notificationThreshold;
        if (thresholdReached) {
            await this.sendTracking(state, 'threshold');
        }
    }

    private async sendTracking(state: TrackingState, trigger: 'timer' | 'threshold') {
        this.logger.debug(`Send tracking after ${state.counter} messages. Trigger = ${trigger} / Seq = ${state.tracking.sequence}`);
        const ack: MessageTrackingAck = {
            type: 'message-tracking-ack',
            messageType: 'move',
            tracking: state.tracking,
        }
        const path = services.generators.tracking.publish({ index: `${state.tracking.emitter.instance}`});
        await this.messageBus.publish(path, ack);
        state.dirty = false;
        state.counter = 0;
    }
}
