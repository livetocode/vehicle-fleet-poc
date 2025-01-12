import { randomUUID } from "../utils.js";
import { MessageHandler } from "./MessageHandler.js";
import { BaseMessageEnvelope, IncomingMessageEnvelope } from "./MessageEnvelopes.js";
import { Request, Response, RequestCancelledError } from "./Requests.js";
import { TypedMessage } from "./TypedMessage.js";

export abstract class RequestHandler<TRequestBody extends TypedMessage, TResponse> extends MessageHandler<Request<TRequestBody>> {
    
    async process(msg: IncomingMessageEnvelope<Request<TRequestBody>>): Promise<void> {
        const event = msg.body;
        if (event.type !== 'request') {
            throw new Error(`A RequestHandler expects to receive a request message but received "${event.type}"`);
        }
        if (event.expiresAt) {
            const expiredAt = new Date(event.expiresAt);
            if (expiredAt < new Date()) {
                msg.reply({
                    headers: {},
                    body: {
                        type: 'response-error',
                        code: 'expired',
                        id: randomUUID(),
                        requestId: event.id,    
                    }
                } as BaseMessageEnvelope<Response>);
                return;
            }
        }
        try {
            const respBody = await this.processRequest(msg);
            const resp: BaseMessageEnvelope<Response> = {
                headers: {},
                body: {
                    type: 'response-success',
                    id: randomUUID(),
                    requestId: event.id,
                    body: respBody,
                }
            };
            msg.reply(resp);
        } catch(err : any) {
            if (err instanceof RequestCancelledError) {
                msg.reply({
                    headers: {},
                    body: {
                        type: 'response-error',
                        code: 'cancelled',
                        id: randomUUID(),
                        requestId: event.id,
                        error: err.toString(),
                    }
                } as BaseMessageEnvelope<Response>);    
            } else {
                msg.reply({
                    headers: {},
                    body: {
                        type: 'response-error',
                        code: 'exception',
                        id: randomUUID(),
                        requestId: event.id,
                        error: err.toString(),
                    }
                } as BaseMessageEnvelope<Response>);
            }
            throw err;
        }
    }

    protected abstract processRequest(req: IncomingMessageEnvelope<Request<TRequestBody>>): Promise<TResponse>;

}