<script setup lang="ts">
    useHead({
        title: 'Search',
    });
</script>
<template>
  <div>
    <VehicleFinder />  
    <VehicleViewer mode="search" class="viewer" />
  </div>
</template>

<style>
.viewer {
  height: 100vh;
  width: 100vw;
}
</style>