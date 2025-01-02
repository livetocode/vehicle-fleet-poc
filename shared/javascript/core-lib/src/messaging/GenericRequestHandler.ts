import { randomUUID } from "../utils.js";
import { GenericEventHandler } from "./GenericEventHandler.js";
import { MessageBus } from "./MessageBus.js";
import { Request, TypedMessage } from "./Requests.js";

export abstract class GenericRequestHandler<TRequestBody extends TypedMessage, TResponse> extends GenericEventHandler<Request<TRequestBody>> {

    constructor(protected messageBus: MessageBus) {
        super();
    }
    
    protected async processTypedEvent(event: Request<TRequestBody>): Promise<void> {
        // TODO: check if request has expired or should abort before processing
        try {
            const resp = await this.processRequest(event);
            this.messageBus.reply(event, {
                type: 'response-success',
                id: randomUUID(),
                requestId: event.id,
                body: resp,
            });
        } catch(err : any) {
            this.messageBus.reply(event, {
                type: 'response-error',
                code: 'exception',
                id: randomUUID(),
                requestId: event.id,
                error: err.toString(),
            });
            throw err;
        }
    }

    protected abstract processRequest(req: Request<TRequestBody>): Promise<TResponse>;

}