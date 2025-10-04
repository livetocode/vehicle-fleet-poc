<script setup lang="ts">
    useHead({
        title: 'Settings',
    });
</script>
<template>
  <div class="d-flex justify-center align-center ga-10 fill-height w-100">
    <v-btn text nuxt to="/settings/services" prepend-icon="mdi-apps" size="x-large" elevation="5" color="purple-lighten-5" stacked>Services</v-btn>
    <v-btn text nuxt to="/settings/messages" prepend-icon="mdi-file-document-multiple-outline" size="x-large" elevation="5" color="purple-lighten-5" stacked>Messages</v-btn>
  </div>
</template>

<style>
</style>