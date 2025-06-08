import { IMessageBus } from "../messaging/IMessageBus.js";
import Messages from "./messages.cjs";

// Note that we don't verify the objects that need to be serialized, since Typescript should help us enforce the message structure
// and also because we want the maximum performance.

// Finally, we have selected only the messages that are sent the most, otherwise the benefit is negligible.

export function registerCodecs(messageBus: IMessageBus) {
    messageBus.registerMessageCodec('move', {
        encode(msg: any): Uint8Array {
            const buff = Messages.MoveCommand.encode(msg).finish();
            return buff;
        },
        decode(data: Uint8Array): any {
            const msg = Messages.MoveCommand.decode(data);
            msg.type = 'move';
            return msg;
        },
    });
    messageBus.registerMessageCodec('enriched-move', {
        encode(msg: any): Uint8Array {
            const buff = Messages.EnrichedMoveCommand.encode(msg).finish();
            return buff;
        },
        decode(data: Uint8Array): any {
            const msg = Messages.EnrichedMoveCommand.decode(data);
            msg.type = 'enriched-move';
            return msg;
        },
    });
    messageBus.registerMessageCodec('vehicle-query-result', {
        encode(msg: any): Uint8Array {
            const buff = Messages.VehicleQueryResult.encode(msg).finish();
            return buff;
        },
        decode(data: Uint8Array): any {
            const msg = Messages.VehicleQueryResult.decode(data);
            msg.type = 'vehicle-query-result';
            return msg;
        },
    });        
}