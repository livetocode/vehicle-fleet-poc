<script setup>
  import { ConsoleLogger } from 'core-lib';
  console.info('App is initializing...');
  const appConfig = useAppConfig();
  const logger = new ConsoleLogger('viewer');
  if (appConfig.hub.type !== 'nats') {
    throw new Error('Expected a NATS hub');
  }
  const messageBus = new NatsMessageBus(appConfig.hub, logger);
  window._messageBus = messageBus;
  await messageBus.init();
  messageBus.run('commands').catch(console.error);
  messageBus.run('stats').catch(console.error);
  console.info('App is initialized');
</script>

<template>
  <div class="root-panel">
    <VehicleViewer class="viewer" :messageBus="messageBus" />
    <VehicleStats :messageBus="messageBus" />  
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