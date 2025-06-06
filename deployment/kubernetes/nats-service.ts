import { Construct } from 'constructs';
import { Cpu, EnvValue, ImagePullPolicy, IPersistentVolumeClaim, Probe, StatefulSet, Volume, VolumeMount } from 'cdk8s-plus-28';
import { Duration, Size } from 'cdk8s';

export interface NatsServiceOptions {
  /** The Docker image to use for this service. */
  readonly image: string; // docker image to use for this service

  /**
   * Number of replicas.
   * @default 1
   */
  readonly replicas?: number;

  /**
   * External port.
   * @default 80
   */
  readonly port?: number;

  /**
   * Internal port.
   * @default 8080
   */
  readonly containerPort?: number;

  /** Environment variables */
  readonly envVariables?: {
    [name: string]: EnvValue;
  };

  /**
   * An optional PVC for sharing data between services
   */
  sharedDataPVC?: IPersistentVolumeClaim;

  /**
   * A ConfigMap shared between services and containing the config
   */
  sharedConfig: Volume;
}

export class NatsService extends Construct {
  constructor(scope: Construct, ns: string, options: NatsServiceOptions) {
    super(scope, ns);

    const containerPort = options.containerPort || 8080;
    const replicas = options.replicas ?? 1;

    let volumes: Volume[] | undefined;
    let volumeMounts: VolumeMount[] | undefined;
    if (options.sharedDataPVC) {
      const volume = Volume.fromPersistentVolumeClaim(this, 'volume', options.sharedDataPVC);
      volumes = [volume];
      volumeMounts = [{
        volume,
        path: '/apps/output',
      }];
    }

    new StatefulSet(this, 'statefulset', {
      replicas,
      podMetadata: {
        annotations: {
          'prometheus.io/scrape': 'true',
          'prometheus.io/path': '/metrics',
          'prometheus.io/port': containerPort.toString(),
        },
      },
      volumes: [
        options.sharedConfig,
        ...(volumes ?? []),
      ],
      containers: [
        {
          name: 'web',
          image: options.image,
          imagePullPolicy: options.image.endsWith(':latest') ? ImagePullPolicy.ALWAYS : ImagePullPolicy.IF_NOT_PRESENT,
          portNumber: containerPort,
          liveness: Probe.fromHttpGet('/ping', {
            timeoutSeconds: Duration.seconds(15),
            failureThreshold: 4,
          }),
          envVariables: options.envVariables,
          securityContext: {
            ensureNonRoot: false,
          },
          resources: {
            cpu: {
              request: Cpu.millis(100),
              limit: Cpu.millis(1000),
            },
            memory: {
              request: Size.mebibytes(50),
              limit: Size.mebibytes(600),
            },
          },
          volumeMounts: [
            {
              volume: options.sharedConfig,
              subPath: 'config.yaml',
              path: '/apps/config.yaml',
            },
            ...(volumeMounts ?? []),
          ],
        },        
      ],
    });
  }
}