
// Examples of path:
// requests/vehicles/clear
// requests/vehicles/{type:clear}
// commands/move
// commands/{commandType}
// commands/{commandType:move}
// events/vehicles/aggregate-period/created
// events.vehicles/{eventType}/{eventSubType}
// services/generators/assigned/0/commands/{command:move}
// services/collectors/assigned/0/...
// services/collectors/assigned/{index}/...
// services/collectors/assigned/{index:0}/...
// services/collectors/assigned/{index:0:required}/...
// services/collectors/assigned/{index(required)}/...
// messaging/control/{command}
// messaging/control/{command}/{name}

export type StringSegment = {
    type: 'string';
    value: string;
}

export type VarSegment = {
    type: 'var';
    name: string;
    defaultValue?: string;
    isRequired?: boolean;
}

export type RestSegment = {
    type: 'rest';
}

export type PathSegment = StringSegment | VarSegment | RestSegment;

export class MessagePath {

    protected constructor(
        public readonly segments: PathSegment[],
        public readonly vars: Record<string, string>,
    ) {}

    public static fromPath(path: string) {
        const result = parsePath(path);
        return new MessagePath(result.segments, result.vars);
    }

    public static fromReplyTo(replyTo: string) {
        return new ReplyPath(replyTo);
    }

    toString() {
        const segments: string[] = [];
        for (const segment of this.segments) {
            if (segment.type === 'string') {
                segments.push(segment.value);
            } else if (segment.type === 'var') {
                let options = '';
                if (segment.isRequired) {
                    options = '(required)';
                }
                const val = this.vars[segment.name];
                if (val) {
                    segments.push(`{${segment.name}${options}:${segment.defaultValue}}`);
                } else {
                    segments.push(`{${segment.name}${options}}`);
                }
            } else if (segment.type === 'rest') {
                segments.push('...');
            }
        }
        return segments.join('/');
    }

    toJSON() {
        return {
            segments: this.segments,
            vars: this.vars,
        }
    }

    hasEmptyVars() {
        for (const [_k, v] of Object.entries(this.vars)) {
            if (v === undefined) {
                return false;
            }
        }
        return false;
    }

    hasRequiredEmptyVars() {
        for (const segment of this.segments) {
            if (segment.type === 'var') {
                if (segment.isRequired === true) {
                    const val = this.vars[segment.name];
                    if (val === undefined) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    subscribe(vars: Record<string, string>) {
        const result = new SubscriptionMessagePath(this, vars);
        if (result.hasRequiredEmptyVars()) {
            throw new Error(`Message path must define all its required variables when subscribing. Received: ${result}`);
        }
        return result;
    }

    publish(vars: Record<string, string>) {
        const result = new PublicationMessagePath(this, vars);
        if (result.hasEmptyVars()) {
            throw new Error(`Message path must define all its variables when publishing. Received: ${result}`);
        }
        return result;
    }
}

export class SubscriptionMessagePath extends MessagePath {
    constructor(messagePath: MessagePath, vars: Record<string, string>) {
        super(messagePath.segments, overrideVars(messagePath.vars, vars));
    }
}

export class PublicationMessagePath extends MessagePath {
    constructor(messagePath: MessagePath, vars: Record<string, string>) {
        super(messagePath.segments, overrideVars(messagePath.vars, vars));
    }    
}

export class ReplyPath extends MessagePath {
    constructor(public readonly replyTo: string) {
        super([], {});
    }    
}

function parsePath(path: string) {
    const segments: PathSegment[] = [];
    const vars: Record<string, string> = {};
    const items = path.split('/');
    for (const item of items) {
        if (item === '...') {
            // TODO: validate that is exists only once and at the end
            segments.push({ type: 'rest' });
        } else if (item.length >= 3 && item.startsWith('{') && item.endsWith('}')) {
            const content = item.substring(1, item.length - 1);
            const contentItems = content.split(':');
            const { name, options } = parseName(contentItems[0].trim());
            if (name.length === 0) {
                throw new Error('Path variable name cannot be empty!');
            }
            let defaultValue = contentItems[1];
            if (defaultValue !== undefined) {
                defaultValue = defaultValue.trim();
                if (defaultValue.length === 0) {
                    throw new Error(`Default value of path variable '${item}' cannot be empty! Just remove the semi-colon.`);
                }
            }
            let isRequired: boolean | undefined = undefined;
            // TODO: validate allowed options
            if (options && options.includes('required')) {
                isRequired = true;
            }
            vars[name] = defaultValue;
            segments.push({ type: 'var', name, defaultValue, isRequired });
        } else {
            segments.push({ type: 'string', value: item });
        }
    }
    return {
        segments,
        vars,
    }
}

function parseName(value: string) {
    const idx = value.indexOf('(');
    if (idx > 0) {
        const idx2 = value.indexOf(')', idx + 1);
        if (idx2 < 0) {
            throw new Error(`Cannot parse path variable name "${value}" because there is no closing parenthesis: ${value}`);
        }
        const name = value.substring(0, idx);
        const options = value.substring(idx, idx2);
        return {
            name,
            options,
        }
    }
    return {
        name: value,
        options: undefined,
    };
}

function overrideVars(source: Record<string, string>, override: Record<string, string>) {
    const result = { ... source };
    for (const [k, v] of Object.entries(override)) {
        if (k in source || k === 'rest') {
            result[k] = v;
        } else {
            throw new Error(`Unknown path variable '${k}'`);
        }
    }
    return result;
}