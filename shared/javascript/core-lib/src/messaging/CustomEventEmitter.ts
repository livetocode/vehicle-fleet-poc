export type EventCallback = (data: any) => void;

export class CustomEventEmitter{
    private callbacks = new Map<string, EventCallback[]>();

    on(event: string, cb: EventCallback){
        let handlers = this.callbacks.get(event);
        if (!handlers) {
            handlers = [];
            this.callbacks.set(event, handlers);
        }
        if (!handlers.includes(cb)) {
            handlers.push(cb);
        }
    }

    off(event: string, cb: EventCallback){
        let handlers = this.callbacks.get(event);
        if (handlers) {
            const idx = handlers.indexOf(cb);
            if (idx >= 0) {
                handlers.splice(idx, 1);
                if (handlers.length === 0) {
                    this.callbacks.delete(event);
                }
            }
        }
    }

    emit(event: string, data?: any){
        const handlers = this.callbacks.get(event);
        if(handlers){
            handlers.forEach((cb: EventCallback) => cb(data));
        }
    }
}