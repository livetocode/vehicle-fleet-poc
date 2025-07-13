export type ServiceIdentity = {
    name: string;
    instance: number;
}

export function formatIdentity(identity: ServiceIdentity) {
    return `${identity.name}-${identity.instance}`;
}