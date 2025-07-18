import { LambdaMessageHandler, randomUUID, type MessageHandler, type MessageBus, type VehicleQueryResult, type Logger, type VehicleQueryRequest, type VehicleQueryResponse, addOffsetToCoordinates, gpsToArray, KM, type Config, RequestTimeoutError, isResponseSuccess, isVehicleQueryResponse, requests } from "core-lib";
import type { StatValue } from "../utils/types";
import { ref } from 'vue';

export class VehicleFinderViewModel {
    public statValues = ref<StatValue[]>([]);
    public vehicleIds = ref<number[]>([]);
    public resultCount = ref<number>(0);
    public geometries: any;
    public periods: any;
    public vehicleTypes: string[];

    private _queryResultHandler?: MessageHandler;
    private _vehicleIds = new Set<number>();
    private _currentQuery?: VehicleQueryRequest;
    private _lastQueryResultStats?: VehicleQueryResponse;
    private _lastUpdateTimestamp?: Date;
    
    constructor(private config: Config, private _messageBus: MessageBus, private logger: Logger) {
        this.geometries = this.createGeometries();
        this.periods = this.createPeriods();
        this.vehicleTypes = config.generator.vehicleTypes;
        this.reset();
    }

    async init(): Promise<void> {
        this._queryResultHandler = new LambdaMessageHandler<VehicleQueryResult>(
            ['vehicle-query-result'],
            'VehicleFinderViewModel',
            'Receives a vehicle position matching the search criteria',
            async (ev: any) => { this.onProcessQueryResult(ev); },
        );
        this._messageBus.registerHandlers(this._queryResultHandler);
    }

    async dispose(): Promise<void> {
        if (this._queryResultHandler) {
            this._messageBus?.unregisterHandler(this._queryResultHandler);
            this._queryResultHandler = undefined;
        }
    }

    createPeriods() {
        const startDate = this.config.generator.startDate ?? '2024-01-01T00:05:00-05:00';
        const nextYearDate = new Date(startDate);
        nextYearDate.setFullYear(new Date(startDate).getFullYear() + 1);
        return {
            '10 min': {
                from: '2024-01-01T00:05:00-05:00',
                to:   '2024-01-01T00:15:00-05:00',
            },
            '1 hour': {
                from: '2024-01-01T00:05:00-05:00',
                to:   '2024-01-01T01:05:00-05:00',
            },
            '2 hours': {
                from: '2024-01-01T00:05:00-05:00',
                to:   '2024-01-01T02:05:00-05:00',
            },
            '12 hours': {
                from: '2024-01-01T00:05:00-05:00',
                to:   '2024-01-01T12:05:00-05:00',
            },
            '1 year': {
                from: startDate,
                to:   nextYearDate.toISOString(),
            },
        };
    }

    createGeometries() {
        const anchor = this.config.generator.map.topLeftOrigin;
        return {
            'Small box': {
                "type": "MultiPolygon",
                "coordinates":
                [
                    [
                        [
                            addOffsetToCoordinates(anchor, 5 * KM, 5 * KM),
                            addOffsetToCoordinates(anchor, 10 * KM, 5 * KM),
                            addOffsetToCoordinates(anchor, 10 * KM, 8 * KM),
                            addOffsetToCoordinates(anchor, 5 * KM, 8 * KM),
                            addOffsetToCoordinates(anchor, 5 * KM, 5 * KM),
                        ].map(gpsToArray),
                    ],
                ],
            },
            'Medium box': {
                "type": "MultiPolygon",
                "coordinates":
                [
                    [
                        [
                            addOffsetToCoordinates(anchor, 5 * KM, 5 * KM),
                            addOffsetToCoordinates(anchor, 20 * KM, 5 * KM),
                            addOffsetToCoordinates(anchor, 20 * KM, 10 * KM),
                            addOffsetToCoordinates(anchor, 5 * KM, 10 * KM),
                            addOffsetToCoordinates(anchor, 5 * KM, 5 * KM),
                        ].map(gpsToArray),
                    ],
                ],
            },
            'Whole map': {
                "type": "MultiPolygon",
                "coordinates":
                [
                    [
                        [
                            addOffsetToCoordinates(anchor, 0 * KM, 0 * KM),
                            addOffsetToCoordinates(anchor, this.config.generator.map.widthInKm * KM, 0 * KM),
                            addOffsetToCoordinates(anchor, this.config.generator.map.widthInKm * KM, this.config.generator.map.heightInKm * KM),
                            addOffsetToCoordinates(anchor, 0 * KM, this.config.generator.map.heightInKm * KM),
                            addOffsetToCoordinates(anchor, 0 * KM, 0 * KM),
                        ].map(gpsToArray),
                    ],
                ],
            },
            'L-shape': {
                "type": "MultiPolygon",
                "coordinates":
                [
                    [
                        [
                            addOffsetToCoordinates(anchor, 5 * KM, 5 * KM),
                            addOffsetToCoordinates(anchor, 20 * KM, 5 * KM),
                            addOffsetToCoordinates(anchor, 20 * KM, 15 * KM),
                            addOffsetToCoordinates(anchor, 14 * KM, 15 * KM),
                            addOffsetToCoordinates(anchor, 14 * KM, 10 * KM),
                            addOffsetToCoordinates(anchor, 5 * KM, 10 * KM),
                            addOffsetToCoordinates(anchor, 5 * KM, 5 * KM),
                        ].map(gpsToArray),
                    ],
                ],
            },
            '2 boxes': {
                "type": "MultiPolygon",
                "coordinates":
                [
                    [
                        [
                            addOffsetToCoordinates(anchor, 5 * KM, 1 * KM),
                            addOffsetToCoordinates(anchor, 15 * KM, 1 * KM),
                            addOffsetToCoordinates(anchor, 15 * KM, 6 * KM),
                            addOffsetToCoordinates(anchor, 5 * KM, 6 * KM),
                            addOffsetToCoordinates(anchor, 5 * KM, 1 * KM),
                        ].map(gpsToArray),
                    ],
                    [
                        [
                            addOffsetToCoordinates(anchor, 5 * KM, 12 * KM),
                            addOffsetToCoordinates(anchor, 15 * KM, 12 * KM),
                            addOffsetToCoordinates(anchor, 15 * KM, 17 * KM),
                            addOffsetToCoordinates(anchor, 5 * KM, 17 * KM),
                            addOffsetToCoordinates(anchor, 5 * KM, 12 * KM),
                        ].map(gpsToArray),
                    ],
                ]
            },
        };
    }

    startQuery(data: { 
        periodId: string,
        geometryId: string,
        vehicleTypes: string[],
        limit: number,
        timeout: number,
        parallelize: boolean,
        useChunking: boolean,
    }) {
        const geometryId = data.geometryId;
        if (!geometryId) {
            return;
        }
        const periodId = data.periodId;
        if (!periodId) {
            return;
        }
        this.logger.info(`Start ${geometryId} query for ${periodId}`);
        const geometry = this.geometries[geometryId];
        if (!geometry) {
            return;
        }
        const period = this.periods[periodId];        
        if (!period) {
            return;
        }
        this.query({
            type: 'vehicle-query-request',
            id: randomUUID(),
            fromDate: period.from,
            toDate: period.to,
            geometry,
            vehicleTypes: data.vehicleTypes,
            limit: data.limit ?? 1000000,
            parallelize: data.parallelize,
            useChunking: data.useChunking,
        }, (data.timeout ?? 30) * 1000).catch(console.error);
    }

    private reset() {
        this._currentQuery = undefined;
        this._lastQueryResultStats = undefined;
        this._lastUpdateTimestamp = undefined;
        this._vehicleIds.clear();
        this.vehicleIds.value = [];
        this.resultCount.value = 0;
        this.statValues.value = this.createStats();
    }

    private createStats(): StatValue[] {
        const result: StatValue[] = [
            {
                unitPlural: 'Matched vehicles',
                value: this._vehicleIds.size,
            },
            {
                unitPlural: 'Matched positions',
                value: this.resultCount.value,
            },

        ];
        if (this._lastQueryResultStats) {
            result.push(...[
                {
                    unitPlural: 'Processed records',
                    value: this._lastQueryResultStats.processedRecordCount,
                },    
                {
                    unitPlural: 'Processed files',
                    value: this._lastQueryResultStats.processedFilesCount,
                },    
                {
                    unitPlural: 'Processed bytes',
                    value: this._lastQueryResultStats.processedBytes,
                    unitType: 'B',
                },    
                {
                    unitPlural: 'Records / sec',
                    value: this._lastQueryResultStats.processedRecordCount / (this._lastQueryResultStats.elapsedTimeInMS / 1000),
                },    
                {
                    unitPlural: 'Elapsed time',
                    value: this._lastQueryResultStats.elapsedTimeInMS,
                    unitType: 'ms',
                },    
            ]);
            const flags: string[] = [];
            if (this._lastQueryResultStats.timeoutExpired) {
                flags.push('timeout');
            }
            if (this._lastQueryResultStats.limitReached) {
                flags.push('limit');
            }
            if (flags.length > 0) {
                result.push({
                    unitPlural: 'Exceeded',
                    flags,
                });
            }
        }
        return result;
    }

    private async query(q: VehicleQueryRequest, timeout: number) {
        this.reset();
        this._currentQuery = q;
        this._lastUpdateTimestamp = new Date();
        try {
            const resp = await this._messageBus.request(q, {
                path: requests.vehicles.query.publish({}),
                id: q.id,
                timeout,            
            });
            if (isResponseSuccess(resp)) {
                this.logger.debug('Received query response', resp.body);
                const body = resp.body.body;
                if (isVehicleQueryResponse(body)) {
                    this.logger.debug('Received query result stats', body);
                    this._lastQueryResultStats = body;
                    this.statValues.value = this.createStats();            
                }
            }
    
        } catch (err: any) {
            if (err instanceof RequestTimeoutError) {
                this.logger.warn('Request timed out', err);
            } else {
                throw err;
            }
        }
    }

    private onProcessQueryResult(ev: VehicleQueryResult): void {
        if (!ev.vehicleId) {
            return;
        }
        if (this._currentQuery && this._currentQuery.id !== ev.queryId) {
            return;
        }
        this.logger.trace('Processing query response', ev);
        const id = parseInt(ev.vehicleId);
        if (!this._vehicleIds.has(id)) {
            this._vehicleIds.add(id);
            const vehicleIds = [...this._vehicleIds];
            vehicleIds.sort((a, b) => a - b);
            this.vehicleIds.value = vehicleIds;
        }
        this.resultCount.value += 1;
        const now = new Date();
        if (this._lastUpdateTimestamp && (now.getTime() - this._lastUpdateTimestamp.getTime()) >= 1000) {
            this._lastUpdateTimestamp = now;
            this.statValues.value = this.createStats();
        }
    }
    
}