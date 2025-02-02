<script setup lang="ts">

const props = defineProps({
    vehicleCount: {
        type: Number,
        default: 100,
    },
    vehicleTypes: {
        type: Array,
        default: [],
    },
    maxNumberOfEvents: {
        type: Number,
        default: 1000000,
    },
    refreshIntervalInSecs: {
        type: Number,
        default: 5,
    },
    realtime: {
        type: Boolean,
        default: false,
    },
    pauseDelayInMSecs: {
        type: Number,
        default: 1,
    },

});
const emit = defineEmits<{
    (e: 'onCancel'): void,
    (e: 'onAccept', payload: {
      vehicleCount: number;
      vehicleTypes: string[];
      maxNumberOfEvents: number;
      refreshIntervalInSecs: number;
      realtime: boolean;
      pauseDelayInMSecs: number;
    }): void,
}>();

let fldVehicleCount = ref(props.vehicleCount);
let fldVehicleTypes = ref<string[]>(props.vehicleTypes);
let fldMaxNumberOfEvents = ref(props.maxNumberOfEvents);
let fldRefreshIntervalInSecs = ref(props.refreshIntervalInSecs);
let fldRealtime = ref(props.realtime);
let fldPauseDelayInMSecs = ref(props.pauseDelayInMSecs);

function onCancelDialog(isActive: Ref<boolean>) {
    isActive.value = false;
    emit('onCancel');
};

function onAcceptDialog(isActive: Ref<boolean>) {
    isActive.value = false;
    const data = {
      vehicleCount: fldVehicleCount.value * 1, // multiplication will force the value to become a number, even if it is a string
      vehicleTypes: fldVehicleTypes.value,
      maxNumberOfEvents: fldMaxNumberOfEvents.value * 1,
      refreshIntervalInSecs: fldRefreshIntervalInSecs.value * 1,
      realtime: fldRealtime.value,
      pauseDelayInMSecs: fldPauseDelayInMSecs.value,
    };
    emit('onAccept', data);
};
</script>
<template>
      <v-dialog
        max-width="1200"
      >
        <template v-slot:activator="{ props: activatorProps }">
          <v-btn
            class="text-none"
            text="Generate..."
            color="primary"
            v-bind="activatorProps"
          ></v-btn>
        </template>
        <template v-slot:default="{ isActive }">
          <v-card
            prepend-icon="mdi-car-search-outline"
            title="Start generation"
          >
            <v-card-text class="pt-0">

              <v-row dense>
                <v-col
                  cols="12"
                  sm="6"
                >
                    <v-text-field type="number" label="Vehicle count" v-model="fldVehicleCount"></v-text-field>
                </v-col>
                <v-col
                  cols="12"
                  sm="6"
                >
                    <v-text-field type="number" label="Max number of events" v-model="fldMaxNumberOfEvents"></v-text-field>
                </v-col>
              </v-row>

              <v-row dense>
                <v-col
                  cols="12"
                  sm="6"
                >
                  <v-text-field type="number" label="Refresh interval (secs)" v-model="fldRefreshIntervalInSecs"></v-text-field>
              </v-col>
                <v-col
                  cols="12"
                  sm="6"
                >
                  <v-text-field type="number" label="Pause delay (ms)" v-model="fldPauseDelayInMSecs"></v-text-field>
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
                <v-checkbox label="Realtime" v-model="fldRealtime"></v-checkbox>
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