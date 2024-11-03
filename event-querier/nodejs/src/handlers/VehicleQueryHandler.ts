import { GenericEventHandler } from "messaging-lib";
import { Config, VehicleQuery, Stopwatch, Logger, VehicleQueryResult, TimeRange, dateToUtcParts, calcTimeWindow, VehicleQueryResultStats } from 'core-lib';
import { MessageBus } from "messaging-lib";
import fs from 'fs';
import path from 'path';
import pl from 'nodejs-polars';
import { gpsCoordinatesToPolyon, polygonToGeohashes } from "../core/geospatial.js";
import { Feature, GeoJsonProperties, Polygon } from "geojson";
import * as turf from '@turf/turf';

export class VehicleQueryHandler extends GenericEventHandler<VehicleQuery> {
    private processedFilesCount = 0;
    private processedBytes = 0;
    private processedRecordCount = 0;
    private selectedRecordCount = 0;
    private distinctVehicles = new Set<string>();

    constructor(
        private config: Config,
        private logger: Logger,
        private messageBus: MessageBus,
    ) {
        super();
    }

    get eventTypes(): string[] {
        return ['vehicle-query', 'vehicle-query-partition']; 
    }

    protected async processTypedEvent(event: VehicleQuery): Promise<void> {
        this.logger.debug('Received query', event);
        if (event.ttl && event.ttl < new Date().toISOString()) {
            this.logger.warn('Ignoring request because its TTL has been exceeded');
            return;
        }
        this.resetStats();
        const fromDate = new Date(event.fromDate);
        const toDate = new Date(event.toDate);
        if (fromDate.getTime() > toDate.getTime()) {
            throw new Error('fromDate must be less than toDate');
        }
        const watch = new Stopwatch();
        watch.start();
        const polygon = gpsCoordinatesToPolyon(event.polygon);
        const geohashes = this.createGeohashes(polygon);
        let timeoutExpired = false;
        let limitReached = false;
        for (const filename of this.enumerateFiles(fromDate, toDate, geohashes)) {
            this.processedFilesCount += 1;
            const status = this.processFile(event, fromDate, toDate, polygon, watch, filename);
            limitReached = status.limitReached;
            timeoutExpired = status.timeoutExpired;
            if (limitReached || timeoutExpired) {
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
            selectedRecordCount: this.selectedRecordCount,
            distinctVehicleCount: this.distinctVehicles.size,
            timeoutExpired,
            limitReached,
        };
        this.logger.debug('Stats', stats);
        this.messageBus.publish(event.replyTo, stats);
    }

    private processFile(
        event: VehicleQuery,
        fromDate: Date,
        toDate: Date,
        polygon: Feature<Polygon, GeoJsonProperties>,
        watch: Stopwatch,
        filename: string,
    ) {
        const timeout = event.timeout ?? this.config.querier.defaultTimeoutInMS;
        let timeoutExpired = false;
        let limitReached = false;
        for (const res of this.searchFile(event.id, filename, fromDate, toDate, polygon, event.vehicleTypes)) {
            this.messageBus.publish(event.replyTo, res);
            this.selectedRecordCount += 1;
            this.distinctVehicles.add(res.vehicleId);
            if (event.limit && this.selectedRecordCount >= event.limit) {
                limitReached = true;
                break;
            }
        }
        if (!limitReached && watch.elapsedTimeInMS() >= timeout) {
            timeoutExpired = true;
        }
        return { limitReached, timeoutExpired };
    }

    private resetStats() {
        this.processedFilesCount = 0;
        this.processedRecordCount = 0;
        this.selectedRecordCount = 0;
        this.distinctVehicles.clear();
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
        let dataFolder = this.config.collector.output.folder;
        if (this.config.collector.output.flatLayout === false) {
            dataFolder = path.join(dataFolder, this.config.querier.dataFormat);
            const commonRoots = findCommonRootParts(fromDate, toDate);
            for (const commonRoot of commonRoots) {
                dataFolder = path.join(dataFolder, commonRoot);
            }
        }
        const fileExt = `.${this.config.querier.dataFormat}`;
        for (const { file, directory } of readAllFiles(dataFolder)) {
            if (file.name.endsWith(fileExt) && file.name >= fromPrefix && file.name < toPrefix) {
                const otherSegments = file.name.substring(fromPrefix.length + 1).split('-');
                const fileGeohash = otherSegments[0];
                if (geohashes.has(fileGeohash)) {
                    yield path.join(directory, file.name);
                }
            }
        }
    }

    private *searchFile(queryId: string, filename: string, fromDate: Date, toDate: Date, polygon: Feature<Polygon>, vehicleTypes: string[]) {
        this.logger.debug('search file ', filename);
        let df: pl.DataFrame;
        switch(this.config.querier.dataFormat) {
            case 'parquet':
                df = pl.readParquet(filename);
                break;
            case 'csv':
                df = pl.readCSV(filename);
                break;
            case 'json':
                df = pl.readJSON(filename);
                break;
            case 'arrow':
                df = pl.readIPC(filename);
                break;
            default:
                throw new Error(`Unsupported file format: ${this.config.querier.dataFormat}`);
        }
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

export function* readAllFiles(directory: string): Generator<{ file: fs.Dirent; directory: string }> {
    const files = fs.readdirSync(directory, { withFileTypes: true });
    files.sort((a, b) => a.name.localeCompare(b.name));
  
    for (const file of files) {
      if (file.isDirectory()) {
        yield* readAllFiles(path.join(directory, file.name));
      } else {
        yield { file, directory };
      }
    }
}

export function findCommonRootParts(d1: Date, d2: Date) {
    const dp1 = dateToUtcParts(d1);
    const dp2 = dateToUtcParts(d2);
    const result: string[] = [];
    for (let i = 0; i < dp1.length; i++) {
        if (dp1[i] === dp2[i]) {
            result.push(dp1[i]);
        } else {
            break;
        }
    }
    return result;
}