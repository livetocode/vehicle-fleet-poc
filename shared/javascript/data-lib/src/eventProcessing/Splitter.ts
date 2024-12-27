export type PartitionKeyProvider<T> = (item: T) => string;

export class Splitter<T> {
    private groups = new Map<string, T[]>();

    constructor(private partitionKeyProvider: PartitionKeyProvider<T>) {
    }

    add(obj: T) {
        const key = this.partitionKeyProvider(obj);
        let items = this.groups.get(key);
        if (!items) {
            items = [];
            this.groups.set(key, items);
        }
        items.push(obj);
    }
    
    addObjects(objects: T[]) {
        for (const obj of objects) {
            this.add(obj);
        }
    }

    clear() {
        this.groups.clear();
    }

    *enumerate() {
        for (const [groupKey, groupItems] of this.groups) {
            yield { groupKey, groupItems };
        }
    }
}