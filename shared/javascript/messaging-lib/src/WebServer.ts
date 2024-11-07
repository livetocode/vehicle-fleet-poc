import { Logger } from 'core-lib';
import express from 'express';
import prom_client from 'prom-client';
import promBundle from 'express-prom-bundle';

export function createWebServer(port: number, logger: Logger, appName: string) {
    const app = express();

    const metricsMiddleware = promBundle({includeMethod: true});
    app.use(metricsMiddleware);
    
    prom_client.collectDefaultMetrics();
    prom_client.register.setDefaultLabels({
        app_name: appName,
    });
    
    app.get('/ping', (req, res) => {
        res.status(200);
        res.send('pong');
    });

    const server = app.listen(port, () => {
        logger.info(`Http server listening on http://localhost:${port} (check ping and metrics endpoints)`);
    });
    return server;    
}
