import type { Logger, MessageBus } from "core-lib";


export type Service = {
    name: string;
    instances: number;
}

export class ServicesViewModel {
    services = ref<Service[]>([]);
    isFetching = ref(false);
    
    constructor(private _messageBus: MessageBus, private logger: Logger) {}

    async init(): Promise<void> {
        await this.fetch();
    }

    async dispose(): Promise<void> {
    }

    refresh() {
        this.fetch().catch(err => this.logger.error(err));
    }

    async fetch() {
        this.isFetching.value = true;
        try {
            const services: Service[] = [];
            for await (const resp of this._messageBus.ping({ timeout: 1000 })) {
                const svc = services.find(x => x.name === resp.identity.name);
                if (svc) {
                    svc.instances += 1;
                } else {
                    services.push({
                        name: resp.identity.name,
                        instances: 1,
                    });    
                }
            }
            this.services.value = services;    
        } finally {
            this.isFetching.value = false;
        }
    }
}