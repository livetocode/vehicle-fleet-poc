<script setup lang="ts">
import { ref, onMounted, onUnmounted, inject } from 'vue';
import { type MessageBus } from '../utils/messaging';
import { VehicleViewerViewModel } from './VehicleViewer.vm';
import { createLogger } from '../utils/logging';

const appConfig = useAppConfig();
const logger = createLogger(appConfig.viewer.logging, 'viewer');

const props = defineProps({
});
const messageBus = inject<MessageBus>('messageBus');
const root = ref(null);
const _vm = new VehicleViewerViewModel(appConfig, messageBus, logger);

onMounted(() => {
  logger.debug('VehicleViewer mounted', root);
  _vm.init(root.value).catch(console.error);
});

onUnmounted(() => {
  logger.debug('VehicleViewer unmounted', root);
  _vm.dispose().catch(console.error);
});

</script>

<template>
  <div ref="root"></div>
</template>
