<script setup lang="ts">
const props = defineProps({
    periods: {
        type: Array,
        default: [],
    },
    geometries: {
        type: Array,
        default: [],
    },
    vehicleTypes: {
        type: Array,
        default: [],
    },
    limit: {
        type: Number,
        default: 1000000,
    },
    timeout: {
        type: Number,
        default: 30,
    },
    parallelize: {
        type: Boolean,
        default: true,
    },
    useChunking: {
        type: Boolean,
        default: true,
    },
});
const emit = defineEmits<{
    (e: 'onCancel'): void,
    (e: 'onAccept', payload: { periodId: string, geometryId: string, vehicleTypes: string[], limit: number, timeout: number }): void,
}>();

let fldPeriodId = ref(props.periods[0] as string);
let fldGeometryId = ref(props.geometries[0] as string);
let fldVehicleTypes = ref<string[]>([]);
let fldLimit = ref(props.limit);
let fldTimeout = ref(props.timeout);
let fldParallelize = ref(props.parallelize);
let fldUseChunking = ref(props.useChunking);

function onCancelDialog(isActive: Ref<boolean>) {
    isActive.value = false;
    emit('onCancel');
};

function onAcceptDialog(isActive: Ref<boolean>) {
    isActive.value = false;
    const data = {
        periodId: fldPeriodId.value,
        geometryId: fldGeometryId.value,
        vehicleTypes: fldVehicleTypes.value,
        limit: parseInt(fldLimit.value.toString()),
        timeout: parseInt(fldTimeout.value.toString()),
        parallelize: fldParallelize.value,
        useChunking: fldUseChunking.value,
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
                    v-model="fldGeometryId"
                    :items="props.geometries"
                    label="Geometry*"
                    required
                  ></v-select>
                </v-col>

              </v-row>
              <v-row dense>
                <v-col
                  cols="12"
                  sm="6"
                >
                    <v-text-field type="number" label="Limit" v-model="fldLimit"></v-text-field>
                </v-col>
                <v-col
                  cols="12"
                  sm="6"
                >
                    <v-text-field type="number" label="Timout (secs)" v-model="fldTimeout"></v-text-field>
                </v-col>
              </v-row>

              <v-row dense>
                <v-col
                  cols="12"
                  sm="6"
                >
                    <v-checkbox label="Parallel search" v-model="fldParallelize"></v-checkbox>
                </v-col>
                <v-col
                  cols="12"
                  sm="6"
                >
                    <v-checkbox label="Use chunking" v-model="fldUseChunking"></v-checkbox>
                </v-col>
              </v-row>
              <v-row dense>
                <v-col
                  cols="12"
                  sm="6"
                >
                  <v-select
                    v-model="fldVehicleTypes"
                    :items="props.vehicleTypes"
                    label="Vehicle Type"
                    multiple
                    clearable
                  ></v-select>
                </v-col>
                <v-col
                  cols="12"
                  sm="6"
                >
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