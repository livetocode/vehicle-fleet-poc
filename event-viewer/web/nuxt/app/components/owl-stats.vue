<script setup lang="ts">

const props = defineProps({
    stats: {
      type: Array,
      default() {
        return []
      },
    },
});

</script>
<template>
  <div class="d-flex flex-wrap flex-grow-0 mt-3 mb-5" style="gap: 20px">
    <div v-for="(stat, i) in props.stats" :key="i">
      <owl-stat :stat="stat" style="min-width: 100px" />
    </div>
  </div>
</template>

