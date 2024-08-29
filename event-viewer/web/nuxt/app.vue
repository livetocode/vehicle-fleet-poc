<script setup>
  import { ConsoleLogger } from 'core-lib';
  const appConfig = useAppConfig();
  const logger = createLogger(appConfig.viewer.logging, 'viewer');
  logger.info('App is initializing...');
  if (appConfig.hub.type !== 'nats') {
    throw new Error('Expected a NATS hub');
  }
  const messageBus = new NatsMessageBus(appConfig.hub, logger);
  // await messageBus.start();
  // messageBus.watch('commands.move.*').catch(console.error);
  // messageBus.watch('stats').catch(console.error);
  // console.info('App is initialized');

onMounted(() => {
  logger.debug('App is mounting...');
  messageBus.start().then(() => {
    messageBus.watch('commands.move.*').catch(console.error);
    messageBus.watch('stats').catch(console.error);
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
  <div class="root-panel">
    <VehicleViewer class="viewer" :messageBus="messageBus" />
    <div>
      <VehicleStats :messageBus="messageBus" />  
      <VehicleQuerier :messageBus="messageBus" />  
    </div>
  </div>
</template>

<style>
.root-panel {
  display: flex;
}
.viewer {
  height: 100vh;
  width: 80vw;
}

</style>