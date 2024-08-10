import { roundDecimals, type AggregatePeriodStats, type Logger } from "core-lib";
import { LambdaEventHandler, type EventHandler, type MessageBus } from "../utils/messaging";
import { ref } from 'vue';

class Stat {
    lastValue = 0;
    minValue = 0;
    maxValue = 0;
    sum = 0;
    count = 0;

    constructor(public readonly name: string, public readonly unit: string) {}

    get average() {
        if (this.count > 0) {
            return roundDecimals(this.sum / this.count, 1);
        }
        return 0;
    }

    add(value: number) {
        if (value > this.maxValue) {
            this.maxValue = value;
        }
        if (this.count === 0) {
            this.minValue = value;
        } else if (value < this.minValue) {
            this.minValue = value;
        }
        this.lastValue = value;
        this.sum += value;
        this.count += 1;
    }
}

export class VehicleStatsViewModel {
    public events = ref<AggregatePeriodStats[]>([]);
    public totalEventCount = ref<number>(0);
    public totalTimePartitionCount = ref<number>(0);
    public totalDataPartitionCount = ref<number>(0);
    public totalSize = ref<number>(0);
    public stats = ref<Stat[]>([]);
    private _statsHandler?: EventHandler;
    private _timePartitions = new Set();
    private _memoryStat = new Stat('Memory used', 'MB');
    private _loadAverageStat = new Stat('Load / 1 min', '%');
    
    constructor(private _messageBus: MessageBus, private logger: Logger) {}

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
        this.logger.debug(ev);
        if ((ev as any).type === 'reset-aggregate-period-stats') {
            this.totalEventCount.value = 0;
            this.totalTimePartitionCount.value = 0;
            this.totalDataPartitionCount.value = 0;
            this.totalSize.value = 0;
            this.events.value = [];
            this._timePartitions.clear();
            this.stats.value = [];
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
        this._memoryStat.add(roundDecimals(ev.processStats.memory.heapUsed / (1024 * 1024), 1)); // MB
        this._loadAverageStat.add(roundDecimals(ev.processStats.loadAverage[0], 1));
        this.stats.value = [this._memoryStat, this._loadAverageStat];
    }

}