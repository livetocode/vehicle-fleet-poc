export abstract class EventHandler {
    abstract get eventTypes(): string[];
    abstract init(): Promise<void>;
    abstract process(event: any): Promise<void>;
}
