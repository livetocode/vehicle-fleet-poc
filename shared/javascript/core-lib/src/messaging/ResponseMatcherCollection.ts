import { IncomingMessageEnvelope } from "./MessageEnvelopes.js";
import { ResponseMatcher } from "./ResponseMatcher.js";
import { Response } from "./Requests.js";

export class ResponseMatcherCollection {
    private responseMatchers: ResponseMatcher[] = [];

    acquire() {
        const result = new ResponseMatcher();
        this.responseMatchers = [...this.responseMatchers, result];
        return result;
    }

    release(matcher: ResponseMatcher) {
        const idx = this.responseMatchers.indexOf(matcher);
        if (idx >= 0) {
            const responseMatchers = [...this.responseMatchers];
            responseMatchers.splice(idx, 1);
            this.responseMatchers = responseMatchers;
        }
    }    

    match(msg: IncomingMessageEnvelope<Response>) {
        for (const responseMatcher of this.responseMatchers) {
            if (responseMatcher.match(msg)) {
                break;
            }    
        }

    }
}