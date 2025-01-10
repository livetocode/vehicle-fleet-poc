import { Logger } from "../../logger.js";
import { Stopwatch } from "../../stopwatch.js";
import { sleep } from "../../utils.js";
import { EventHandlerContext } from "../EventHandler.js";
import { IMessageBus } from "../IMessageBus.js";
import { MessageEnvelope } from "../MessageEnvelope.js";
import { RequestHandler } from "../RequestHandler.js";
import { Request, Response, CancelRequest, CancelResponse, RequestOptions, CancelRequestByType, CancelRequestById, isRequest, RequestOptionsPair, isCancelResponse, CancelRequestByParentId, RequestTimeoutError } from "../Requests.js";
import { ServiceIdentity } from "../ServiceIdentity.js";

export class CancelRequestHandler extends RequestHandler<CancelRequest, CancelResponse> {
    
    constructor(
        messageBus: IMessageBus,
        private logger: Logger,
        public identity: ServiceIdentity,
        private activeHandlers: Map<string, EventHandlerContext>,
    ) {
        super(messageBus);
    }

    get isNonBlocking() {
        // required in order to nest child request cancellation
        return true;
    }

    get eventTypes(): string[] {
        return ['cancel-request-id', 'cancel-request-parentId', 'cancel-request-type'];
    }

    protected async processRequest(req: MessageEnvelope<Request<CancelRequest>>): Promise<CancelResponse> {
        this.logger.debug('Cancel request received', req.body);
        const watch = Stopwatch.startNew();
        const matchedRequests = new Map<string, MessageEnvelope>();
        let found = false;
        let cancellationCount = 0;
        let depth = 0;
        const body = req.body.body;
        // First, find the requests to cancel
        if (body.type === 'cancel-request-id') {
            const ctx = this.activeHandlers.get(body.requestId);
            if (ctx) {
                matchedRequests.set(req.body.id, ctx.msg);
            }
        } else if (body.type === 'cancel-request-parentId') {
            depth = body.depth;
            for (const ctx of this.activeHandlers.values()) {
                // ctx.msg.shouldCancel !== true && 
                if (isRequest(ctx.msg)) {
                    if (ctx.msg.body.parentId === body.parentId) {
                        matchedRequests.set(ctx.msg.body.id, ctx.msg);
                    }
                }
            }
        } else if (body.type === 'cancel-request-type') {
            const isTargetService = body.serviceName ? body.serviceName === this.identity.name : true;
            if (isTargetService) {
                for (const ctx of this.activeHandlers.values()) {
                    if (ctx.msg.shouldCancel !== true && isRequest(ctx.msg)) {
                        if (ctx.msg.body.body.type === body.requestType) {
                            matchedRequests.set(ctx.msg.body.id, ctx.msg);
                        }    
                    }
                }
            }
        }
        // If we found some requests to cancel, then cancel the child requests first
        const childTimeout = Math.max(100, (req.body.timeout ?? 5000) - 1000);
        if (matchedRequests.size > 0) {
            found = true;
            this.logger.debug('Found requests to cancel', [...matchedRequests.values()].map(x => x.body), req.body.id, req.body.parentId);            
            const batch: RequestOptionsPair[] = [...matchedRequests.keys()].map(x => [
                {
                    type: 'cancel-request-parentId',
                    parentId: x,
                    waitOnCompletion: req.body.body.waitOnCompletion,
                    depth: depth + 1,
                } as CancelRequestByParentId, 
                {
                    subject: 'messaging.control.cancel',
                    parentId: req.body.id,
                    timeout: childTimeout,
                    limit: 1000,
                },
            ]);
            try {
                for await (const resp of this.messageBus.requestBatch(batch)) {
                    if (isCancelResponse(resp)) {
                        cancellationCount += resp.body.body.cancelledMessageCount;
                        this.logger.debug(`Received cancel response requestId=${resp.body.requestId}`, resp.body.body);
                    } else {
                        this.logger.debug(`Bad cancellation response requestId=${resp.body.requestId}`, resp.body.body);
                    }
                }    
            } catch(err) {
                if (err instanceof RequestTimeoutError) {
                    // this.logger.warn('Child request cancellation timed out');
                } else {
                    throw err;
                }
            }
            // Now that the children have been cancelled, cancel the requests
            for (const msg of matchedRequests.values()) {
                msg.shouldCancel = true;
                cancellationCount += 1;
            }
            // If we need to wait on completion, then wait until cancelled requests have disappeared from memory or if timeout expires
            if (req.body.body.waitOnCompletion) {
                // this.logger.debug('Cancel request needs to wait on completion...', req.body.id, req.body.parentId);
                const timeout = req.body.timeout ?? 10000;
                while (matchedRequests.size > 0 && timeout > 0 && watch.elapsedTimeInMS() < timeout) {
                    await sleep(50);
                    const completedTasks: string[] = [];
                    for (const [id, msg] of matchedRequests.entries()) {
                        if (!this.activeHandlers.has(id)) {
                            completedTasks.push(id);
                        }
                    }
                    for (const id of completedTasks) {
                        matchedRequests.delete(id);
                        this.logger.debug('Completed Task:', id);
                    }
                }
            }
        }
        // return the cancellation response to the caller
        this.logger.debug(`Cancel request: found=${found}, count=${cancellationCount}`, body, req.body.id, req.body.parentId);
        return {
            type: 'cancel-response',
            found,
            identity: this.identity,
            cancelledMessageCount: cancellationCount,
        };        
    }
}

export class CancelRequestService {
    private handler: CancelRequestHandler;

    constructor(
        private messageBus: IMessageBus,
        logger: Logger,
        identity: ServiceIdentity,
        activeHandlers: Map<string, EventHandlerContext>,
    ) {
        this.handler = new CancelRequestHandler(messageBus, logger, identity, activeHandlers);
        this.messageBus.registerHandlers(this.handler);
        this.messageBus.subscribe('messaging.control.*');
        this.messageBus.subscribe(`messaging.control.*.${identity.name}`);
    }

    cancel(request: CancelRequestById, options: Partial<RequestOptions>): Promise<MessageEnvelope<Response>> {        
        const opt: RequestOptions = {
            ...options,
            subject: options.subject ?? 'messaging.control.cancel',
        }
        return this.messageBus.request(request, opt);
    }

    async *cancelMany(request: CancelRequestByType, options: Partial<RequestOptions>): AsyncGenerator<MessageEnvelope<Response>> {
        const defaultSubject = request.serviceName ? `messaging.control.cancel.${request.serviceName}` : 'messaging.control.cancel';
        const opt: RequestOptions = {
            ...options,
            subject: options.subject ?? defaultSubject,
        }
        for await (const resp of this.messageBus.requestBatch([[request, opt]])) {
            yield resp;
        }
    }

}