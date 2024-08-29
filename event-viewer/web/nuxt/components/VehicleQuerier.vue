<script setup lang="ts">
import { formatBytes, formatCounts } from 'core-lib';
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { VehicleQuerierViewModel } from './VehicleQuerier.vm';

const appConfig = useAppConfig();
const logger = createLogger(appConfig.viewer.logging, 'querier');

const props = defineProps({
  messageBus: Object,
});
const _vm = new VehicleQuerierViewModel(props.messageBus, logger);

onMounted(() => {
  _vm.init().catch(console.error);
});

onUnmounted(() => {
  _vm.dispose().catch(console.error);
});

</script>

<template>
  <div style="padding: 10px;">
    <p>Queries:</p>
    <button @click="_vm.simpleQuery()">Small</button>
    <button>Medium</button>
    <p>Results: {{_vm.resultCount}}</p>
    <p>{{_vm.stats}}</p>
    <p>Found {{_vm.vehicleIds.value.length}} vehicles:</p>
    <ul>
      <li v-for="(ev, i) in _vm.vehicleIds.value" :key="i" >{{ev}}</li>
    </ul>    
  </div>
</template>
