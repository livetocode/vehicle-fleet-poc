<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
const props = defineProps({
  messageBus: Object,
});
const _stats = new Stats(props.messageBus);

onMounted(() => {
  _stats.init().catch(console.error);
});

onUnmounted(() => {
  _stats.dispose().catch(console.error);
});

</script>

<template>
  <div style="padding: 10px;">
    <span>Stats:</span>
    <ul>
      <li>Total events: {{_stats.totalEventCount}}</li>
      <li>Total files: {{_stats.totalFileCount}}</li>
      <li>Total size: {{_stats.totalSize}}</li>
    </ul>
    <span>Events:</span>
    <ul>
      <li v-for="(ev, i) in _stats.events.value" :key="i" >{{ev.partitionKey}}: {{ev.eventCount}}</li>
    </ul>    
  </div>
</template>
