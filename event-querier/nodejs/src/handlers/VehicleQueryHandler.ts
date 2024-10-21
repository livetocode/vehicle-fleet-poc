import { GenericEventHandler } from "messaging-lib";
import { Config, VehicleQuery, Stopwatch, Logger, VehicleQueryResult, TimeRange, dateToUtcParts, calcTimeWindow, VehicleQueryResultStats } from 'core-lib';
import { MessageBus } from "messaging-lib";
import fs from 'fs';
import path from 'path';
import pl from 'nodejs-polars';
import { gpsCoordinatesToPolyon, polygonToGeohashes } from "../core/geospatial.js";
import { Feature, Polygon } from "geojson";
import * as turf from '@turf/turf';

export class VehicleQueryHandler extends GenericEventHandler<VehicleQuery> {
    private processedFilesCount = 0;
    private processedBytes = 0;
    private processedRecordCount = 0;
    constructor(
        private config: Config,
        private logger: Logger,
        private messageBus: MessageBus,
    ) {
        super();
    }

    get eventTypes(): string[] {
        return ['vehicle-query']; 
    }

    protected async processTypedEvent(event: VehicleQuery): Promise<void> {
        this.logger.debug('Received query', event);
        this.resetStats();
        const timeout = event.timeout ?? this.config.querier.defaultTimeoutInMS;
        const fromDate = new Date(event.fromDate);
        const toDate = new Date(event.toDate);
        if (fromDate.getTime() > toDate.getTime()) {
            throw new Error('fromDate must be less than toDate');
        }
        const distinctVehicles = new Set<string>();
        const watch = new Stopwatch();
        watch.start();
        const polygon = gpsCoordinatesToPolyon(event.polygon);
        const geohashes = this.createGeohashes(polygon);
        let timeoutExpired = false;
        let limitReached = false;
        let selectedRecordCount = 0;
        for (const filename of this.enumerateFiles(fromDate, toDate, geohashes)) {
            this.processedFilesCount += 1;
            for (const res of this.searchFile(event.id, filename, fromDate, toDate, polygon, event.vehicleTypes)) {
                this.publishResult(res);
                selectedRecordCount += 1;
                distinctVehicles.add(res.vehicleId);
                if (event.limit && selectedRecordCount >= event.limit) {
                    limitReached = true;
                    break;
                }
            }
            if (limitReached) {
                break;
            }
            if (watch.elapsedTimeInMS() >= timeout) {
                timeoutExpired = true;
                break;
            }
        }
        watch.stop();
        const stats: VehicleQueryResultStats = {
            type: 'vehicle-query-result-stats',
            queryId: event.id,
            elapsedTimeInMS: watch.elapsedTimeInMS(),
            processedFilesCount: this.processedFilesCount,
            processedBytes: this.processedBytes,
            processedRecordCount: this.processedRecordCount,
            selectedRecordCount,
            distinctVehicleCount: distinctVehicles.size,
            timeoutExpired,
            limitReached,
        };
        this.logger.debug('Stats', stats);
        this.messageBus.publish('query.vehicles.results', stats);
    }

    private resetStats() {
        this.processedFilesCount = 0;
        this.processedRecordCount = 0;
    }

    private publishResult(result: VehicleQueryResult) {
        this.messageBus.publish('query.vehicles.results', result);
    }

    private createGeohashes(polygon: Feature<Polygon>) {
        if (this.config.partitioning.dataPartition.type === 'geohash') {
            return polygonToGeohashes(polygon, this.config.partitioning.dataPartition.hashLength, false);

        }
        return new Set<string>();
    }

    private *enumerateFiles(fromDate: Date, toDate: Date, geohashes: Set<string>) {
        const periodInMin = this.config.partitioning.timePartition.aggregationPeriodInMin;
        const fromPrefix = calcTimeWindow(fromDate, periodInMin).toString();
        const toRange = calcTimeWindow(toDate, periodInMin);
        const toPrefix = dateToUtcParts(toRange.untilTime).join('-');
        if (this.config.collector.output.type !== 'file') {
            throw new Error('Expected output type to be "file"');
        }
        const dataFolder = this.config.collector.output.folder;
        const filenames = fs.readdirSync(dataFolder);
        filenames.sort();
        for (const filename of filenames) {
            if (filename >= fromPrefix && filename < toPrefix) {
                const otherSegments = filename.substring(fromPrefix.length + 1).split('-');
                const fileGeohash = otherSegments[0];
                if (geohashes.has(fileGeohash)) {
                    yield path.join(dataFolder, filename);
                }
            }
        }
    }

    private *searchFile(queryId: string, filename: string, fromDate: Date, toDate: Date, polygon: Feature<Polygon>, vehicleTypes: string[]) {
        this.logger.debug('search file ', filename);
        const df = pl.readParquet(filename);
        const fstats = fs.statSync(filename);
        this.processedBytes += fstats.size;
        const colNames = df.columns;
        const idx_timestamp = colNames.indexOf('timestamp');
        const idx_vehicleId = colNames.indexOf('vehicleId');
        const idx_vehicleType = colNames.indexOf('vehicleType');
        const idx_gps_lat = colNames.indexOf('gps_lat');
        const idx_gps_lon = colNames.indexOf('gps_lon');
        const idx_gps_alt = colNames.indexOf('gps_alt');
        const idx_geoHash = colNames.indexOf('geoHash');
        const idx_speed = colNames.indexOf('speed');
        const idx_direction = colNames.indexOf('direction');
        for (const row of df.rows()) {
            this.processedRecordCount += 1;
            const timestamp = row[idx_timestamp];
            const vehicleId = row[idx_vehicleId];
            const vehicleType = row[idx_vehicleType];
            const gps_lat = row[idx_gps_lat];
            const gps_lon = row[idx_gps_lon];
            const gps_alt = row[idx_gps_alt];
            const geoHash = row[idx_geoHash];
            const speed = row[idx_speed];
            const direction = row[idx_direction];
            if (timestamp >= fromDate && timestamp <= toDate) {
                const pos = turf.point([gps_lon, gps_lat]);
                const isInsidePolygon = turf.booleanContains(polygon, pos);
                const isValidVehicle = vehicleTypes.length === 0 || vehicleTypes.includes(vehicleType);
                if (isInsidePolygon && isValidVehicle) {
                    const ev: VehicleQueryResult = {
                        type: 'vehicle-query-result',
                        queryId,
                        vehicleId,
                        vehicleType,
                        direction,
                        speed,
                        timestamp: timestamp.toISOString(),
                        gps: {
                            alt: gps_alt,
                            lat: gps_lat,
                            lon: gps_lon,
                        },
                        geoHash,
                    };
                    yield ev;    
                }
            }
        }
    }
}
