<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, inject } from 'vue';
import { VehicleQuerierViewModel } from './VehicleQuerier.vm';
import { type MessageBus } from '../utils/messaging';

const appConfig = useAppConfig();
const logger = createLogger(appConfig.viewer.logging, 'querier');

const props = defineProps({
});
const messageBus = inject<MessageBus>('messageBus');
const _vm = new VehicleQuerierViewModel(appConfig, messageBus, logger);

onMounted(() => {
  _vm.init().catch(console.error);
});

onUnmounted(() => {
  _vm.dispose().catch(console.error);
});

</script>

<template>
  <div>
    <div class="stat-area d-flex align-center justify-space-between">
      <owl-stats :stats="_vm.statValues.value" />
      <v-dialog
        max-width="600"
      >
        <template v-slot:activator="{ props: activatorProps }">
          <v-btn
            class="text-none"
            prepend-icon="mdi-magnify"
            text="New query"
            color="primary"
            v-bind="activatorProps"
          ></v-btn>
        </template>
        <template v-slot:default="{ isActive }">
          <v-card
            prepend-icon="mdi-car-search-outline"
            title="New query"
          >
            <v-card-text>
              <v-row dense>
                <v-col
                  cols="12"
                  sm="6"
                >
                  <v-select
                    v-model="_vm.fldPeriod.value"
                    :items="Object.keys(_vm.periods)"
                    label="Period*"
                    required
                  ></v-select>
                </v-col>

                <v-col
                  cols="12"
                  sm="6"
                >
                  <v-select
                    v-model="_vm.fldPolygon.value"
                    :items="Object.keys(_vm.polygons)"
                    label="Polygon*"
                    required
                  ></v-select>
                </v-col>

              </v-row>

              <small class="text-caption text-medium-emphasis">*indicates required field</small>
            </v-card-text>

            <v-divider></v-divider>

            <v-card-actions>
              <v-spacer></v-spacer>

              <v-btn
                text="Cancel"
                variant="plain"
                @click="isActive.value = false"
              ></v-btn>

              <v-btn
                color="primary"
                text="Start"
                variant="tonal"
                @click="_vm.startQuery(isActive)"
              ></v-btn>
            </v-card-actions>
          </v-card>
        </template>
      </v-dialog>  
    </div>
  
  </div>
</template>
<style scoped>
.stat-area {
  padding-top: 8px;
  padding-left: 20px;
  padding-right: 16px;
}

</style>