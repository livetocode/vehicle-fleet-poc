<script setup>
  import { registerCodecs } from 'core-lib';
  
  const appConfig = useAppConfig();
  const identity = {
    name: 'viewer',
    instance: 0,
  }
  const logger = createLogger(appConfig.viewer.logging, identity.name);
  logger.info('App is initializing...');
  if (appConfig.hub.type !== 'nats') {
    throw new Error('Expected a NATS hub');
  }
  let servers = appConfig.hub.protocols.websockets.servers;
  const runtimeConfig = useRuntimeConfig();
  const serversOverride = runtimeConfig.public.natsServers
  if (serversOverride && serversOverride.length > 0) {
      servers = serversOverride.split(',');
  }
  const connectionString = servers.join(',');

  const messageBus = new NatsMessageBus(identity, logger);
  if (appConfig.hub.enableProtoBuf) {
    registerCodecs(messageBus);
  }
  provide('messageBus', messageBus);

onMounted(() => {
  logger.debug('App is mounting...');
  messageBus.subscribe('commands.move');
  messageBus.subscribe('events.vehicles.*.*');
  messageBus.start(connectionString).catch(console.error);
  logger.debug('App is mounted');
});

onUnmounted(() => {
  logger.debug('App is unmounting...');
  messageBus.stop().catch(console.error);
  logger.debug('App is unmounted');
});

</script>

<template>
  <div>
    <NuxtLoadingIndicator />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
