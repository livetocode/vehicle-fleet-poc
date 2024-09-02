import { roundDecimals, type VehicleQueryResult, type Logger, type VehicleQuery, type VehicleQueryResultStats, addOffsetToCoordinates, KM, type Config } from "core-lib";
import { LambdaEventHandler, type EventHandler, type MessageBus } from "../utils/messaging";
import { ref } from 'vue';

export class VehicleQuerierViewModel {
    public vehicleIds = ref<number[]>([]);
    public resultCount = ref<number>(0);
    public stats = ref<any>(null);
    private _queryResultHandler?: EventHandler;
    private _queryResultStatsHandler?: EventHandler;
    private _vehicleIds = new Set<number>();
    private _currentQuery?: VehicleQuery;
    
    constructor(private config: Config, private _messageBus: MessageBus, private logger: Logger) {}

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

    simpleQuery() {
        this.logger.info('Start simple query');
        const anchor = this.config.generator.map.topLeftOrigin;
        this.query({
            type: 'vehicle-query',
            id: crypto.randomUUID(),
            fromDate: '2024-01-01T00:05:00-05:00',
            toDate:   '2024-01-01T00:15:00-05:00',
            polygon: [
                addOffsetToCoordinates(anchor, 5 * KM, 5 * KM),
                addOffsetToCoordinates(anchor, 10 * KM, 5 * KM),
                addOffsetToCoordinates(anchor, 10 * KM, 8 * KM),
                addOffsetToCoordinates(anchor, 5 * KM, 8 * KM),
                addOffsetToCoordinates(anchor, 5 * KM, 5 * KM),
            ],
            limit: 1000000,
        })
    }

    mediumQuery() {
        this.logger.info('Start medium query');
        const anchor = this.config.generator.map.topLeftOrigin;
        this.query({
            type: 'vehicle-query',
            id: crypto.randomUUID(),
            fromDate: '2024-01-01T00:05:00-05:00',
            toDate:   '2024-01-01T01:05:00-05:00',
            polygon: [
                addOffsetToCoordinates(anchor, 5 * KM, 5 * KM),
                addOffsetToCoordinates(anchor, 20 * KM, 5 * KM),
                addOffsetToCoordinates(anchor, 20 * KM, 10 * KM),
                addOffsetToCoordinates(anchor, 5 * KM, 10 * KM),
                addOffsetToCoordinates(anchor, 5 * KM, 5 * KM),
            ],
            limit: 1000000,
        })
    }

    lshapeQuery() {
        this.logger.info('Start L-shape query');
        const anchor = this.config.generator.map.topLeftOrigin;
        this.query({
            type: 'vehicle-query',
            id: crypto.randomUUID(),
            fromDate: '2024-01-01T00:05:00-05:00',
            toDate:   '2024-01-01T01:05:00-05:00',
            polygon: [
                addOffsetToCoordinates(anchor, 5 * KM, 5 * KM),
                addOffsetToCoordinates(anchor, 20 * KM, 5 * KM),
                addOffsetToCoordinates(anchor, 20 * KM, 15 * KM),
                addOffsetToCoordinates(anchor, 14 * KM, 15 * KM),
                addOffsetToCoordinates(anchor, 14 * KM, 10 * KM),
                addOffsetToCoordinates(anchor, 5 * KM, 10 * KM),
                addOffsetToCoordinates(anchor, 5 * KM, 5 * KM),
            ],
            limit: 1000000,
        })
    }

    private reset() {
        this._currentQuery = undefined;
        this._vehicleIds.clear();
        this.vehicleIds.value = [];
        this.resultCount.value = 0;
        this.stats.value = null;
    }

    private query(q: VehicleQuery) {
        this.reset();
        this._currentQuery = q;
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
    }
    
    private onProcessQueryResultStats(ev: VehicleQueryResultStats): void {
        if (this._currentQuery && this._currentQuery.id !== ev.queryId) {
            return;
        }
        this.stats.value = ev;
    }
}