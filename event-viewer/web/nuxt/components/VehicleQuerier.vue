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
  <div style="padding: 10px;">
    <p>Queries:</p>
    <v-btn @click="_vm.simpleQuery()">Small</v-btn>
    <v-btn @click="_vm.mediumQuery()">Medium</v-btn>
    <v-btn @click="_vm.lshapeQuery()">L shape</v-btn>
    <p>Results: {{_vm.resultCount}}</p>
    <p>{{_vm.stats}}</p>
    <p>Found {{_vm.vehicleIds.value.length}} vehicles:</p>
    <ul>
      <li v-for="(ev, i) in _vm.vehicleIds.value" :key="i" >{{ev}}</li>
    </ul>    
  </div>
</template>
