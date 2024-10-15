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
      <div class="d-flex align-center">
        <owl-stats :stats="_vm.statValues.value" />
        <div class="ml-3">
          <v-checkbox v-if="_vm.limitReached.value" label="Limit reached" density="compact" hide-details readonly v-model="_vm.limitReached.value"></v-checkbox>
          <v-checkbox v-if="_vm.timoutReached.value" label="Timeout reached" density="compact" hide-details readonly v-model="_vm.timoutReached.value"></v-checkbox>
        </div>
      </div>
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