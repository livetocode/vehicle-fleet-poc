<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { VehicleViewerViewModel } from './VehicleViewer.vm';

const appConfig = useAppConfig();
const logger = createLogger(appConfig.viewer.logging, 'viewer');

const props = defineProps({
  messageBus: Object,
});
const root = ref(null);
const _vm = new VehicleViewerViewModel(appConfig, props.messageBus, logger);

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
