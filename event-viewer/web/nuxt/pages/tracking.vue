<script setup lang="ts">
    useHead({
        title: 'Tracking',
    });
</script>
<template>
  <div>
    <VehicleTracking />  
    <VehicleViewer mode="tracking" class="viewer" />
  </div>
</template>

<style>
.viewer {
  height: 100vh;
  width: 100vw;
}
</style>