<script setup lang="ts">
    useHead({
        title: 'Search',
    });
</script>
<template>
  <div>
    <VehicleQuerier />  
    <VehicleViewer class="viewer" />
  </div>
</template>

<style>
.viewer {
  height: 100vh;
  width: 100vw;
}
</style>