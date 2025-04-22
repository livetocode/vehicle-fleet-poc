import { Logger } from "core-lib";

export type Container<TItem> = {
    get size(): number;
    add(item: TItem): Promise<void>;
    flush(isPartial: boolean): Promise<void>;
}

export type KeyProvider<TItem> = (obj: TItem) => string;
export type ContainerFactory<TItem> = () => Container<TItem>;

export type ContainerPersisterArgs<TItem> = {
    items: TItem[];
    isPartialFlush: boolean;
    partialFlushCounter: number;
}

export type ContainerPersister<TItem> = (args: ContainerPersisterArgs<TItem>) => Promise<void>;

export class OutOfOrderError extends Error {

}

export class ContainerManager<TItem> {
    private containers: Container<TItem>[] = [];
    private _totalItemsCount = 0;
    private isDirty = false;

    constructor(private logger: Logger, private capacity: number, private flushThresholdRatio: number) {
        if (capacity < 1) {
            throw new Error(`Capacity must be >= 1, but received: ${capacity}`);
        }
    }

    private get totalItemsCount() {
        if (this.isDirty) {
            this._totalItemsCount = this.computeTotalItemsCount();
        }
        return this._totalItemsCount;
    }

    add(container: Container<TItem>): void {
        this.containers.push(container);
    }

    remove(container: Container<TItem>): void {
        const idx = this.containers.findIndex(x => x === container);
        if (idx >= 0) {
            this.containers.splice(idx, 1);
            this.isDirty = true;
        }
    }

    onItemAdded(item: TItem): void {
        this._totalItemsCount += 1;
    }

    onFlush(container: Container<TItem>) {
        this.isDirty = true;        
    }

    hasCapacity(): boolean {
        return this.totalItemsCount < this.capacity;
    }

    async manageCapacity(): Promise<void> {
        const threshold = Math.round(this.capacity * this.flushThresholdRatio);

        const selectedContainers: Container<TItem>[] = [];
        let selectedSize = 0;
        this.containers.sort((a, b) => b.size - a.size); // sort in decreasing size order
        for (const container of this.containers) {
            selectedContainers.push(container);
            selectedSize += container.size;
            if (selectedSize > threshold) {
                break;
            }
        }
        this.logger.debug(`Manager will flush ${selectedContainers.length} of ${this.containers.length} containers to reclaim ${selectedSize} objects`);
        for (const container of selectedContainers) {
            await container.flush(true);
        }
        this.isDirty = true;
    }

    private computeTotalItemsCount() {
        let result = 0;
        for (const container of this.containers) {
            result += container.size;
        }
        return result;
    }
}


export class ArrayContainer<TItem> implements Container<TItem> {
    private items: TItem[] = [];
    private partialFlushCounter = 0;

    constructor(
        private manager: ContainerManager<TItem>,
        private persister: ContainerPersister<TItem>,
    ) {}

    get size(): number {
        return this.items.length;
    }

    async add(item: TItem): Promise<void> {
        this.items.push(item);
        this.manager.onItemAdded(item);
        if (!this.manager.hasCapacity()) {
            await this.manager.manageCapacity();
        }
    }

    async flush(isPartial: boolean): Promise<void> {
        if (this.items.length === 0) {
            return;
        }
        this.manager.onFlush(this);
        await this.persister({
            items: this.items,
            isPartialFlush: isPartial,
            partialFlushCounter: this.partialFlushCounter,
        });
        this.items = [];
        if (isPartial) {
            this.partialFlushCounter += 1;
        } else {
            this.partialFlushCounter = 0;
        }
    }
}

export class MapContainer<TItem> implements Container<TItem> {
    private items = new Map<string, Container<TItem>>();

    constructor(
        private manager: ContainerManager<TItem>,
        private keyProvider: KeyProvider<TItem>,
        private containerFactory: ContainerFactory<TItem>,
    ) {}

    get size(): number {
        return 0;
    }

    async add(item: TItem): Promise<void> {
        const key = this.keyProvider(item);
        let container = this.items.get(key);
        if (!container) {
            container = this.containerFactory();
            this.manager.add(container);
            this.items.set(key, container);
        }
        await container.add(item);
    }

    async flush(isPartial: boolean): Promise<void> {
        this.manager.onFlush(this);
        for (const item of this.items.values()) {
            await item.flush(isPartial);
            this.manager.remove(item);
        }
        this.items.clear();
    }
}

export type KeyContainerPair<TItem> = [string, Container<TItem>];

export class SortedContainer<TItem> implements Container<TItem> {
    private items: KeyContainerPair<TItem>[] = [];

    constructor(
        private capacity: number,
        private manager: ContainerManager<TItem>,
        private keyProvider: KeyProvider<TItem>,
        private containerFactory: ContainerFactory<TItem>,
    ) {
        if (capacity < 1) {
            throw new OutOfOrderError(`Capacity must be >= 1, but received: ${capacity}`);
        }
    }

    get size(): number {
        return 0;
    }

    async add(item: TItem): Promise<void> {
        const key = this.keyProvider(item);
        let container = this.items.find(x => x[0] === key)?.[1];
        if (!container) {
            await this.checkCapacity(key);
            container = this.containerFactory();
            this.manager.add(container);
            this.items.push([key, container]);
            this.items.sort((a, b) => a[0].localeCompare(b[0]));
        }
        await container.add(item);
    }

    async flush(isPartial: boolean): Promise<void> {
        this.manager.onFlush(this);
        for (const item of this.items) {
            await item[1].flush(isPartial);
            this.manager.remove(item[1]);
        }
        this.items = [];
    }

    private async checkCapacity(key: string) {
        if (this.items.length === this.capacity) {
            const firstKey = this.items[0][0];
            if (key < firstKey) {
                throw new Error(`New item should always have a greater key than the current upper key: ${key} should be greater than ${firstKey}`);
            }
            const first = this.items.shift();
            if (first) {
                this.manager.remove(first[1]);
                await first[1].flush(false);
            }
        }
    }
}


