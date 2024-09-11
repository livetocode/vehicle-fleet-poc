<script setup lang="ts">
    useHead({
        title: 'Home',
    });
</script>
<template>
  <div class="root-panel">
    <VehicleViewer class="viewer" />
    <div>
      <VehicleStats />  
      <VehicleQuerier />  
    </div>
  </div>

</template>

<style>
.root-panel {
  display: flex;
}
.viewer {
  height: 100vh;
  width: 80vw;
}

</style>