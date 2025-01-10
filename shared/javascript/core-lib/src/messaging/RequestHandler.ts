import { randomUUID } from "../utils.js";
import { EventHandler } from "./EventHandler.js";
import { IMessageBus } from "./IMessageBus.js";
import { MessageEnvelope } from "./MessageEnvelope.js";
import { Request, Response, RequestCancelledError } from "./Requests.js";
import { TypedMessage } from "./TypedMessage.js";

export abstract class RequestHandler<TRequestBody extends TypedMessage, TResponse> extends EventHandler<Request<TRequestBody>> {

    constructor(protected messageBus: IMessageBus) {
        super();
    }
    
    async process(msg: MessageEnvelope<Request<TRequestBody>>): Promise<void> {
        const event = msg.body;
        if (event.expiresAt) {
            const expiredAt = new Date(event.expiresAt);
            if (expiredAt < new Date()) {
                this.messageBus.reply(event, {
                    type: 'response-error',
                    code: 'expired',
                    id: randomUUID(),
                    requestId: event.id,
                });    
                return;
            }
        }
        try {
            const respBody = await this.processRequest(msg);
            const resp: Response = {
                type: 'response-success',
                id: randomUUID(),
                requestId: event.id,
                body: respBody,
            };
            this.messageBus.reply(event, resp);
        } catch(err : any) {
            if (err instanceof RequestCancelledError) {
                this.messageBus.reply(event, {
                    type: 'response-error',
                    code: 'cancelled',
                    id: randomUUID(),
                    requestId: event.id,
                    error: err.toString(),
                });    
            } else {
                this.messageBus.reply(event, {
                    type: 'response-error',
                    code: 'exception',
                    id: randomUUID(),
                    requestId: event.id,
                    error: err.toString(),
                });    
            }
            throw err;
        }
    }

    protected abstract processRequest(req: MessageEnvelope<Request<TRequestBody>>): Promise<TResponse>;

}