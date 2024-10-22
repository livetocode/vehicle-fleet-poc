<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, inject } from 'vue';
import { type MessageBus } from '../utils/messaging';
import { VehicleTrackingViewModel } from './VehicleTracking.vm';

const appConfig = useAppConfig();
const logger = createLogger(appConfig.viewer.logging, 'viewer');

const props = defineProps({
});
const messageBus = inject<MessageBus>('messageBus');
const _vm = new VehicleTrackingViewModel(messageBus, logger);

onMounted(() => {
  _vm.init().catch(console.error);
});

onUnmounted(() => {
  _vm.dispose().catch(console.error);
});

</script>

<template>
  <div class="stat-area d-flex align-center justify-space-between">
    <owl-stats :stats="_vm.statValues.value" />
    <DataPartitionsDialog :partitions="_vm.events.value"  />
  </div>
</template>
<style scoped>
.stat-area {
  padding-top: 8px;
  padding-left: 20px;
  padding-right: 16px;
}

</style>