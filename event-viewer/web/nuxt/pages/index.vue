<script setup lang="ts">
    useHead({
        title: 'Home',
    });
</script>
<template>
  <div class="d-flex justify-center align-center ga-10 fill-height w-100">
    <v-btn text nuxt to="/tracking" prepend-icon="mdi-car-connected" size="x-large" elevation="5" color="purple-lighten-5" stacked>Tracking</v-btn>
    <v-btn text nuxt to="/search" prepend-icon="mdi-car-search" size="x-large" elevation="5" color="purple-lighten-5" stacked>Search</v-btn>
  </div>
</template>

<style>
</style>