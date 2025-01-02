import { MessageEnvelope } from "./MessageEnvelope.js";

export type TypedMessage = {
    type: string;
}

export type Request<TBody extends TypedMessage = TypedMessage> = {
    id: string;
    type: 'request';
    replyTo: string;
    expiresAt?: string
    body: TBody
}

export type AbortRequest = Request<{
    type: 'abort-request';
    requestId: string;
}>;

// TODO: AbortResponse

export type ResponseSuccess<TBody = any> = {
    id: string;
    requestId: string;
    type: 'response-success';
    body: TBody;
}

export type ResponseError = {
    id: string;
    requestId: string;
    type: 'response-error';
    code: 'expired' | 'timeout' | 'aborted' | 'exception';
    body?: any;
    error?: any;
}

export type Response = ResponseSuccess | ResponseError;

export type RequestOptions = {
    subject: string;
    limit?: number;
    timeout?: number;
}

export type RequestOptionsPair = [Request<{ type: string }>, RequestOptions];

export class RequestTimeoutError extends Error {
    constructor(public requests: string[], message: string, options?: ErrorOptions) {
        super(message, options)
    }
}

export function isRequest(msg: MessageEnvelope): msg is MessageEnvelope<Request> { 
    const body = msg.body;
    if (body.type === 'request') {
        return body.id &&
            body.replyTo;
    }
    return false;
}

export function isResponse(msg: MessageEnvelope): msg is MessageEnvelope<Response> { 
    const body = msg.body;
    if (body.type === 'response-success') {
        return body.id &&
            body.requestId &&
            body.body;
    }
    if (body.type === 'response-error') {
        return body.id &&
            body.requestId &&
            body.code;        
    }
    return false;
}

export function isAbortRequest(msg: MessageEnvelope): msg is MessageEnvelope<AbortRequest> { 
    const body = msg.body;
    if (body.type === 'abort-request') {
        return body.id &&
            body.requestId;
    }
    return false;
}
