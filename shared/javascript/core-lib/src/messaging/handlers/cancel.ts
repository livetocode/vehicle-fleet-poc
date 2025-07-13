import { Logger } from "../../logger.js";
import { Stopwatch } from "../../stopwatch.js";
import { sleep } from "../../utils.js";
import { MessageHandlerContext } from "../MessageHandler.js";
import { IMessageBus } from "../IMessageBus.js";
import { IncomingMessageEnvelope, MessageEnvelope } from "../MessageEnvelopes.js";
import { RequestHandler } from "../RequestHandler.js";
import { Request, Response, CancelRequest, CancelResponse, RequestOptions, CancelRequestByType, CancelRequestById, isRequest, RequestOptionsPair, isCancelResponse, CancelRequestByParentId, RequestTimeoutError } from "../Requests.js";
import { ServiceIdentity } from "../ServiceIdentity.js";
import { MessagePath, PublicationMessagePath } from "../MessagePath.js";

export class CancelRequestHandler extends RequestHandler<CancelRequest, CancelResponse> {
    
    constructor(
        private messageBus: IMessageBus,
        private logger: Logger,
        public identity: ServiceIdentity,
        private activeHandlers: Map<string, MessageHandlerContext>,
        private globalPath: PublicationMessagePath,
    ) {
        super();
    }

    get isNonBlocking() {
        // required in order to nest child request cancellation
        return true;
    }

    get name(): string {
        return 'CancelRequestHandler';
    }

    get description(): string {
        return `Finds and cancels active message handlers.`;
    }

    get messageTypes(): string[] {
        return ['cancel-request-id', 'cancel-request-parentId', 'cancel-request-type'];
    }

    protected async processRequest(req: IncomingMessageEnvelope<Request<CancelRequest>>): Promise<CancelResponse> {
        const watch = Stopwatch.startNew();
        this.logger.debug('Cancel request received', req.body);
        const timeout = (req.body.timeout ?? 10000) - 1000;

        let found = false;
        let cancellationCount = 0;
        const body = req.body.body;

        // First, find the requests to cancel
        const { matchedRequests, depth } = this.findRequestsToCancel(req);

        // If we found some requests to cancel, then cancel the child requests first
        if (matchedRequests.size > 0) {
            found = true;
            if (body.cancelChildRequests === true) {
                cancellationCount += await this.cancelChildRequests(req, matchedRequests, depth, timeout);
            }
            // Now that the children have been cancelled, cancel the requests
            for (const msg of matchedRequests.values()) {
                msg.shouldCancel = true;
                cancellationCount += 1;
            }
            // If we need to wait on completion, then wait until cancelled requests have disappeared from memory or if timeout expires
            if (req.body.body.waitOnCompletion) {
                await this.waitOnCompletion(req, matchedRequests, watch, timeout);
            }
        }
        // return the cancellation response to the caller
        this.logger.debug(`Cancel request ${req.body.id}: found=${found}, count=${cancellationCount}, parentId=${req.body.parentId}`, body);
        return {
            type: 'cancel-response',
            found,
            identity: this.identity,
            cancelledMessageCount: cancellationCount,
        };        
    }

    private findRequestsToCancel(req: IncomingMessageEnvelope<Request<CancelRequest>>): {
        matchedRequests: Map<string, IncomingMessageEnvelope>,
        depth: number,
    } {
        const matchedRequests = new Map<string, IncomingMessageEnvelope>();
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
        return {
            matchedRequests,
            depth,
        };
    }

    private async cancelChildRequests(
        req: IncomingMessageEnvelope<Request<CancelRequest>>,
        matchedRequests: Map<string, IncomingMessageEnvelope>,
        depth: number,
        timeout: number,
    ): Promise<number> {
        this.logger.debug('Found requests to cancel for ', req.body.id, [...matchedRequests.values()].map(x => x.body), req.body.id, req.body.parentId);            
        let cancellationCount = 0;
        let childTimeout = timeout;
        if (req.body.body.waitOnCompletion === true) {
            childTimeout = Math.max(100, Math.round(timeout / 2));
        }
        const batch: RequestOptionsPair[] = [...matchedRequests.keys()].map(x => [
            {
                type: 'cancel-request-parentId',
                parentId: x,
                waitOnCompletion: req.body.body.waitOnCompletion,
                depth: depth + 1,
            } as CancelRequestByParentId, 
            {
                path: this.globalPath,
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
                this.logger.debug(`Child request cancellation timed out for requestId=${req.body.id}, parentId=${req.body.parentId}`);
            } else {
                throw err;
            }
        }
        return cancellationCount;
    }

    private async waitOnCompletion(
        req: IncomingMessageEnvelope<Request<CancelRequest>>,
        matchedRequests: Map<string, IncomingMessageEnvelope>,
        watch: Stopwatch,
        timeout: number,
    ): Promise<void> {
        this.logger.trace(`Cancel request "${req.body.id}" needs to wait on completion... (parentId=${req.body.parentId})`);
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
                this.logger.trace('Completed Task:', id);
            }
        }
    }
}

export class CancelRequestService {
    private handler: CancelRequestHandler;
    private globalPath: MessagePath;
    private specificPath: MessagePath;

    constructor(
        private messageBus: IMessageBus,
        logger: Logger,
        identity: ServiceIdentity,
        activeHandlers: Map<string, MessageHandlerContext>,
    ) {
        this.globalPath = MessagePath.fromPath('messaging/control');
        this.specificPath = MessagePath.fromPath('messaging/control/{name(required)}');
        this.handler = new CancelRequestHandler(messageBus, logger, identity, activeHandlers, this.globalPath.subscribe({}));
        this.messageBus.registerHandlers(this.handler);
        this.messageBus.subscribe({ type: 'topic', path: this.globalPath.subscribe({}) });
        this.messageBus.subscribe({ type: 'topic', path: this.specificPath.subscribe({ name: identity.name })});
    }

    cancel(request: CancelRequestById, options: Partial<RequestOptions>): Promise<MessageEnvelope<Response>> {        
        const opt: RequestOptions = {
            ...options,
            path: options.path ?? this.globalPath.publish({}),
        }
        return this.messageBus.request(request, opt);
    }

    async *cancelMany(request: CancelRequestByType, options: Partial<RequestOptions>): AsyncGenerator<MessageEnvelope<Response>> {
        const defaultPath = request.serviceName ? this.specificPath.publish({ name: request.serviceName }) : this.globalPath.publish({});

        const opt: RequestOptions = {
            ...options,
            path: options.path ?? defaultPath,
        }
        for await (const resp of this.messageBus.requestBatch([[request, opt]])) {
            yield resp;
        }
    }

}