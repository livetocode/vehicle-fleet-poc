<script setup lang="ts">
import { onMounted, onUnmounted, inject } from 'vue';
import { type MessageBus } from '../utils/messaging';
import { ServicesViewModel } from './services.vm';

useHead({
    title: 'Services',
});


const appConfig = useAppConfig();
const logger = createLogger(appConfig.viewer.logging, 'viewer');

const messageBus = inject<MessageBus>('messageBus');
const _vm = new ServicesViewModel(messageBus, logger);
const _services = _vm.services;
const isFetching = _vm.isFetching;

const headers = [
  // { title: 'Id', align: 'start', key: 'id' },
  { title: 'Name', align: 'start', key: 'name' },
  { title: 'Instances', align: 'end', key: 'instances' },
];
const sortBy = [
  { key: 'name', order: 'asc' },
];
const breadcrumbs = [
  {
    title: 'Settings',
    disabled: false,
    href: '/settings',
  },
  {
    title: 'Services',
    disabled: true,
    href: '/settings/services',
  },
];

const defaultHeaderProps = {
  style: 'font-weight: 600',
}

onMounted(() => {
  _vm.init().catch(console.error);
});

onUnmounted(() => {
  _vm.dispose().catch(console.error);
});    
</script>
<template>
  <v-container>
    <v-breadcrumbs :items="breadcrumbs">
    </v-breadcrumbs>
    <v-row>
        <v-col cols="6">
            <v-data-table-virtual
                        :headerProps="defaultHeaderProps"
                        :headers="headers"
                        :items="_services"
                        :sort-by="sortBy"
                        :loading="isFetching"
                        fixed-header
                    >
            </v-data-table-virtual>
            <v-btn
                class="text-none mt-6"
                text="Refresh"
                color="primary"
                prepend-icon="mdi-refresh" 
                v-on:click="_vm.refresh()"
                ></v-btn>

        </v-col>
        <v-col cols="6">

        </v-col>
    </v-row>
  </v-container>
</template>

<style>
</style>