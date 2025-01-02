export abstract class EventHandler {
    abstract get eventTypes(): string[];
    abstract process(event: any): Promise<void>;
}
