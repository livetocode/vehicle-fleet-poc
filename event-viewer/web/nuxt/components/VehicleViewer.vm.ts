import { Application, Assets, Container, Graphics, Polygon, Sprite } from 'pixi.js';
import { addOffsetToCoordinates, gpsToPoint, KM, Rect, ViewPort, type Config, type Logger, type MoveCommand, type VehicleQuery, type VehicleQueryResult } from 'core-lib';
import { EventHandler, LambdaEventHandler } from '../utils/messaging';
import Geohash from 'latlon-geohash';

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

export interface GeohashShape {
    id: string;
    bounds: Rect;
    shape: Graphics;
}

export class VehicleViewerViewModel {
    private _app?: Application;
    private _container?: Container;
    private _zoneContainer?: Container;
    private _geohashContainer?: Container;
    private _viewPort?: ViewPort;
    private _vehicles = new Map<string, Vehicle>();
    private _zones = new Map<string, Zone>();
    private _geohashes = new Map<string, GeohashShape>();
    private _assets: AssetRef[] = [];
    private _moveHandler?: EventHandler;
    private _queryHandler?: EventHandler;
    private _queryResultHandler?: EventHandler;
    
    constructor (private config: Config, private _messageBus: MessageBus, private logger: Logger) {
        if (!_messageBus) {
            throw new Error('Expected to receive a messageBus!');
        }
        logger.debug('Received config', config);
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
        const geohashContainer = new Container();
        this._geohashContainer = geohashContainer;        
        app.stage.addChild(geohashContainer);
        const zoneContainer = new Container();
        this._zoneContainer = zoneContainer;        
        app.stage.addChild(zoneContainer);
        const container = new Container();
        this._container = container;        
        app.stage.addChild(container);

        await app.init({ resizeTo: host, });
        host.appendChild(app.canvas);    

        await this.preload();
        this._viewPort = this.createViewPort();
        
        app.ticker.add((time: any) => {
            this.animate(time);
        });
        this._moveHandler = new LambdaEventHandler(['move'], async (ev: any) => { this.onProcessCommand(ev); });
        this._queryHandler = new LambdaEventHandler(['vehicle-query'], async (ev: any) => { this.onProcessQuery(ev); });
        this._queryResultHandler = new LambdaEventHandler(['vehicle-query-result'], async (ev: any) => { this.onProcessQueryResult(ev); });
        this._messageBus.registerHandlers(this._moveHandler, this._queryHandler, this._queryResultHandler);
    }

    async dispose() {
        if (this._moveHandler) {
            this._messageBus?.unregisterHandler(this._moveHandler);
            this._moveHandler = undefined;
        }
        if (this._queryHandler) {
            this._messageBus?.unregisterHandler(this._queryHandler);
            this._queryHandler = undefined;
        }
        if (this._queryResultHandler) {
            this._messageBus?.unregisterHandler(this._queryResultHandler);
            this._queryResultHandler = undefined;
        }
        const app = this._app;
        this._app = undefined;
        app?.destroy();
    }

    private onProcessCommand(cmd: MoveCommand) {
        if (!this._app) {
            return;
        }
        this.updateZone(cmd);
        this.updateGeohashes(cmd);
        this.onMoveVehicle(cmd);
    }
    
    private onProcessQuery(res: VehicleQuery) {
        this.logger.debug('Received query. Reset viewer.', res);
        this._container?.removeChildren();
        this._zoneContainer?.removeChildren();
        this._geohashContainer?.removeChildren();
        this._geohashes.clear();
        this._vehicles.clear();
        this._zones.clear();
        const viewport = this._viewPort;
        if (viewport) {
            const points = res.polygon.map(p => viewport.translatePoint(gpsToPoint(p)));
            const shape = new Graphics().poly(points).stroke({ color: 0xff0000 })
            this._zoneContainer?.addChild(shape);
        }
    }

    private onProcessQueryResult(res: VehicleQueryResult) {
        if (!this._app) {
            return;
        }
        const cmd: MoveCommand = {
            type: 'move',
            vehicleId: res.vehicleId,
            vehicleType: res.vehicleType,
            location: gpsToPoint(res.gps),
            direction: res.direction,
            speed: res.speed,
            gps: res.gps,
            timestamp: res.timestamp,        
        };
        this.updateGeohashes(cmd);
        this.onMoveVehicle(cmd);
    }

    private createViewPort(): ViewPort {
        const innerBounds = Rect.fromCoordinates(0, 0, this.app.screen.width, this.app.screen.height);
        const gpsTopLeftOrigin = this.config.generator.map.topLeftOrigin;
        const topLeftOrigin = gpsToPoint(gpsTopLeftOrigin);
        const gpsBottomRight = addOffsetToCoordinates(gpsTopLeftOrigin, this.config.generator.map.widthInKm * KM, this.config.generator.map.heightInKm * KM);
        const bottomRight = gpsToPoint(gpsBottomRight);
        const outerBounds = Rect.fromCoordinates(
            topLeftOrigin.x, 
            topLeftOrigin.y,
            bottomRight.x,
            bottomRight.y,
        );
        return new ViewPort(innerBounds, outerBounds);
    }

    private updateZone(cmd: MoveCommand) {
        if (!cmd.zone) {
            return;
        }
        let zone = this._zones.get(cmd.zone.id);
        if (!zone && this._viewPort) {
            const bounds = new Rect(cmd.zone.bounds.origin, cmd.zone.bounds.size);
            const topLeft = gpsToPoint(addOffsetToCoordinates(this.config.generator.map.topLeftOrigin, bounds.origin.x, bounds.origin.y));
            const p = this._viewPort.translatePoint(topLeft);
            const sz = this._viewPort.translateSize(bounds.size);
            zone = {
                id: cmd.zone.id,
                bounds,
                shape: new Graphics().rect(p.x, p.y, sz.width, sz.height).stroke({ color: 0x555555 })
            }
            this._zones.set(zone.id, zone);
            this._zoneContainer?.addChild(zone.shape);
        }
    }

    private updateGeohashes(cmd: MoveCommand) {
        if (this.config.partitioning.dataPartition.type !== 'geohash') {
            return;
        }
        const hash = (Geohash as any).encode(cmd.gps.lat, cmd.gps.lon, this.config.partitioning.dataPartition.hashLength);
        let g = this._geohashes.get(hash);
        if (!g && this._viewPort) {
            const gBounds = (Geohash as any).bounds(hash);
            const bounds = Rect.fromCoordinates(gBounds.sw.lon, gBounds.ne.lat, gBounds.ne.lon, gBounds.sw.lat);
            const p = this._viewPort.translatePoint(bounds.origin);
            const sz = this._viewPort.translateSize(bounds.size);
            g = {
                id: hash,
                bounds,
                shape: new Graphics().rect(p.x, p.y, sz.width, sz.height).stroke({ color: 0x222222 })
            }
            this._geohashes.set(g.id, g);
            this._geohashContainer?.addChild(g.shape);
        }
    }

    private onMoveVehicle(cmd: MoveCommand) {
        let v = this._vehicles.get(cmd.vehicleId);
        if (!v) {
            let assetIndex = this._assets.findIndex(x => x.alias === cmd.vehicleType);
            if (!assetIndex) {
                assetIndex = Math.trunc(this._assets.length * Math.random());
            }
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
                const speedFactor = Math.min(cmd.lastCommand.speed, 40000) / 40000;
                const vehicleCountFactor = Math.min(this._vehicles.size, 10000) / 10000;
                cmd.sprite.scale.set(0.1 + 0.3 * (1 - speedFactor) * (1 - 0.9 * vehicleCountFactor) );
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
                    const p = this._viewPort.translatePoint(gpsToPoint(cmd.lastCommand.gps));
                    cmd.sprite.x = p.x;
                    cmd.sprite.y = p.y;    
                }
            }
        }
    }
}
