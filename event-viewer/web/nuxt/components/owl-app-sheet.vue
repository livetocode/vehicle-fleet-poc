<script setup lang="ts">

const props = defineProps({
    disabled: {
      type: Boolean,
      default: false,
    },
});
</script>

<template>
  <v-sheet class="overflow-hidden" border rounded elevation="1">
    <div :class="{'sheet-disabled': props.disabled}">
      <slot />
    </div>
  </v-sheet>
</template>

<style scoped>
.sheet-disabled {
  opacity: 50%;
}
</style>