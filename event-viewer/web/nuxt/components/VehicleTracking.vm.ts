import { LambdaEventHandler, randomUUID, type EventHandler, type MessageBus, formatBytes, formatCounts, roundDecimals, sleep, type AggregatePeriodStats, type Config, type Logger, type ResetAggregatePeriodStats, type StartGenerationCommand, type StopGenerationCommand, type CancelRequestByType, RequestTimeoutError } from "core-lib";
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
    public generationParameters: {
        vehicleCount: number;
        vehicleTypes: string[];
        maxNumberOfEvents: number;
        refreshIntervalInSecs: number;
        realtime: boolean;
    };
    private events = ref<AggregatePeriodStats[]>([]);
    private totalEventCount = 0;
    private totalTimePartitionCount = 0;
    private totalDataPartitionCount = 0;
    private totalSize = 0;
    private totalElapsedTimeInMS = 0;
    private totalRejectedMessagesInThePast = 0;
    private totalRejectedMessagesInTheFuture = 0;
    private _statsHandler?: EventHandler;
    private _resetStatsHandler?: EventHandler;
    private _timePartitions = new Set();
    private _memoryStat = new AggregatedStat('Memory used', 'B');
    private _loadAverageStat = new AggregatedStat('Load / 1 min', '%');
    private _nextEventStatsId = 1;
    
    constructor(private config: Config, private _messageBus: MessageBus, private logger: Logger) {
        this.statValues.value = this.createStats();
        this.generationParameters = {
            vehicleCount: this.config.generator.vehicleCount,
            vehicleTypes: this.config.generator.vehicleTypes,
            maxNumberOfEvents: this.config.generator.maxNumberOfEvents,
            refreshIntervalInSecs: this.config.generator.refreshIntervalInSecs,
            realtime: this.config.generator.realtime,
        };
    }

    async init(): Promise<void> {
        this._statsHandler = new LambdaEventHandler<AggregatePeriodStats>(
            ['aggregate-period-stats'], 
            async (ev: any) => { this.onProcessStats(ev); },
        );
        this._resetStatsHandler = new LambdaEventHandler<ResetAggregatePeriodStats>(
            ['reset-aggregate-period-stats'], 
            async (ev: any) => { this.onResetStats(ev); },
        );
        this._messageBus.registerHandlers(this._statsHandler, this._resetStatsHandler);
    }

    async dispose(): Promise<void> {
        if (this._statsHandler) {
            this._messageBus?.unregisterHandler(this._statsHandler);
            this._statsHandler = undefined;
        }
        if (this._resetStatsHandler) {
            this._messageBus?.unregisterHandler(this._resetStatsHandler);
            this._resetStatsHandler = undefined;
        }
    }

    startGeneration(data: { 
        vehicleCount: number;
        vehicleTypes: string[];
        maxNumberOfEvents: number;
        refreshIntervalInSecs: number;
        realtime: boolean;    
    }) {
        const execute = async () => {
            this.logger.info('Cancelling any active generation...');
            let found = false;
            try {
                for await (const resp of this._messageBus.cancelMany({ type: 'cancel-request-type', requestType: 'generate-partition' } , { subject: 'generation.broadcast', limit: this.config.generator.instances, timeout: 1000 } )) {
                    this.logger.debug('Received stop generation response', resp);
                    if (resp.body.type === 'response-success') {
                        if (resp.body.body.type === 'cancel-response') {
                            if (resp.body.body.found) {
                                found = true;
                            }
                        }
                    }
                }    
            } catch(err) {
                if (!(err instanceof RequestTimeoutError)) {
                    throw err;
                }
            }
            if (found) {
                this.logger.info('Found a generation request to cancel. Will wait before starting a new generation...')
                await sleep(5000);
            }
            const request: StartGenerationCommand = {
                type: 'start-generation',
                vehicleCount: data.vehicleCount,
                vehicleTypes: data.vehicleTypes,
                maxNumberOfEvents: data.maxNumberOfEvents,
                refreshIntervalInSecs: data.refreshIntervalInSecs,
                realtime: data.realtime,
                sendFlush: this.config.generator.sendFlush,
                startDate: this.config.generator.startDate,        
            }
            this.logger.info('Starting generation', request);
            const result = await this._messageBus.request(request, { subject: 'generation' });
            if (result.body.type === 'response-success') {
                const resp = result.body.body;
                if (resp.type === 'generation-stats') {
                    this.logger.info('Generation completed in ', resp.elapsedTimeInMS, ' ms');
                }
            } else {
                this.logger.error('Generation failed', result.body);
            }
        };
        execute().catch(console.error);
    }

    formatStats(ev: AggregatePeriodStats) {
        const eventCountAsStr = formatCounts(ev.eventCount, 1);
        const totalBytes = ev.partitions.map(x => x.size).reduce((a, b) => a + b, 0);
        const totalBytesAsStr = formatBytes(totalBytes, 1);
        return `${eventCountAsStr.value} ${eventCountAsStr.units} == ${totalBytesAsStr.value} ${totalBytesAsStr.units}`;
    }


    private createStats(): StatValue[] {
        const rejectedMessages: StatValue[] = [];
        if (this.totalRejectedMessagesInTheFuture + this.totalRejectedMessagesInThePast > 0) {
            rejectedMessages.push({
                unitPlural: 'Rejected events',
                values: [
                    {
                        title: 'past',
                        value: this.totalRejectedMessagesInThePast,
                    },
                    {
                        title: 'future',
                        value: this.totalRejectedMessagesInTheFuture,
                    },
                ],
            });
        }
        return [
            {
                unitPlural: 'Events',
                value: this.totalEventCount,
            },
            {
                unitPlural: 'Events / sec',
                value: this.totalElapsedTimeInMS > 0 ? this.totalEventCount / (this.totalElapsedTimeInMS/1000) : 0,
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
            {
                unitPlural: 'Elapsed time',
                value: this.totalElapsedTimeInMS,
                unitType: 'ms',
            },
            ...rejectedMessages,
            this._loadAverageStat.toStatValue(),
            this._memoryStat.toStatValue(),
        ];
    }
    
    private onResetStats(ev: ResetAggregatePeriodStats): void {
        this.logger.debug(ev);
        this._nextEventStatsId = 1;
        this.totalEventCount = 0;
        this.totalTimePartitionCount = 0;
        this.totalDataPartitionCount = 0;
        this.totalSize = 0;
        this.totalElapsedTimeInMS = 0;
        this.totalRejectedMessagesInThePast = 0;
        this.totalRejectedMessagesInTheFuture = 0;
        this.events.value = [];
        this._timePartitions.clear();
        this._memoryStat.clear();
        this._loadAverageStat.clear();
        this.statValues.value = this.createStats();
    }

    private onProcessStats(ev: AggregatePeriodStats): void {
        this.logger.debug(ev);
        this._timePartitions.add(ev.partitionKey);
        const evWithId = {
            ...ev,
            id: this._nextEventStatsId,
        }
        this._nextEventStatsId += 1;
        const events = [...this.events.value, evWithId];
        if (events.length > 100) {
            events.shift();
        }
        this.events.value = events;
        this.totalEventCount += ev.eventCount;
        this.totalTimePartitionCount = this._timePartitions.size;
        this.totalDataPartitionCount += ev.partitions.length;
        this.totalSize += ev.partitions.map(x => x.size).reduce((a, b) => a + b, 0);
        this.totalElapsedTimeInMS = Math.max(this.totalElapsedTimeInMS, ev.totalElapsedTimeInMS);
        this.totalRejectedMessagesInThePast += ev.totalRejectedMessagesInThePast;
        this.totalRejectedMessagesInTheFuture += ev.totalRejectedMessagesInTheFuture;
        this._memoryStat.add(ev.processStats.memory.heapUsed); 
        this._loadAverageStat.add(roundDecimals(ev.processStats.loadAverage[0], 1));
        this.statValues.value = this.createStats();
    }

}