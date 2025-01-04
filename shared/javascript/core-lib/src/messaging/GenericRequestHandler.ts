import { randomUUID } from "../utils.js";
import { GenericEventHandler } from "./GenericEventHandler.js";
import { MessageBus } from "./MessageBus.js";
import { Request } from "./Requests.js";
import { TypedMessage } from "./TypedMessage.js";

export abstract class GenericRequestHandler<TRequestBody extends TypedMessage, TResponse> extends GenericEventHandler<Request<TRequestBody>> {

    constructor(protected messageBus: MessageBus) {
        super();
    }
    
    protected async processTypedEvent(event: Request<TRequestBody>): Promise<void> {
        if (event.expiresAt) {
            const expiredAt = new Date(event.expiresAt);
            if (expiredAt < new Date()) {
                return;
            }
        }
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