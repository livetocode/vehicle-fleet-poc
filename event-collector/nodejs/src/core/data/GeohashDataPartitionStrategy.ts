import { MoveCommand } from "core-lib";
import { DataPartitionStrategy } from "./DataPartitionStrategy.js";
import Geohash from 'latlon-geohash';

export class GeohashDataPartitionStrategy extends DataPartitionStrategy<MoveCommand> {
    constructor(private geohashLength: number) {
        super();
    }

    getPartitionKey(entity: MoveCommand): string {
        const geoHash = (Geohash as any).encode(entity.gps.lat, entity.gps.lon, this.geohashLength); 
        return geoHash;
    }    
}