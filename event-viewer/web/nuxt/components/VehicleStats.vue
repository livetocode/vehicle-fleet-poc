<script setup lang="ts">
import { formatBytes, formatCounts } from 'core-lib';
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { VehicleStatsViewModel } from './VehicleStats.vm';

const appConfig = useAppConfig();
const logger = createLogger(appConfig.viewer.logging, 'viewer');

const props = defineProps({
  messageBus: Object,
});
const _vm = new VehicleStatsViewModel(props.messageBus, logger);
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
      <li v-for="(stat, i) in _vm.stats.value" :key="i" >
        {{stat.name}}:<br/>{{stat.minValue}} / {{ stat.average}} / {{stat.maxValue}} {{stat.unit}}
      </li>
    </ul>
    <span>Events:</span>
    <ul>
      <li v-for="(ev, i) in _vm.events.value" :key="i" >{{ev.partitionKey}} #{{ev.collectorIndex}}: {{_vm.formatStats(ev)}}</li>
    </ul>    
  </div>
</template>
