export type ServiceIdentity = {
    name: string;
    instance: number;
    runtime: string;
}

export function formatIdentity(identity: ServiceIdentity) {
    return `${identity.name}-${identity.instance}-${identity.runtime}`;
}