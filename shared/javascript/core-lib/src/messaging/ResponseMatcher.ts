import { Stopwatch } from "../stopwatch.js";
import { Response, RequestOptions, RequestTimeoutError } from "./Requests.js";
import { IncomingMessageEnvelope } from "./MessageEnvelopes.js";
import { sleep } from "../utils.js";

export class RequestResponseContext {
    receivedResponseCount = 0;
    
    constructor (public options: RequestOptions) {}

    increment() {
        this.receivedResponseCount += 1;
        return this.receivedResponseCount;
    }
}

export class ResponseMatcher {
    private requests = new Map<string, RequestResponseContext>();
    private receivedResponses: IncomingMessageEnvelope<Response>[] = [];
    private watch = Stopwatch.startNew();
    private maxTimeout = 0;
    
    get isDone() {
        const result = this.requests.size === 0 && this.receivedResponses.length === 0;
        if (!result && this.maxTimeout > 0) {
            if (this.watch.elapsedTimeInMS() >= this.maxTimeout) {
                throw new RequestTimeoutError([...this.requests.keys()], 'Some requests timed out');
            }
        }
        return result;
    }

    register(requestId: string, options: RequestOptions) {
        this.requests.set(requestId, new RequestResponseContext(options));
        if (options.timeout != undefined && options.timeout > this.maxTimeout) {
            this.maxTimeout = options.timeout;
        }
    }

    match(msg: IncomingMessageEnvelope<Response>): Boolean {
        const ctx = this.requests.get(msg.body.requestId);
        if (ctx) {
            const isValidResp = ctx.options.validator?.(msg.body) ?? true;
            if (isValidResp) {
                this.receivedResponses.push(msg);
                if (ctx.increment() >= (ctx.options.limit ?? 1)) {
                    this.requests.delete(msg.body.requestId);
                }
            }
            return true;
        }
        return false;
    }

    getMatches(): IncomingMessageEnvelope<Response>[] {
        const result = this.receivedResponses;
        this.receivedResponses = [];
        return result;
    }

    wait(): Promise<void> {
        return sleep(2);
    }
}
