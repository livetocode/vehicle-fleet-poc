<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, inject } from 'vue';
import { type MessageBus } from '../utils/messaging';
import { VehicleTrackingViewModel } from './VehicleTracking.vm';

const appConfig = useAppConfig();
const logger = createLogger(appConfig.viewer.logging, 'viewer');

const props = defineProps({
});
const messageBus = inject<MessageBus>('messageBus');
const _vm = new VehicleTrackingViewModel(appConfig, messageBus, logger);
const _generationParameters = _vm.generationParameters;

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
    <div class="d-flex align-center ga-4">
      <StartGenerationDialog
        @on-accept="(data) => _vm.startGeneration(data)"  
        :vehicleCount="_generationParameters.vehicleCount"
        :vehicleTypes="_generationParameters.vehicleTypes"
        :maxNumberOfEvents="_generationParameters.maxNumberOfEvents"
        :messageChunkSize="_generationParameters.messageChunkSize"
        :refreshIntervalInSecs="_generationParameters.refreshIntervalInSecs"
        :realtime="_generationParameters.realtime"
      />
      <DataPartitionsDialog :partitions="_vm.events.value"  />
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