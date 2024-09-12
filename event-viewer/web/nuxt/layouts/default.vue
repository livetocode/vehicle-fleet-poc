<script setup>
const config = useRuntimeConfig()
useHead({
  titleTemplate: (titleChunk) => {
    const appName = config.public.appName;
    if (appName == titleChunk) return titleChunk
    return titleChunk ? `${titleChunk} - ${appName}` : appName;
  }
})
</script>
<template>
    <v-app>
        <v-app-bar :elevation="2" density="compact" color="primary">
            <template v-slot:prepend>
                <v-app-bar-nav-icon></v-app-bar-nav-icon>
            </template>
            <v-app-bar-title>Vehicles tracker</v-app-bar-title>
        </v-app-bar> 
        <v-main>
            <slot />
        </v-main>
    </v-app>
</template>