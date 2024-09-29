import { roundDecimals, type VehicleQueryResult, type Logger, type VehicleQuery, type VehicleQueryResultStats, addOffsetToCoordinates, KM, type Config } from "core-lib";
import { LambdaEventHandler, type EventHandler, type MessageBus } from "../utils/messaging";
import type { StatValue } from "../utils/types";
import { ref } from 'vue';

export class VehicleQuerierViewModel {
    public statValues = ref<StatValue[]>([]);
    public vehicleIds = ref<number[]>([]);
    public resultCount = ref<number>(0);
    public polygons: any;
    public periods: any;
    public fldPolygon = ref('Small box');
    public fldPeriod = ref('10 min');
    private _queryResultHandler?: EventHandler;
    private _queryResultStatsHandler?: EventHandler;
    private _vehicleIds = new Set<number>();
    private _currentQuery?: VehicleQuery;
    private _lastQueryResultStats?: VehicleQueryResultStats;
    private _lastUpdateTimestamp?: Date;
    
    constructor(private config: Config, private _messageBus: MessageBus, private logger: Logger) {
        this.polygons = this.createPolygons();
        this.periods = this.createPeriods();
        this.reset();
    }

    async init(): Promise<void> {
        this._queryResultHandler = new LambdaEventHandler(
            ['vehicle-query-result'], 
            async (ev: any) => { this.onProcessQueryResult(ev); },
        );
        this._queryResultStatsHandler = new LambdaEventHandler(
            ['vehicle-query-result-stats'], 
            async (ev: any) => { this.onProcessQueryResultStats(ev); },
        );
        this._messageBus.registerHandlers(this._queryResultHandler, this._queryResultStatsHandler);
    }

    async dispose(): Promise<void> {
        if (this._queryResultHandler) {
            this._messageBus?.unregisterHandler(this._queryResultHandler);
            this._queryResultHandler = undefined;
        }
        if (this._queryResultStatsHandler) {
            this._messageBus?.unregisterHandler(this._queryResultStatsHandler);
            this._queryResultStatsHandler = undefined;
        }
    }

    createPeriods() {
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
        };
    }

    createPolygons() {
        const anchor = this.config.generator.map.topLeftOrigin;
        return {
            'Small box': [
                addOffsetToCoordinates(anchor, 5 * KM, 5 * KM),
                addOffsetToCoordinates(anchor, 10 * KM, 5 * KM),
                addOffsetToCoordinates(anchor, 10 * KM, 8 * KM),
                addOffsetToCoordinates(anchor, 5 * KM, 8 * KM),
                addOffsetToCoordinates(anchor, 5 * KM, 5 * KM),
            ],
            'Medium box': [
                addOffsetToCoordinates(anchor, 5 * KM, 5 * KM),
                addOffsetToCoordinates(anchor, 20 * KM, 5 * KM),
                addOffsetToCoordinates(anchor, 20 * KM, 10 * KM),
                addOffsetToCoordinates(anchor, 5 * KM, 10 * KM),
                addOffsetToCoordinates(anchor, 5 * KM, 5 * KM),
            ],
            'L-shape': [
                addOffsetToCoordinates(anchor, 5 * KM, 5 * KM),
                addOffsetToCoordinates(anchor, 20 * KM, 5 * KM),
                addOffsetToCoordinates(anchor, 20 * KM, 15 * KM),
                addOffsetToCoordinates(anchor, 14 * KM, 15 * KM),
                addOffsetToCoordinates(anchor, 14 * KM, 10 * KM),
                addOffsetToCoordinates(anchor, 5 * KM, 10 * KM),
                addOffsetToCoordinates(anchor, 5 * KM, 5 * KM),
            ],
        };
    }

    startQuery(isActiveRef: any) {
        if (!this.fldPolygon.value) {
            return;
        }
        if (!this.fldPeriod.value) {
            return;
        }
        isActiveRef.value = false;
        this.logger.info(`Start ${this.fldPolygon.value} query for ${this.fldPeriod.value}`);
        const polygon = this.polygons[this.fldPolygon.value];
        const period = this.periods[this.fldPeriod.value];
        this.query({
            type: 'vehicle-query',
            id: crypto.randomUUID(),
            fromDate: period.from,
            toDate: period.to,
            polygon,
            limit: 1000000,
        });
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
        }
        return result;
    }

    private query(q: VehicleQuery) {
        this.reset();
        this._currentQuery = q;
        this._lastUpdateTimestamp = new Date();
        this._messageBus.publish('query.vehicles', q);
    }

    private onProcessQueryResult(ev: VehicleQueryResult): void {
        // this.logger.debug(ev);
        if (!ev.vehicleId) {
            return;
        }
        if (this._currentQuery && this._currentQuery.id !== ev.queryId) {
            return;
        }

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
    
    private onProcessQueryResultStats(ev: VehicleQueryResultStats): void {
        if (this._currentQuery?.id !== ev.queryId) {
            return;
        }
        this._lastQueryResultStats = ev;
        this.statValues.value = this.createStats();
    }
}