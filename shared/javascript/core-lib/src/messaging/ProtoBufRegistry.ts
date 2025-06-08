export interface ProtoBufCodec {
    /**
     * Encode message to an Uint8Array suitable for including in a message payload.
     * @param msg
     */
    encode(msg: any): Uint8Array;
    /**
     * Decode an Uint8Array from a message payload into a message
     * @param a
     */
    decode(data: Uint8Array): any;
}

export class ProtoBufRegistry {
    private codecs = new Map<string, ProtoBufCodec>();

    register(messageType: string, codec: ProtoBufCodec) {
        this.codecs.set(messageType, codec);
    }
    
    find(messageType: string): ProtoBufCodec | undefined {
        return this.codecs.get(messageType);
    }

    get(messageType: string): ProtoBufCodec {
        const result = this.find(messageType);
        if (!result) {
            throw new Error(`Could not find a ProtoBuf Codec for message type '${messageType}'`);
        }
        return result;
    }
}
