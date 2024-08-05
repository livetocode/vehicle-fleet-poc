import type { AggregatePeriodStats } from "core-lib";
import { LambdaEventHandler, type EventHandler, type MessageBus } from "../utils/messaging";
import { ref } from 'vue';

export class VehicleStatsViewModel {
    public events = ref<AggregatePeriodStats[]>([]);
    public totalEventCount = ref<number>(0);
    public totalTimePartitionCount = ref<number>(0);
    public totalDataPartitionCount = ref<number>(0);
    public totalSize = ref<number>(0);
    private _statsHandler?: EventHandler;
    private _timePartitions = new Set();
    constructor(private _messageBus: MessageBus) {}

    async init(): Promise<void> {
        this._statsHandler = new LambdaEventHandler(
            ['aggregate-period-stats', 'reset-aggregate-period-stats'], 
            async (ev: any) => { this.onProcessStats(ev); },
        );
        this._messageBus.registerHandlers(this._statsHandler);
    }

    async dispose(): Promise<void> {
        if (this._statsHandler) {
            this._messageBus?.unregisterHandler(this._statsHandler);
            this._statsHandler = undefined;
        }
    }

    private onProcessStats(ev: AggregatePeriodStats): void {
        console.log(ev);
        if ((ev as any).type === 'reset-aggregate-period-stats') {
            this.totalEventCount.value = 0;
            this.totalTimePartitionCount.value = 0;
            this.totalDataPartitionCount.value = 0;
            this.totalSize.value = 0;
            this.events.value = [];
            this._timePartitions.clear();
            return;
        }
        this._timePartitions.add(ev.partitionKey);
        const events = [...this.events.value, ev];
        if (events.length > 20) {
            events.shift();
        }
        this.events.value = events;
        this.totalEventCount.value += ev.eventCount;
        this.totalTimePartitionCount.value = this._timePartitions.size;
        this.totalDataPartitionCount.value += ev.partitions.length;
        this.totalSize.value += ev.partitions.map(x => x.size).reduce((a, b) => a + b, 0);
    }

}