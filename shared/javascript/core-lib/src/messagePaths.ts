import { MessagePath } from "./messaging/MessagePath.js"

export namespace services {
    export namespace generators {
        export const assigned = MessagePath.fromPath('services/generators/assigned/{index(required)}/...');
        export const tracking = MessagePath.fromPath('services/generators/tracking/{index(required)}');
    }
    export namespace collectors {
        export const assigned = MessagePath.fromPath('services/collectors/assigned/{index(required)}/...');
    }
    export namespace finders {
        export const any = MessagePath.fromPath('services/finders/any/...');
    }
}
export namespace requests {
    export namespace vehicles {
        export const generate = MessagePath.fromPath('requests/vehicles/generate');
        export const clear = MessagePath.fromPath('requests/vehicles/clear');
        export const query = MessagePath.fromPath('requests/vehicles/query');
    }
}

export namespace commands {
    export const move = MessagePath.fromPath('commands/move');
    export const move2 = MessagePath.fromPath('commands/move2'); // Only used when the MessageBus does not support abstract subjects
}

export namespace events {
    export namespace vehicles {
        export const byTypeAndSubType = MessagePath.fromPath('events/vehicles/{type}/{subType}');
    }
}

