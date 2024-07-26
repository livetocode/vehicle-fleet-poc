import type { AggregateFileStats } from "core-lib";
import { LambdaEventHandler, type EventHandler, type MessageBus } from "./messaging";
import { ref } from 'vue';

export class Stats {
    public events = ref<AggregateFileStats[]>([]);
    public totalEventCount = ref<number>(0);
    public totalFileCount = ref<number>(0);
    public totalSize = ref<number>(0);
    private _statsHandler?: EventHandler;
    constructor(private _messageBus: MessageBus) {}

    async init(): Promise<void> {
        this._statsHandler = new LambdaEventHandler(['aggregate-file-stats'], async (ev: any) => { this.onProcessStats(ev); });
        this._messageBus.registerHandlers(this._statsHandler);
    }

    async dispose(): Promise<void> {
        if (this._statsHandler) {
            this._messageBus?.unregisterHandler(this._statsHandler);
            this._statsHandler = undefined;
        }
    }

    private onProcessStats(ev: AggregateFileStats): void {
        console.log(ev);
        this.events.value = [...this.events.value, ev];
        // this.events.push(ev);
        this.totalEventCount.value += ev.eventCount;
        this.totalFileCount.value += ev.files.length;
        this.totalSize.value += ev.files.map(x => x.size).reduce((a, b) => a + b, 0);
    }

}