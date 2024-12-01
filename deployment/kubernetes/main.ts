import { Construct } from 'constructs';
import { App, Chart, ChartProps, Size } from 'cdk8s';
import { KubeNamespace } from './imports/k8s';
import { Config } from 'core-lib';
import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { ConfigMap, Cpu, Deployment, EnvValue, Ingress, IngressBackend, PersistentVolumeAccessMode, PersistentVolumeClaim, Probe, Protocol, ServiceType, Volume } from 'cdk8s-plus-28';
import { NatsService } from './nats-service';

function loadConfig(filename: string): Config {
  const file = readFileSync(filename, 'utf8')
  const result: Config = parseYaml(file);
  const generatorInstances = process.env.GENERATOR_INSTANCES;
  if (generatorInstances && parseInt(generatorInstances) > 0) {
      result.generator.instances = parseInt(generatorInstances);
  }
  const collectorInstances = process.env.COLLECTOR_INSTANCES;
  if (collectorInstances && parseInt(collectorInstances) > 0) {
      result.collector.instances = parseInt(collectorInstances);
  }
  return result;
}

export class VehiclesChart extends Chart {
  constructor(scope: Construct, id: string, _config: Config, props: ChartProps = { }) {
    super(scope, id, props);

    const hub = this.createEventHub();

    this.createEventViewer(hub.externalServiceName);

    const {sharedConfigVolume } = this.createSharedConfig();    

    const { claim } = this.createSharedVolume();
  
    new NatsService(this, 'event-generator', {
      image: 'livetocode/vehicle-fleet-poc-event-generator:latest',
      replicas: config.generator.instances,
      containerPort: config.generator.httpPort,
      sharedDataPVC: claim,
      sharedConfig: sharedConfigVolume,
      envVariables: {
        'NATS_SERVERS': EnvValue.fromValue(hub.internalServiceName),
      }
    });

    new NatsService(this, 'event-collector', {
      image: 'livetocode/vehicle-fleet-poc-event-collector:latest',
      replicas: config.collector.instances,
      containerPort: config.collector.httpPort,
      sharedDataPVC: claim,
      sharedConfig: sharedConfigVolume,
      envVariables: {
        'NATS_SERVERS': EnvValue.fromValue(hub.internalServiceName),
      }
    });

    new NatsService(this, 'event-finder', {
      image: 'livetocode/vehicle-fleet-poc-event-finder:latest',
      replicas: config.finder.instances,
      containerPort: config.finder.httpPort,
      sharedDataPVC: claim,
      sharedConfig: sharedConfigVolume,
      envVariables: {
        'NATS_SERVERS': EnvValue.fromValue(hub.internalServiceName),
      }
    });
  }

  createEventHub() {
    const hubConfigMap = new ConfigMap(this, 'event-hub-config');
    hubConfigMap.addFile(`${__dirname}/../../event-hub/config.txt`);
    const hubConfigVolume = Volume.fromConfigMap(this, 'event-hub-config-vol', hubConfigMap);    
    
    const hub = new Deployment(this, 'event-hub', {
      replicas: 1,
      volumes: [hubConfigVolume],
      containers: [ 
        { 
          image: 'livetocode/vehicle-fleet-poc-event-hub:latest',
          liveness: Probe.fromCommand(["curl", "-f", "http://localhost:8222/varz"]),
          securityContext: {
            ensureNonRoot: false,
          },
          ports: [
            { name: 'nats', number: 4222, protocol: Protocol.TCP },
            { name: 'websockets', number: 4243, protocol: Protocol.TCP },
            { name: 'stats', number: 8222, protocol: Protocol.TCP },
            { name: 'foo', number: 6222 },
          ],
          volumeMounts: [
            {
              volume: hubConfigVolume,
              subPath: 'config.txt',
              path: '/etc/nats/nats-server.conf',
            }
          ],
          resources: {
            cpu: {
              request: Cpu.millis(100),
              limit: Cpu.millis(1000),
            },
            memory: {
              request: Size.mebibytes(100),
              limit: Size.gibibytes(1),
            },
          },
        },
      ],
    });
    const hubHost = 'vehicle-fleet-hub.kube.lab.ile.montreal.qc.ca';
    const hubService = hub.exposeViaService({serviceType: ServiceType.CLUSTER_IP});
    const hubIngress = new Ingress(this, 'hub-ingress');
    hubIngress.addHostRule(hubHost, '/', IngressBackend.fromService(hubService, { port: 4243 }));
    return {
      internalServiceName: `${hubService.name}:4222`,
      externalServiceName: hubHost,
    }
  }

  createEventViewer(hubHost: string) {
    const viewer = new Deployment(this, 'event-viewer', {
      replicas: 1,
      // volumes: [sharedConfigVolume],
      containers: [ 
        { 
          image: 'livetocode/vehicle-fleet-poc-event-viewer:latest',
          liveness: Probe.fromHttpGet('/'),
          portNumber: 3000,
          securityContext: {
            ensureNonRoot: false,
          },
          envVariables: {
            'NUXT_PUBLIC_NATS_SERVERS': EnvValue.fromValue(`ws://${hubHost}`),
          },
              // volumeMounts: [
          //   {
          //     volume: sharedConfigVolume,
          //     subPath: 'config.yaml',
          //     path: '/apps/config.yaml',
          //   }
          // ],
          resources: {
            cpu: {
              request: Cpu.millis(100),
              limit: Cpu.millis(400),
            },
            memory: {
              request: Size.mebibytes(100),
              limit: Size.mebibytes(400),
            },
          },
        },
      ],      
    });
    const viewerService = viewer.exposeViaService({serviceType: ServiceType.CLUSTER_IP});    
    const viewerIngress = new Ingress(this, 'viewer-ingress');
    viewerIngress.addHostRule('vehicle-fleet-viewer.kube.lab.ile.montreal.qc.ca', '/', IngressBackend.fromService(viewerService));
  }

  createSharedConfig() {
    const sharedConfigMap = new ConfigMap(this, 'event-shared-config');
    sharedConfigMap.addFile(`${__dirname}/../../config.yaml`);
    const sharedConfigVolume = Volume.fromConfigMap(this, 'event-shared-config-vol', sharedConfigMap);
    return { sharedConfigVolume };
  }

  createSharedVolume() {
    const accessModes = [PersistentVolumeAccessMode.READ_WRITE_MANY];
    const claim = new PersistentVolumeClaim(this, 'claim', {
      storage: Size.gibibytes(15),
      accessModes,
      // storageClassName: 'csi-rbd-sc-hdd-generic',      
    });
    return { claim };
  }
}

const config = loadConfig('../../config.yaml');

const app = new App();

const nsChart = new Chart(app, 'vehicles-ns', {
  disableResourceNameHashes: true,
});
const ns = new KubeNamespace(nsChart, 'namespace', {
  metadata: {
    name: 'infra-morgan-vehicles'
  }
});

const appChart = new VehiclesChart(app, 'vehicles', config, {
  disableResourceNameHashes: true,
  namespace: ns.name,  
});
appChart.addDependency(nsChart);
app.synth();
