import { IncomingMessageEnvelope, MessageHandler, MessageTrackingAck, MessageTrackingCollection } from "core-lib";

export class MessageTrackingHandler extends MessageHandler<MessageTrackingAck> {
    constructor(private messageTrackingCollection: MessageTrackingCollection) {
        super();
    }

    get description(): string {
        return 'Receives the message processing status of the collectors, to decide if we need to apply back pressure.';
    }

    get messageTypes(): string[] {
        return ['message-tracking-ack'];
    }

    async process(msg: IncomingMessageEnvelope<MessageTrackingAck>): Promise<void> {
        // console.log('received tracking', msg.body.tracking)
        this.messageTrackingCollection.add(msg.body.tracking);
    }
}