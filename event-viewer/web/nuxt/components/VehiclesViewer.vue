<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
const props = defineProps({
  messageBus: Object,
});
const appConfig = useAppConfig();
const root = ref(null);
const _viewer = new Viewer(appConfig, props.messageBus);

onMounted(() => {
  console.log('mounted', root);
  _viewer.init(root.value).catch(console.error);
});

onUnmounted(() => {
  console.log('unmounted', root);
  _viewer.dispose().catch(console.error);
});

</script>

<template>
  <div ref="root"></div>
</template>
