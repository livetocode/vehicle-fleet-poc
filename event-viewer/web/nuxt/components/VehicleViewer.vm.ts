import { Application, Assets, Container, Graphics, Sprite } from 'pixi.js';
import { EventHandler, LambdaEventHandler, addOffsetToCoordinates, gpsToPoint, KM, Rect, ViewPort, type Config, type Logger, type MoveCommand, type ResetAggregatePeriodStats, type VehicleQuery, type VehicleQueryResult, type MessageBus } from 'core-lib';
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
    private _gridContainer?: Container;
    private _vehiclesContainer?: Container;
    private _zoneContainer?: Container;
    private _geohashContainer?: Container;
    private _viewPort?: ViewPort;
    private _vehicles = new Map<string, Vehicle>();
    private _assets: AssetRef[] = [];
    private _moveHandler?: EventHandler;
    private _queryHandler?: EventHandler;
    private _queryResultHandler?: EventHandler;
    private _resetStatsHandler?: EventHandler;
    private host: any;
    
    constructor (private config: Config, private _messageBus: MessageBus, private logger: Logger, private mode: string) {
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
        this.host = host;
        const app = new Application();
        this._app = app;
        const mainAreaContainer = new Container();
        this._gridContainer = mainAreaContainer;        
        app.stage.addChild(mainAreaContainer);
        const geohashContainer = new Container();
        this._geohashContainer = geohashContainer;        
        app.stage.addChild(geohashContainer);
        const zoneContainer = new Container();
        this._zoneContainer = zoneContainer;        
        app.stage.addChild(zoneContainer);
        const container = new Container();
        this._vehiclesContainer = container;        
        app.stage.addChild(container);

        await app.init({ resizeTo: host, background: 0x222222 });
        host.appendChild(app.canvas);

        await this.preload();
        this._viewPort = this.createViewPort();
        this.createGrid();
        this.createGeohashes();
        this.createZones();

        app.ticker.add((time: any) => {
            this.animate(time);
        });
        if (this.mode === 'tracking') {
            this._moveHandler = new LambdaEventHandler(['move'], async (ev: any) => { this.onProcessCommand(ev); });
            this._resetStatsHandler = new LambdaEventHandler(['reset-aggregate-period-stats'], async (ev: any) => { this.onResetStats(ev); });
            this._messageBus.registerHandlers(this._moveHandler, this._resetStatsHandler);
        } else if (this.mode === 'search') {
            this._queryHandler = new LambdaEventHandler(['vehicle-query'], async (ev: any) => { this.onProcessQuery(ev); });
            this._queryResultHandler = new LambdaEventHandler(['vehicle-query-result'], async (ev: any) => { this.onProcessQueryResult(ev); });
            this._messageBus.registerHandlers(this._queryHandler, this._queryResultHandler);    
        }
        app.renderer.on('resize', () => {
            this.reset(false);
        });
    }

    async dispose() {
        if (this._moveHandler) {
            this._messageBus?.unregisterHandler(this._moveHandler);
            this._moveHandler = undefined;
        }
        if (this._resetStatsHandler) {
            this._messageBus?.unregisterHandler(this._resetStatsHandler);
            this._resetStatsHandler = undefined;
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
        this.onMoveVehicle(cmd);
    }
    
    private onResetStats(ev: ResetAggregatePeriodStats) {
        this.reset(true);
    }

    private onProcessQuery(res: VehicleQuery) {
        this.logger.debug('Received query', res);
        this.reset(true);
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
            direction: res.direction,
            speed: res.speed,
            gps: res.gps,
            timestamp: res.timestamp,        
        };
        this.onMoveVehicle(cmd);
    }

    private reset(includeVehicles: boolean) {
        if (includeVehicles) {
            this._vehiclesContainer?.removeChildren();
            this._vehicles.clear();
        } else {
            for (const v of this._vehicles.values()) {
                v.isDirty = true;
            }
        }
        this._gridContainer?.removeChildren();
        this._zoneContainer?.removeChildren();
        this._geohashContainer?.removeChildren();
        this._viewPort = this.createViewPort();
        this.createGrid();
        this.createZones();
        this.createGeohashes();
    }

    private createViewPort(): ViewPort {
        // Note that we need to take into account the offset position of the component in the page,
        // otherwise the height of the PixiJS app is too large because of the header containing the App bar.
        const bodyRect = document.body.getBoundingClientRect();
        const hostRect = this.host.getBoundingClientRect();
        const xOffset   = hostRect.left - bodyRect.left;
        const yOffset   = hostRect.top - bodyRect.top;
    
        const innerBounds = Rect.fromCoordinates(0, 0, this.app.screen.width - xOffset, this.app.screen.height - yOffset);
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

    private createGrid() {
        if (!this._viewPort) {
            return;
        }
        const r = this._viewPort.translateRect(this._viewPort.outerBound);
        const shape = new Graphics().rect(r.minX, r.minY, r.width, r.height).fill({ color: 'black' });
        this._gridContainer?.addChild(shape);
    }

    private createGeohashes() {
        if (!this._viewPort) {
            return;
        }
        if (this.config.partitioning.dataPartition.type !== 'geohash') {
            return;
        }
        const origin = this.config.generator.map.topLeftOrigin;
        const hash = (Geohash as any).encode(origin.lat, origin.lon, this.config.partitioning.dataPartition.hashLength);
        const gBounds = (Geohash as any).bounds(hash);
        const bounds = Rect.fromCoordinates(gBounds.sw.lon, gBounds.ne.lat, gBounds.ne.lon, gBounds.sw.lat);
        const r = this._viewPort.translateRect(bounds);
        const areaRect = this._viewPort.translateRect(this._viewPort.outerBound);
        let currentX = r.minX;
        let currentY = r.minY;
        while (currentY < areaRect.maxY) {
            while (currentX < areaRect.maxX) {
                const shape = new Graphics().rect(currentX, currentY, r.width, r.height).stroke({ color: 0x333333 });
                this._geohashContainer?.addChild(shape);
                currentX += r.width;
            }
            currentY += r.height;
            currentX = r.minX;
        }
    }

    private createZones() {
        if (!this._viewPort) {
            return;
        }
        const topLeft = this.config.generator.map.topLeftOrigin;
        const bottomRight = addOffsetToCoordinates(topLeft, this.config.generator.zoneSize.widthInKm * KM, this.config.generator.zoneSize.heightInKm * KM);
        const bounds = Rect.fromCoordinates(topLeft.lon, topLeft.lat, bottomRight.lon, bottomRight.lat);
        const r = this._viewPort.translateRect(bounds);
        const areaRect = this._viewPort.translateRect(this._viewPort.outerBound);
        let currentX = r.minX;
        let currentY = r.minY;
        while (currentY < areaRect.maxY-1) {
            while (currentX < areaRect.maxX-1) {
                const shape = new Graphics().rect(currentX, currentY, r.width, r.height).stroke({ color: 0x007700 });
                this._zoneContainer?.addChild(shape);
                currentX += r.width;
            }
            currentY += r.height;
            currentX = r.minX;
        }        
    }

    private onMoveVehicle(cmd: MoveCommand) {
        let v = this._vehicles.get(cmd.vehicleId);
        if (!v) {
            let assetIndex = this._assets.findIndex(x => x.alias === cmd.vehicleType);
            if (assetIndex < 0) {
                assetIndex = Math.trunc(this._assets.length * Math.random());
            }
            const assetRef = this._assets[assetIndex];
            const assetAlias = assetRef.alias;
            const sprite = Sprite.from(assetAlias);
            sprite.anchor.set(0.5);
            this._vehiclesContainer?.addChild(sprite);
    
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
            { alias: 'Ambulance', src: '/cars/Ambulance.png' },
            { alias: 'Audi', src: '/cars/Audi.png' },
            { alias: 'Black_viper', src: '/cars/Black_viper.png' },
            { alias: 'Car', src: '/cars/Car.png' },
            { alias: 'Mini_truck', src: '/cars/Mini_truck.png' },
            { alias: 'Mini_van', src: '/cars/Mini_van.png' },
            { alias: 'Police', src: '/cars/Police.png' },
            { alias: 'taxi', src: '/cars/taxi.png' },
            { alias: 'truck', src: '/cars/truck.png' },
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
