<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, inject } from 'vue';
import { type MessageBus } from '../utils/messaging';
import { VehicleStatsViewModel } from './VehicleStats.vm';

const appConfig = useAppConfig();
const logger = createLogger(appConfig.viewer.logging, 'viewer');

const props = defineProps({
});
const messageBus = inject<MessageBus>('messageBus');
const _vm = new VehicleStatsViewModel(messageBus, logger);

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
    <v-btn class="ml-8 text-none" color="primary" size="small">View data partitions...</v-btn>
    <!-- <span>Events:</span>
    <ul>
      <li v-for="(ev, i) in _vm.events.value" :key="i" >{{ev.partitionKey}} #{{ev.collectorIndex}}: {{_vm.formatStats(ev)}}</li>
    </ul>     -->
  </div>
</template>
<style scoped>
.stat-area {
  padding-top: 8px;
  padding-left: 20px;
  padding-right: 16px;
}

</style>