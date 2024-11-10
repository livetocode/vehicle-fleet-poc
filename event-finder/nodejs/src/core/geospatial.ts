import * as turf from '@turf/turf';
import { Feature, Polygon } from 'geojson';
import { GpsCoordinates } from 'core-lib';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const geohash = require('ngeohash');

// This function was copied from https://github.com/Bonsanto/polygon-geohasher/blob/master/polygon_geohasher/polygon_geohasher.py
// and converted by ChatGPT.
export function polygonToGeohashes(polygon: Feature<Polygon>, precision: number, inner: boolean = true): Set<string> {
    const innerGeohashes = new Set<string>();
    const outerGeohashes = new Set<string>();

    const envelope = turf.envelope(polygon);
    const centroid = turf.centroid(polygon);

    const testingGeohashes: string[] = [];
    testingGeohashes.push(geohash.encode(centroid.geometry.coordinates[1], centroid.geometry.coordinates[0], precision));

    while (testingGeohashes.length > 0) {
        const currentGeohash = testingGeohashes.shift()!;

        if (!innerGeohashes.has(currentGeohash) && !outerGeohashes.has(currentGeohash)) {
            const currentPolygon = geohashToPolygon(currentGeohash);

            const condition = inner ? turf.booleanContains(envelope, currentPolygon) : turf.booleanIntersects(envelope, currentPolygon);

            if (condition) {
                if (inner) {
                    if (turf.booleanContains(polygon, currentPolygon)) {
                        innerGeohashes.add(currentGeohash);
                    } else {
                        outerGeohashes.add(currentGeohash);
                    }
                } else {
                    if (turf.booleanIntersects(polygon, currentPolygon)) {
                        innerGeohashes.add(currentGeohash);
                    } else {
                        outerGeohashes.add(currentGeohash);
                    }
                }
                const neighbors = geohash.neighbors(currentGeohash);
                for (const neighbor of neighbors) {
                    if (!innerGeohashes.has(neighbor) && !outerGeohashes.has(neighbor)) {
                        testingGeohashes.push(neighbor);
                    }
                }
            }
        }
    }

    return innerGeohashes;
}

export function geohashToPolygon(value: string): Feature<Polygon> {
    const bbox = geohash.decode_bbox(value);
    const coordinates = [
        [
            [bbox[1], bbox[0]],
            [bbox[3], bbox[0]],
            [bbox[3], bbox[2]],
            [bbox[1], bbox[2]],
            [bbox[1], bbox[0]]
        ]
    ];
    return turf.polygon(coordinates);
}

export function gpsCoordinatesToPolyon(coords: GpsCoordinates[]) {
    const positions = coords.map(x => [x.lon, x.lat]);
    return turf.polygon([positions]);
}