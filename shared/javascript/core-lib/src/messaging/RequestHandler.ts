import { randomUUID } from "../utils.js";
import { EventHandler } from "./EventHandler.js";
import { MessageBus } from "./MessageBus.js";
import { MessageEnvelope } from "./MessageEnvelope.js";
import { Request } from "./Requests.js";
import { TypedMessage } from "./TypedMessage.js";

export abstract class RequestHandler<TRequestBody extends TypedMessage, TResponse> extends EventHandler<Request<TRequestBody>> {

    constructor(protected messageBus: MessageBus) {
        super();
    }
    
    async process(msg: MessageEnvelope<Request<TRequestBody>>): Promise<void> {
        const event = msg.body;
        if (event.expiresAt) {
            const expiredAt = new Date(event.expiresAt);
            if (expiredAt < new Date()) {
                return;
            }
        }
        try {
            const resp = await this.processRequest(msg);
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

    protected abstract processRequest(req: MessageEnvelope<Request<TRequestBody>>): Promise<TResponse>;

}