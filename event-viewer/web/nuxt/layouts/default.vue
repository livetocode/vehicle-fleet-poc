<script setup>
const config = useRuntimeConfig()
const appName = config.public.appName;
useHead({
  titleTemplate: (titleChunk) => {
    if (appName == titleChunk) return titleChunk
    return titleChunk ? `${titleChunk} - ${appName}` : appName;
  }
})
</script>
<template>
    <v-app>
        <v-app-bar :elevation="2" density="compact" color="primary">
            <!-- <template v-slot:prepend>
                <v-app-bar-nav-icon></v-app-bar-nav-icon>
            </template> -->
            <v-app-bar-title>
                <nuxt-link to="/" class="text-decoration-none bg-primary">
                    <v-icon icon="mdi-car-multiple" class="mr-2" />
                    {{appName}}
                </nuxt-link>
            </v-app-bar-title>
            <v-spacer />
            <v-btn text nuxt to="/tracking">Tracking</v-btn>
            <v-btn text nuxt to="/search">Search</v-btn>
            <v-btn text nuxt to="/settings">Settings</v-btn>
        </v-app-bar> 
        <v-main>
            <slot />
        </v-main>
    </v-app>
</template>