<script setup lang="ts">
    useHead({
        title: 'Search',
    });
</script>
<template>
  <div class="root-panel">
    <VehicleViewer class="viewer" />
    <div class="side-panel">
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
.side-panel {
  padding-left: 15px;
}

</style>