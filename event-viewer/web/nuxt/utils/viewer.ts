import { Application, Assets, Container, Graphics, Sprite, type UnresolvedAsset } from 'pixi.js';
import { JSONCodec, connect, type NatsConnection } from "nats.ws";
import { Rect, ViewPort, type Config, type MoveCommand } from 'core-lib';

export interface AssetRef {
    alias: string;
    src: string;
}

export interface Vehicle {
    sprite: Sprite;
    lastCommand: MoveCommand;
    isDirty: boolean;
}

export interface Zone {
    id: string;
    bounds: Rect;
    shape: Graphics;
}

export class Viewer {
    private _connection?: NatsConnection;
    private _app?: Application;
    private _container?: Container;
    private _zoneContainer?: Container;
    private _viewPort?: ViewPort;
    private _vehicles = new Map<string, Vehicle>();
    private _zones = new Map<string, Zone>();
    private _assets: AssetRef[] = [];
    
    constructor (private config: Config) {
        console.log('Received config', config);
    }

    private get app(): Application {
        if (!this._app) {
            throw new Error('App must be initialized first!');
        }
        return this._app;
    }

    async init(host: any) {
        const app = new Application();
        this._app = app;
        const zoneContainer = new Container();
        this._zoneContainer = zoneContainer;        
        app.stage.addChild(zoneContainer);
        const container = new Container();
        this._container = container;        
        app.stage.addChild(container);

        await app.init({ resizeTo: host, });
        host.appendChild(app.canvas);    

        await this.preload();
        
        app.ticker.add((time: any) => {
            this.animate(time);
        });

        await this.connect();
    }

    async dispose() {
        if (this._connection && !this._connection.isClosed() && !this._connection.isDraining()) {
            await this._connection.drain();
        }
        this._app?.destroy();
    }

    private async connect() {
        try {
            this._connection = await connect(
                {
                    servers: this.config.hub.protocols.websockets.servers,
                },
            );
            console.log('NATS connection is ready.');
            // create a codec
            const codec = JSONCodec();
            // create a simple subscriber and iterate over messages
            // matching the subscription
            const sub = this._connection.subscribe("commands");
            (async () => {
                for await (const m of sub) {
                    // console.log(`[${sub.getProcessed()}]: ${sc.decode(m.data)}`);
                    const data: any = codec.decode(m.data);
                    if (data.type === 'move') {
                        this.onProcessCommand(data);
                    }
                }
                console.log("subscription closed");
            })().catch(console.error);
        } catch(err) {
            console.error(err);
        }
    }

    private onProcessCommand(cmd: MoveCommand) {
        this.updateViewPort(cmd);
        this.updateZone(cmd);
        this.onMoveVehicle(cmd);
    }

    private updateViewPort(cmd: MoveCommand) {
        if (!this._viewPort) {
            this._viewPort = new ViewPort(
                Rect.fromCoordinates(0, 0, this.app.screen.width, this.app.screen.height), 
                new Rect(cmd.regionBounds.origin, cmd.regionBounds.size),
            );
        }
    }

    private updateZone(cmd: MoveCommand) {
        let zone = this._zones.get(cmd.zone.id);
        if (!zone && this._viewPort) {
            const bounds = new Rect(cmd.zone.bounds.origin, cmd.zone.bounds.size);
            const p = this._viewPort.translatePoint(bounds.origin);
            const sz = this._viewPort.translateSize(bounds.size);
            zone = {
                id: cmd.zone.id,
                bounds,
                shape: new Graphics().rect(p.x, p.y, sz.width, sz.height).stroke({ color: 0x444444 })
            }
            this._zones.set(zone.id, zone);
            this._zoneContainer?.addChild(zone.shape);
        }
    }

    private onMoveVehicle(cmd: MoveCommand) {
        let v = this._vehicles.get(cmd.vehicleId);
        if (!v) {
            const assetIndex = Math.trunc(this._assets.length * Math.random());
            const assetRef = this._assets[assetIndex];
            const assetAlias = assetRef.alias;
            const sprite = Sprite.from(assetAlias);
            sprite.anchor.set(0.5);
            this._container?.addChild(sprite);
    
            v = {
                sprite,
                lastCommand: cmd,
                isDirty: true,
            };
            this._vehicles.set(cmd.vehicleId, v);
        }
        v.lastCommand = cmd;
        v.isDirty = true;
    }

    private async preload() {
        this._assets = [
            { alias: 'Ambulance', src: 'cars/Ambulance.png' },
            { alias: 'Audi', src: 'cars/Audi.png' },
            { alias: 'Black_viper', src: 'cars/Black_viper.png' },
            { alias: 'Car', src: 'cars/Car.png' },
            { alias: 'Mini_truck', src: 'cars/Mini_truck.png' },
            { alias: 'Mini_van', src: 'cars/Mini_van.png' },
            { alias: 'Police', src: 'cars/Police.png' },
            { alias: 'taxi', src: 'cars/taxi.png' },
            { alias: 'truck', src: 'cars/truck.png' },
        ];
        await Assets.load(this._assets);            
    }

    private animate(time: any) {
        for (const cmd of this._vehicles.values()) {
            if (cmd.isDirty) {
                cmd.isDirty = false;
                cmd.sprite.scale.set(0.1 + (0.3 - 0.3 * (cmd.lastCommand.speed / Math.max(cmd.lastCommand.speed, 40000))) );
                switch(cmd.lastCommand.direction) {
                case 'north':
                    cmd.sprite.angle = 180;
                    break;
                case 'south':
                    cmd.sprite.angle = 0;
                    break;
                case 'east':
                    cmd.sprite.angle = 90;
                    break;
                case 'west':
                    cmd.sprite.angle = 270;
                    break;
                }
                if (this._viewPort) {
                    const p = this._viewPort.translatePoint(cmd.lastCommand.location);
                    cmd.sprite.x = p.x;
                    cmd.sprite.y = p.y;    
                }
            }
        }
    }
}