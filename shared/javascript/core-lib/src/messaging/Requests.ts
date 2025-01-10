import { MessageEnvelope, MessageHeaders, ReplyMessageEnvelope } from "./MessageEnvelope.js";
import { ServiceIdentity } from "./ServiceIdentity.js";
import { TypedMessage } from "./TypedMessage.js";

export type Request<TBody extends TypedMessage = TypedMessage> = {
    id: string;
    type: 'request';
    replyTo: string;
    parentId?: string;
    expiresAt?: string
    timeout?: number;
    body: TBody
}

export type CancelRequestById = {
    type: 'cancel-request-id';
    requestId: string;
    waitOnCompletion?: boolean;
};

export type CancelRequestByParentId = {
    type: 'cancel-request-parentId';
    parentId: string;
    waitOnCompletion?: boolean;
    depth: number;
};

export type CancelRequestByType = {
    type: 'cancel-request-type';
    requestType: string;
    serviceName?: string;
    waitOnCompletion?: boolean;
};

export type CancelRequest = CancelRequestById | CancelRequestByParentId | CancelRequestByType;

export type CancelResponse = {
    type: 'cancel-response';
    found: boolean;
    identity: ServiceIdentity;
    cancelledMessageCount: number;
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
    code: 'expired' | 'timeout' | 'cancelled' | 'exception';
    body?: any;
    error?: any;
}

export type Response = ResponseSuccess | ResponseError;

export type ResponseValidator = (resp: Response) => boolean;

export type RequestOptions = {
    subject: string;
    id?: string;
    parentId?: string;
    limit?: number;
    timeout?: number;
    headers?: MessageHeaders;
    validator?: ResponseValidator;
}

export type RequestOptionsPair<TRequest extends TypedMessage = TypedMessage> = [TRequest, RequestOptions];

export class RequestTimeoutError extends Error {
    constructor(public requests: string[], message: string, options?: ErrorOptions) {
        super(message, options)
    }
}

export class RequestCancelledError extends Error {
    constructor(public requestId: string, message: string, options?: ErrorOptions) {
        super(message, options)
    }
}

export function isRequest(msg: MessageEnvelope): msg is MessageEnvelope<Request> { 
    if (msg.body.type === 'request') {
        const body = msg.body as any;
        return body.id &&
            body.replyTo;
    }
    return false;
}

export function isResponse(msg: MessageEnvelope): msg is MessageEnvelope<Response> { 
    if (msg.body.type === 'response-success') {
        const body = msg.body as any;
        return body.id &&
            body.requestId &&
            body.body;
    }
    if (msg.body.type === 'response-error') {
        const body = msg.body as any;
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
        const body = msg.body.body as any;
        if (body.type === 'cancel-request-id') {
            return body.requestId;
        }
        if (body.type === 'cancel-request-type') {
            return body.requestType;
        }    
    }
    return false;
}

export function isCancelResponse(msg: MessageEnvelope): msg is MessageEnvelope<ResponseSuccess<CancelResponse>> { 
    if (isResponse(msg)) {
        const body = msg.body.body;
        if (body.type === 'cancel-response') {
            return true;
        }
    }
    return false;
}
