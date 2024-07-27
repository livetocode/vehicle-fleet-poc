<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { VehicleViewerViewModel } from './VehicleViewer.vm';

const props = defineProps({
  messageBus: Object,
});
const appConfig = useAppConfig();
const root = ref(null);
const _vm = new VehicleViewerViewModel(appConfig, props.messageBus);

onMounted(() => {
  console.log('mounted', root);
  _vm.init(root.value).catch(console.error);
});

onUnmounted(() => {
  console.log('unmounted', root);
  _vm.dispose().catch(console.error);
});

</script>

<template>
  <div ref="root"></div>
</template>
