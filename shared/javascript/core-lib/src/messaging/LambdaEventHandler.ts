import { EventHandler } from "./EventHandler.js";

export class LambdaEventHandler implements EventHandler {
    constructor(private _eventTypes: string[], private handler: (e: any) => Promise<void>) {}

    get eventTypes(): string[] {
        return this._eventTypes;
    }

    process(event: any): Promise<void> {
        return this.handler(event);
    }
}
