import { MoveCommand, computeHashNumber } from "core-lib";
import { DataPartitionStrategy } from "./DataPartitionStrategy.js";

export class IdGroupDataPartitionStrategy extends DataPartitionStrategy<MoveCommand> {
    constructor(private groupSize: number) {
        super();
    }

    getPartitionKey(entity: MoveCommand): string {
        const groupIndex = computeHashNumber(entity.vehicleId) % this.groupSize;
        return groupIndex.toString();
    }    
}