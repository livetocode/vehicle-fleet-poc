import { MoveCommand } from "core-lib";
import { DataPartitionStrategy } from "./DataPartitionStrategy.js";

export class CollectorIndexDataPartitionStrategy extends DataPartitionStrategy<MoveCommand> {
    constructor(private collectorIndex: number) {
        super();
    }

    getPartitionKey(entity: MoveCommand): string {
        return this.collectorIndex.toString();
    }    
}