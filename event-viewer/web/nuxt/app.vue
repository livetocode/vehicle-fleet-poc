<script setup>
  import { ConsoleLogger } from 'core-lib';
  const appConfig = useAppConfig();
  const logger = createLogger(appConfig.viewer.logging, 'viewer');
  logger.info('App is initializing...');
  if (appConfig.hub.type !== 'nats') {
    throw new Error('Expected a NATS hub');
  }
  const messageBus = new NatsMessageBus(appConfig.hub, logger);
  provide('messageBus', messageBus);

onMounted(() => {
  logger.debug('App is mounting...');
  messageBus.start().then(() => {
    messageBus.watch('commands.move.*').catch(console.error);
    messageBus.watch('stats').catch(console.error);
    messageBus.watch('query.vehicles').catch(console.error);
    messageBus.watch('query.vehicles.results').catch(console.error);
  }).catch(console.error);
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
