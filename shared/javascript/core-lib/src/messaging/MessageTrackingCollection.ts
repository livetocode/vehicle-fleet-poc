import { MessageTracking } from "../messages.js";
import { ServiceIdentity } from "./ServiceIdentity.js";

export type TrackingState = {
    tracking: MessageTracking;
    counter: number;
    dirty: boolean;
}

export class MessageTrackingCollection {
    private trackingByEmitter = new Map<string, TrackingState>();

    clear() {
        this.trackingByEmitter.clear();
    }

    add(tracking: MessageTracking): TrackingState {
        const id = `${tracking.emitter.name}/${tracking.emitter.instance}`;
        let current = this.trackingByEmitter.get(id);
        if (!current) {
            current = {
                tracking,
                counter: 0,
                dirty: true,
            }
            this.trackingByEmitter.set(id, current);
        }
        current.counter += 1;
        if (tracking.sequence > current.tracking.sequence) {
            current.tracking = tracking;
            current.dirty = true;
        }
        return current;
    }

    find(identity: ServiceIdentity): TrackingState | undefined {
        const id = `${identity.name}/${identity.instance}`;
        return this.trackingByEmitter.get(id);
    }

    list() {
        return [...this.trackingByEmitter.values()];
    }
}