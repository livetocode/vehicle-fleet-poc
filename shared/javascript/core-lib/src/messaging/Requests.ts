import { MessageEnvelope, MessageHeaders, ReplyMessageEnvelope } from "./MessageEnvelope.js";
import { TypedMessage } from "./TypedMessage.js";

export type Request<TBody extends TypedMessage = TypedMessage> = {
    id: string;
    type: 'request';
    replyTo: string;
    expiresAt?: string
    body: TBody
}

export type CancelRequestById = {
    type: 'cancel-request-id';
    requestId: string;
};

export type CancelRequestByType = {
    type: 'cancel-request-type';
    requestType: string;
};

export type CancelRequest = CancelRequestById | CancelRequestByType;

export type CancelResponse = {
    type: 'cancel-response';
    found: boolean;
}

// TODO: add elapsedTime to responses
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
    id?: string;
    limit?: number;
    timeout?: number;
    headers?: MessageHeaders;
}

export type RequestOptionsPair<TRequest extends TypedMessage = TypedMessage> = [TRequest, RequestOptions];

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

export function isReplyResponse(msg: ReplyMessageEnvelope): msg is ReplyMessageEnvelope<Response> { 
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

export function isCancelRequest(msg: MessageEnvelope): msg is MessageEnvelope<Request<CancelRequest>> { 
    if (isRequest(msg)) {
        const body = msg.body.body;
        if (body.type === 'cancel-request-id') {
            return body.requestId;
        }
        if (body.type === 'cancel-request-type') {
            return body.requestType;
        }    
    }
    return false;
}
