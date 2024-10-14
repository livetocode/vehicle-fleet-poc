<script setup lang="ts">
const props = defineProps({
    periods: {
        type: Array,
        default: [],
    },
    polygons: {
        type: Array,
        default: [],
    },
});
const emit = defineEmits<{
    (e: 'onCancel'): void,
    (e: 'onAccept', payload: { periodId: string, polygonId: string }): void,
}>();

let fldPeriodId = props.periods[0] as string;
let fldPolygonId = props.polygons[0] as string;

function onCancelDialog(isActive: Ref<boolean>) {
    isActive.value = false;
    emit('onCancel');
};

function onAcceptDialog(isActive: Ref<boolean>) {
    isActive.value = false;
    const data = {
        periodId: fldPeriodId,
        polygonId: fldPolygonId,
    };
    emit('onAccept', data);
};
</script>
<template>
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
                    v-model="fldPeriodId"
                    :items="props.periods"
                    label="Period*"
                    required
                  ></v-select>
                </v-col>

                <v-col
                  cols="12"
                  sm="6"
                >
                  <v-select
                    v-model="fldPolygonId"
                    :items="props.polygons"
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
                @click="onCancelDialog(isActive)"
              ></v-btn>

              <v-btn
                color="primary"
                text="Start"
                variant="tonal"
                @click="onAcceptDialog(isActive)"
              ></v-btn>
            </v-card-actions>
          </v-card>
        </template>
      </v-dialog>      
</template>