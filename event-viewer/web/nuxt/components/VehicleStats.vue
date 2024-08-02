<script setup lang="ts">
import { formatBytes, formatCounts } from 'core-lib';
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { VehicleStatsViewModel } from './VehicleStats.vm';
const props = defineProps({
  messageBus: Object,
});
const _vm = new VehicleStatsViewModel(props.messageBus);
const totalSizeAsStr = computed(() => {
  const formatted = formatBytes(_vm.totalSize.value, 1);
  return `${formatted.value} ${formatted.units}`;
});
const totalEventCountAsStr = computed(() => {
  if (_vm.totalEventCount.value === 0) {
    return '0';
  }
  const formatted = formatCounts(_vm.totalEventCount.value, 1);
  return `${_vm.totalEventCount.value} (${formatted.value} ${formatted.units})`;
});

onMounted(() => {
  _vm.init().catch(console.error);
});

onUnmounted(() => {
  _vm.dispose().catch(console.error);
});

</script>

<template>
  <div style="padding: 10px;">
    <span>Stats:</span>
    <ul>
      <li>Total events: {{totalEventCountAsStr}}</li>
      <li>Total time partitions: {{_vm.totalTimePartitionCount}}</li>
      <li>Total data partitions: {{_vm.totalDataPartitionCount}}</li>
      <li>Total size: {{totalSizeAsStr}}</li>
    </ul>
    <span>Events:</span>
    <ul>
      <li v-for="(ev, i) in _vm.events.value" :key="i" >{{ev.partitionKey}}: {{ev.eventCount}} #{{ev.collectorIndex}}</li>
    </ul>    
  </div>
</template>
