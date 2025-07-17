export type EventCallback = (data: any) => void;

export class CustomEventEmitter{
    private callbacks: any = {};

    on(event: string, cb: EventCallback){
        let handlers = this.callbacks[event];
        if (!handlers) {
            handlers = [];
            this.callbacks[event] = handlers;
        }
        handlers.push(cb);
    }

    emit(event: string, data?: any){
        const handlers = this.callbacks[event];
        if(handlers){
            handlers.forEach((cb: EventCallback) => cb(data));
        }
    }
}