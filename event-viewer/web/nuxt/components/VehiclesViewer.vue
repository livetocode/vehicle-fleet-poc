<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
const appConfig = useAppConfig();
const root = ref(null);
const _viewer = new Viewer(appConfig);

onMounted(() => {
  _viewer.init(root.value).catch(console.error);
});

onUnmounted(() => {
  _viewer.dispose().catch(console.error);
});

</script>

<template>
  <div ref="root"></div>
</template>
