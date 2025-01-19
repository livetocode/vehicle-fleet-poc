import { randomUUID } from "../utils.js";
import { MessageHandler } from "./MessageHandler.js";
import { BaseMessageEnvelope, IncomingMessageEnvelope, MessageHeaders } from "./MessageEnvelopes.js";
import { Request, RequestCancelledError, ResponseSuccess, ResponseError } from "./Requests.js";
import { TypedMessage } from "./TypedMessage.js";

export type ResponseWithHeaders<TBody extends TypedMessage = TypedMessage> = {
    type: 'responseWithHeaders';
    headers: MessageHeaders;
    body: TBody;
}

export type TypedResponse<TBody extends TypedMessage = TypedMessage> = TBody | ResponseWithHeaders<TBody>;

export abstract class RequestHandler<TRequestBody extends TypedMessage, TResponse extends TypedResponse> extends MessageHandler<Request<TRequestBody>> {
    
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
                } as BaseMessageEnvelope<ResponseError>);
                return;
            }
        }
        try {
            const respBody = await this.processRequest(msg);
            let resp: BaseMessageEnvelope<ResponseSuccess>;            
            if (isResponseWithHeaders<TResponse>(respBody)) {
                resp = {
                    headers: respBody.headers,
                    body: {
                        type: 'response-success',
                        id: randomUUID(),
                        requestId: event.id,
                        body: respBody.body,
                    }
                };
            } else {
                resp = {
                    headers: {},
                    body: {
                        type: 'response-success',
                        id: randomUUID(),
                        requestId: event.id,
                        body: respBody,
                    }
                };    
            }
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
                } as BaseMessageEnvelope<ResponseError>);    
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
                } as BaseMessageEnvelope<ResponseError>);
            }
            throw err;
        }
    }

    protected abstract processRequest(req: IncomingMessageEnvelope<Request<TRequestBody>>): Promise<TResponse>;

}

function isResponseWithHeaders<T extends TypedMessage>(msg: TypedResponse<T>): msg is ResponseWithHeaders<T> {
    if (msg.type === 'responseWithHeaders') {
        const obj = msg as any;
        return !!obj.headers && !!obj.body;
    }
    return false;
}
