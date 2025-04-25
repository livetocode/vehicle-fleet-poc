import * as turf from '@turf/turf';
import { Feature, GeoJsonProperties, MultiPolygon } from "geojson";
import { Config, VehicleQueryRequest, Stopwatch, VehicleQueryPartitionResponse, Request } from 'core-lib';

export class VehicleQueryContext {
    processedFilesCount = 0;
    processedBytes = 0;
    processedRecordCount = 0;
    selectedRecordCount = 0;
    distinctVehicles = new Set<string>();
    watch = new Stopwatch();
    fromDate: Date;
    toDate: Date;
    geometry: Feature<MultiPolygon, GeoJsonProperties>;
    timeout: number;
    parallelize: boolean;
    useChunking: boolean;
    timeoutExpired = false;
    limitReached = false;    

    constructor(public config: Config, public event: Request<VehicleQueryRequest>) {
        this.watch.start();
        this.fromDate = new Date(event.body.fromDate);
        this.toDate = new Date(event.body.toDate);
        if (this.fromDate.getTime() > this.toDate.getTime()) {
            throw new Error('fromDate must be less than toDate');
        }
        this.geometry = turf.multiPolygon(event.body.geometry.coordinates);
        this.timeout = event.timeout ?? this.config.finder.defaultTimeoutInMS;
        this.parallelize = event.body.parallelize ?? this.config.finder.parallelSearch;
        this.useChunking = event.body.useChunking ?? this.config.finder.useChunking;
    }

    hasTimedOut(): boolean {
        return this.watch.elapsedTimeInMS() >= this.timeout;
    }

    shouldAbort(): boolean {
        return this.timeoutExpired || this.limitReached;
    }

    checkIfLimitWasReached() {
        if (!this.limitReached && this.event.body.limit) {
            this.limitReached = this.selectedRecordCount >= this.event.body.limit;
        }
        return this.limitReached;
    }

    checkTimeout() {
        if (!this.timeoutExpired && !this.limitReached) {
            this.timeoutExpired = this.hasTimedOut();
        }
        return this.timeoutExpired;
    }

    processSubQueryResponse(resp: VehicleQueryPartitionResponse) {
        this.selectedRecordCount += resp.partialResponse.selectedRecordCount;
        this.processedBytes += resp.partialResponse.processedBytes;
        this.processedFilesCount += resp.partialResponse.processedFilesCount;
        this.processedRecordCount += resp.partialResponse.processedRecordCount;
        for (const vehicleId of resp.distinctVehicleIds) {
            this.distinctVehicles.add(vehicleId);
        }
        this.checkIfLimitWasReached();
        this.checkTimeout();
    }
}