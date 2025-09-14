<script setup>
  import { onMounted, onUnmounted, provide } from 'vue';
  import { registerCodecs, commands, events } from 'core-lib';
  import { NatsMessageBus, AzureServiceBusMessageBus } from './utils/messaging';

  const appConfig = useAppConfig();
  const identity = {
    name: 'viewer',
    instance: 0,
    runtime: 'browser-js',
}
  const logger = createLogger(appConfig.viewer.logging, identity.name);
  logger.info('App is initializing...');
  const runtimeConfig = useRuntimeConfig();
  let messageBus;
  let connectionString;
  if (appConfig.hub.type === 'nats') {
    let servers = appConfig.hub.protocols.websockets.servers;
    const serversOverride = runtimeConfig.public.natsServers
    if (serversOverride && serversOverride.length > 0) {
        servers = serversOverride.split(',');
    }
    connectionString = servers.join(',');

    messageBus = new NatsMessageBus(identity, logger, appConfig.chaosEngineering);
  } else if (appConfig.hub.type === 'azureServiceBus') {
    messageBus = new AzureServiceBusMessageBus(identity, logger, appConfig.chaosEngineering);
    connectionString =  appConfig.hub.connectionString;
  } else {
    throw new Error('Expected a valid hub');
  }
  
  if (appConfig.hub.enableProtoBuf) {
    registerCodecs(messageBus);
  }
  if (messageBus.features.supportsAbstractSubjects) {
    messageBus.subscribe({ type: 'topic', path: commands.move.subscribe({})});
  } else {
    messageBus.subscribe({ type: 'topic', path: events.vehicles.moved.subscribe({})});
  }
  messageBus.subscribe({ type: 'topic', path: events.vehicles.byTypeAndSubType.subscribe({})});
  
  provide('messageBus', messageBus);
  provide('connectionString', connectionString);

onMounted(() => {
  logger.debug('App is mounting...');
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
    <owl-app-connected>
      <NuxtLoadingIndicator />
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </owl-app-connected>
  </div>
</template>
