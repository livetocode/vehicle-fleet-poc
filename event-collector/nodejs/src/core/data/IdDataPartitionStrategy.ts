import { MoveCommand } from "core-lib";
import { DataPartitionStrategy } from "./DataPartitionStrategy.js";

export class IdDataPartitionStrategy extends DataPartitionStrategy<MoveCommand> {
    getPartitionKey(entity: MoveCommand): string {
        return entity.vehicleId;
    }    
}