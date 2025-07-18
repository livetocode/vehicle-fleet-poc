import { LambdaMessageHandler, type MessageHandler, type MessageBus, formatBytes, formatCounts, roundDecimals, sleep, type AggregatePeriodCreated, type Config, type Logger, type VehicleGenerationStarted, type GenerateRequest, RequestTimeoutError, isCancelResponse, isGenerateResponse, type VehicleGenerationStopped, requests } from "core-lib";
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
        messageChunkSize: number;
        refreshIntervalInSecs: number;
        realtime: boolean;
        useBackpressure: boolean;
    };
    private events = ref<AggregatePeriodCreated[]>([]);
    private totalEventCount = 0;
    private totalTimePartitionCount = 0;
    private totalDataPartitionCount = 0;
    private totalSize = 0;
    private totalElapsedTimeInMS = 0;
    private totalRejectedMessagesInThePast = 0;
    private totalRejectedMessagesInTheFuture = 0;
    private _aggregatePeriodHandler?: MessageHandler;
    private _startGenerationHandler?: MessageHandler;
    private _stopGenerationHandler?: MessageHandler;
    private _timePartitions = new Set();
    private _memoryStat = new AggregatedStat('Memory used', 'B');
    private _loadAverageStat = new AggregatedStat('Load / 1 min', '%');
    private _nextEventStatsId = 1;
    private _events: AggregatePeriodCreated[] = [];
    
    constructor(private config: Config, private _messageBus: MessageBus, private logger: Logger) {
        this.statValues.value = this.createStats();
        this.generationParameters = {
            vehicleCount: this.config.generator.vehicleCount,
            vehicleTypes: this.config.generator.vehicleTypes,
            maxNumberOfEvents: this.config.generator.maxNumberOfEvents,
            messageChunkSize: this.config.generator.messageChunkSize,
            refreshIntervalInSecs: this.config.generator.refreshIntervalInSecs,
            realtime: this.config.generator.realtime,
            useBackpressure: this.config.backpressure.enabled,
        };
    }

    async init(): Promise<void> {
        this._aggregatePeriodHandler = new LambdaMessageHandler<AggregatePeriodCreated>(
            ['aggregate-period-created'],
            'VehicleTrackingViewModel',
            'Receives a notification for each aggregate period created',
            async (ev: any) => { this.onAggregatePeriodCreated(ev); },
        );
        this._startGenerationHandler = new LambdaMessageHandler<VehicleGenerationStarted>(
            ['vehicle-generation-started'],
            'VehicleTrackingViewModel',
            'Receives a notification when a new generation starts',
            async (ev: any) => { this.onVehicleGenerationStarted(ev); },
        );
        this._stopGenerationHandler = new LambdaMessageHandler<VehicleGenerationStopped>(
            ['vehicle-generation-stopped'],
            'VehicleTrackingViewModel',
            'Receives a notification when a active generation stops',
            async (ev: any) => { this.onVehicleGenerationStopped(ev); },
        );
        this._messageBus.registerHandlers(this._aggregatePeriodHandler, this._startGenerationHandler, this._stopGenerationHandler);
    }

    async dispose(): Promise<void> {
        if (this._aggregatePeriodHandler) {
            this._messageBus?.unregisterHandler(this._aggregatePeriodHandler);
            this._aggregatePeriodHandler = undefined;
        }
        if (this._startGenerationHandler) {
            this._messageBus?.unregisterHandler(this._startGenerationHandler);
            this._startGenerationHandler = undefined;
        }
        if (this._stopGenerationHandler) {
            this._messageBus?.unregisterHandler(this._stopGenerationHandler);
            this._stopGenerationHandler = undefined;
        }
    }

    startGeneration(data: { 
        vehicleCount: number;
        vehicleTypes: string[];
        maxNumberOfEvents: number;
        messageChunkSize: number;
        refreshIntervalInSecs: number;
        realtime: boolean;
        pauseDelayInMSecs: number;
        useBackpressure: boolean;
    }) {
        const execute = async () => {
            this.logger.info('Cancelling any active generation...');
            let found = false;
            try {
                for await (const resp of this._messageBus.cancelMany({ 
                    type: 'cancel-request-type',
                    requestType: 'generate-request',
                    serviceName: 'generator',
                    waitOnCompletion: true,
                    cancelChildRequests: true,
                } , { 
                    limit: this.config.generator.instances, 
                    timeout: 10000,
                 } )) {
                    this.logger.debug('Received cancel request response', resp.body);
                    if (isCancelResponse(resp)) {
                        if (resp.body.body.found) {
                            this.logger.info('An active generation has been found and cancelled');
                            found = true;
                        }
                    }
                }    
            } catch(err) {
                if (err instanceof RequestTimeoutError) {
                    this.logger.warn('Cancellation timed out', err);
                } else {
                    throw err;
                }
            }
            if (found) {
                this.logger.info('Pausing before start...');
                await sleep(2000);    
            }
            const request: GenerateRequest = {
                type: 'generate-request',
                vehicleCount: data.vehicleCount,
                vehicleTypes: data.vehicleTypes,
                maxNumberOfEvents: data.maxNumberOfEvents,
                messageChunkSize: data.messageChunkSize,
                refreshIntervalInSecs: data.refreshIntervalInSecs,
                realtime: data.realtime,
                pauseDelayInMSecs: data.pauseDelayInMSecs,
                useBackpressure: data.useBackpressure,
                sendFlush: this.config.generator.sendFlush,
                startDate: this.config.generator.startDate,        
            }
            this.logger.info('Starting generation', request);
            const result = await this._messageBus.request(request, { path: requests.vehicles.generate.publish({}) });
            if (result.body.type === 'response-success') {
                const resp = result.body.body;
                if (isGenerateResponse(resp)) {
                    this.logger.info('Generation completed in ', resp.elapsedTimeInMS, ' ms');
                }
            } else {
                this.logger.error('Generation failed', result.body);
            }
        };
        execute().catch(console.error);
    }

    formatStats(ev: AggregatePeriodCreated) {
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
    
    private onVehicleGenerationStarted(ev: VehicleGenerationStarted): void {
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
        this._events = [];
        this._timePartitions.clear();
        this._memoryStat.clear();
        this._loadAverageStat.clear();
        this.statValues.value = this.createStats();
    }

    private onVehicleGenerationStopped(ev: VehicleGenerationStarted): void {
        this.logger.debug(ev);
    }

    private onAggregatePeriodCreated(ev: AggregatePeriodCreated): void {
        this.logger.trace(ev);
        this._timePartitions.add(ev.partitionKey);
        const evWithId = {
            ...ev,
            id: this._nextEventStatsId,
        }
        this._nextEventStatsId += 1;
        this._events.push(evWithId);
        const totalEvents = this._events.reduce((a, b) => a + b.partitions.length, 0);
        if (totalEvents > 1000) {
            this._events.shift();
        }
        
        const eventsByKey = new Map<string, AggregatePeriodCreated>();
        for (const x of this._events) {
            const key = `${x.collectorIndex}:${x.fromTime}:${x.toTime}`;
            const val = eventsByKey.get(key);
            if (val) {                
                val.elapsedTimeInMS += x.elapsedTimeInMS;
                val.totalElapsedTimeInMS = Math.max(val.totalElapsedTimeInMS, x.totalElapsedTimeInMS);
                val.eventCount += x.eventCount;
                val.isPartial = val.isPartial || x.isPartial;
                val.partitions.push(...x.partitions);
                val.totalRejectedMessagesInTheFuture += x.totalRejectedMessagesInTheFuture;
                val.totalRejectedMessagesInThePast += x.totalRejectedMessagesInThePast;
            } else {
                eventsByKey.set(key, {
                    ...x,
                    partitions: [...x.partitions],
                });
            }
        }
        //const events = [...this.events.value, evWithId];
        // if (events.length > 100) {
        //     events.shift();
        // }
        const events = [...eventsByKey.values()];
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