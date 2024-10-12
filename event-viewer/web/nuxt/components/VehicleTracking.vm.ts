import { formatBytes, formatCounts, roundDecimals, type AggregatePeriodStats, type Logger } from "core-lib";
import { LambdaEventHandler, type EventHandler, type MessageBus } from "../utils/messaging";
import type { StatValue } from "../utils/types";
import { ref } from 'vue';

class AggregatedStat {
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
    
    clear() {
        this.lastValue = 0;
        this.minValue = 0;
        this.maxValue = 0;
        this.sum = 0;
        this.count = 0;
    }

    toStatValue(): StatValue {
        return {
            values: [
                {
                    title: 'min',
                    value: this.minValue,
                },
                {
                    title: 'avg',
                    value: this.average,
                },
                {
                    title: 'max',
                    value: this.maxValue,
                },
            ],
            decimals: 1,
            unitType: this.unit,
            unitPlural: this.name,
        };
    }
}

export class VehicleTrackingViewModel {
    public statValues = ref<StatValue[]>([]);
    private events = ref<AggregatePeriodStats[]>([]);
    private totalEventCount = 0;
    private totalTimePartitionCount = 0;
    private totalDataPartitionCount = 0;
    private totalSize = 0;
    private _statsHandler?: EventHandler;
    private _timePartitions = new Set();
    private _memoryStat = new AggregatedStat('Memory used', 'B');
    private _loadAverageStat = new AggregatedStat('Load / 1 min', '%');
    
    constructor(private _messageBus: MessageBus, private logger: Logger) {
        this.statValues.value = this.createStats();
    }

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

    formatStats(ev: AggregatePeriodStats) {
        const eventCountAsStr = formatCounts(ev.eventCount, 1);
        const totalBytes = ev.partitions.map(x => x.size).reduce((a, b) => a + b, 0);
        const totalBytesAsStr = formatBytes(totalBytes, 1);
        return `${eventCountAsStr.value} ${eventCountAsStr.units} == ${totalBytesAsStr.value} ${totalBytesAsStr.units}`;
    }


    private createStats(): StatValue[] {
        return [
            {
                unitPlural: 'Events',
                value: this.totalEventCount,
            },
            {
                unitPlural: 'Time partitions',
                value: this.totalTimePartitionCount,
            },
            {
                unitPlural: 'Data partitions',
                value: this.totalDataPartitionCount,
            },
            {
                unitPlural: 'Storage size',
                value: this.totalSize,
                unitType: 'B'
            },
            this._loadAverageStat.toStatValue(),
            this._memoryStat.toStatValue(),
        ];
    }

    private onProcessStats(ev: AggregatePeriodStats): void {
        this.logger.debug(ev);
        if ((ev as any).type === 'reset-aggregate-period-stats') {
            this.totalEventCount = 0;
            this.totalTimePartitionCount = 0;
            this.totalDataPartitionCount = 0;
            this.totalSize = 0;
            this.events.value = [];
            this._timePartitions.clear();
            this._memoryStat.clear();
            this._loadAverageStat.clear();
            return;
        }
        this._timePartitions.add(ev.partitionKey);
        const events = [...this.events.value, ev];
        if (events.length > 20) {
            events.shift();
        }
        this.events.value = events;
        this.totalEventCount += ev.eventCount;
        this.totalTimePartitionCount = this._timePartitions.size;
        this.totalDataPartitionCount += ev.partitions.length;
        this.totalSize += ev.partitions.map(x => x.size).reduce((a, b) => a + b, 0);
        this._memoryStat.add(ev.processStats.memory.heapUsed); 
        this._loadAverageStat.add(roundDecimals(ev.processStats.loadAverage[0], 1));
        this.statValues.value = this.createStats();
    }

}