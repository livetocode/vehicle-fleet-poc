<script setup lang="ts">
import { formatNumber } from "core-lib";

const props = defineProps<{ partitions: any[]}>();
const emit = defineEmits<{
    (e: 'onClose'): void,
}>();
const headers = [
  // { title: 'Id', align: 'start', key: 'id' },
  { title: 'Key', align: 'start', key: 'partitionKey' },
  { title: 'Collector', align: 'end', key: 'collectorIndex' },
  { title: 'Events', align: 'end', key: 'eventCount'},
  { title: 'Data partitions', align: 'end', key: 'partitionCount' },
  { title: 'File Size', align: 'end', key: 'size' },
  { title: 'Process stats', align: 'end', key: 'processStats', sortable: false },
  { title: 'Elapsed time', align: 'end', key: 'elapsedTimeInMS' },
];
const sortBy = [
  { key: 'partitionKey', order: 'asc' },
  { key: 'collectorIndex', order: 'asc' },
  { key: 'eventCount', order: 'desc' },
];

const partitionsHeaders = [
  { title: 'Key', align: 'start', key: 'partitionKey' },
  { title: 'Events', align: 'end', key: 'itemCount' },
  { title: 'Format', align: 'start', key: 'format' },
  { title: 'File Size', align: 'end', key: 'size' },
  { title: 'Elapsed time', align: 'end', key: 'elapsedTimeInMS' },
];

function onAcceptDialog(isActive: Ref<boolean>) {
    isActive.value = false;
    emit('onClose');
};

function getPartitions() {
  const partitions = props.partitions.map((x, idx) => ({
  ...x,
  partitionCount: x.partitions.length,
  size: x.partitions.reduce((acc: number, curr: any) => acc + curr.size, 0),
}));
  return partitions;
}

const defaultHeaderProps = {
  style: 'font-weight: 600',
}

</script>
<template>
      <v-dialog
        max-width="1200"
      >
        <template v-slot:activator="{ props: activatorProps }">
          <v-btn
            class="text-none"
            text="View partitions..."
            color="primary"
            v-bind="activatorProps"
          ></v-btn>
        </template>
        <template v-slot:default="{ isActive }">
          <v-card>
            <v-card-title class="d-flex justify-space-between align-center">
                <div class="text-h5 text-medium-emphasis ps-2">
                  Partitions
                </div>

                <v-btn
                  icon="mdi-close"
                  variant="text"
                  @click="onAcceptDialog(isActive)"
                  ></v-btn>
            </v-card-title>            

            <v-card-text class="pt-0">
              <v-data-table-virtual
                :headerProps="defaultHeaderProps"
                :headers="headers"
                :items="getPartitions()"
                :sort-by="sortBy"
                height="600"
                item-value="id"
                fixed-header
                multi-sort
                show-expand
                density="compact"
              >
                <template v-slot:item.eventCount="{ value }">
                  {{ formatNumber(value).text }}
                </template>              
                <template v-slot:item.partitionCount="{ value }">
                  {{ value }}
                </template>              
                <template v-slot:item.size="{ value }">
                  {{ formatNumber(value, 'Bytes').text }}
                </template>              
                <template v-slot:item.processStats="{ value }">
                  {{ formatNumber(value.memory.heapUsed, 'Bytes').text }} / {{ formatNumber(value.loadAverage[0], '%').text }}
                </template>              
                <template v-slot:item.elapsedTimeInMS="{ value }">
                  {{ formatNumber(value, 'ms').text }}
                </template>
                <template v-slot:expanded-row="{ columns, item }">
                  <tr>
                    <td :colspan="columns.length" class="pl-10 pr-10 pt-3 pb-3">
                      <v-data-table-virtual 
                        height="300" 
                        density="compact" 
                        fixed-header 
                        :items="item.partitions" 
                        :headers="partitionsHeaders" 
                        item-value="url">
                        <template v-slot:item.itemCount="{ value }">
                          {{ formatNumber(value).text }}
                        </template>              
                        <template v-slot:item.size="{ value }">
                          {{ formatNumber(value, 'Bytes').text }}
                        </template>              
                        <template v-slot:item.elapsedTimeInMS="{ value }">
                          {{ formatNumber(value, 'ms').text }}
                        </template>
                      </v-data-table-virtual>
                    </td>
                  </tr>
                </template>                
              </v-data-table-virtual>
            </v-card-text>
          </v-card>
        </template>
      </v-dialog>      
</template>