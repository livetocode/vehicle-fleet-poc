<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, inject } from 'vue';
import { VehicleQuerierViewModel } from './VehicleQuerier.vm';
import { type MessageBus } from '../utils/messaging';

const appConfig = useAppConfig();
const logger = createLogger(appConfig.viewer.logging, 'querier');

const props = defineProps({
});
const messageBus = inject<MessageBus>('messageBus');
const _vm = new VehicleQuerierViewModel(appConfig, messageBus, logger);

onMounted(() => {
  _vm.init().catch(console.error);
});

onUnmounted(() => {
  _vm.dispose().catch(console.error);
});

</script>

<template>
  <div>
    <div class="stat-area d-flex align-center justify-space-between">
      <owl-stats :stats="_vm.statValues.value" />
      <VehicleQueryDialog :periods="Object.keys(_vm.periods)" :polygons="Object.keys(_vm.polygons)" @on-accept="(data) => _vm.startQuery(data)" />
    </div>
  
  </div>
</template>
<style scoped>
.stat-area {
  padding-top: 8px;
  padding-left: 20px;
  padding-right: 16px;
}

</style>