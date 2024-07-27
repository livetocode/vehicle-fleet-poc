<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { VehicleStatsViewModel } from './VehicleStats.vm';
const props = defineProps({
  messageBus: Object,
});
const _vm = new VehicleStatsViewModel(props.messageBus);

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
      <li>Total events: {{_vm.totalEventCount}}</li>
      <li>Total files: {{_vm.totalFileCount}}</li>
      <li>Total size: {{_vm.totalSize}}</li>
    </ul>
    <span>Events:</span>
    <ul>
      <li v-for="(ev, i) in _vm.events.value" :key="i" >{{ev.partitionKey}}: {{ev.eventCount}}</li>
    </ul>    
  </div>
</template>
