<script setup lang="ts">
import { onMounted, onUnmounted, inject } from 'vue';
import { type MessageBus } from '../utils/messaging';
import { MessagesViewModel } from './messages.vm';

useHead({
    title: 'Messages',
});


const appConfig = useAppConfig();
const logger = createLogger(appConfig.viewer.logging, 'viewer');

const messageBus = inject<MessageBus>('messageBus');
const _vm = new MessagesViewModel(messageBus, logger);
const _subscriptions = _vm.subscriptions;
const _handlers = _vm.handlers;
const isFetching = _vm.isFetching;
const tab = ref(0);

const subscriptionsHeaders = [
  { title: 'Subject', align: 'start', key: 'subject' },
  { title: 'Consumer Group', align: 'start', key: 'consumerGroupName' },
  { title: 'Services', align: 'start', key: 'services' },
];

const handlersHeaders = [
  { title: 'Handler Name', align: 'start', key: 'name' },
  { title: 'Message Types', align: 'start', key: 'messageTypes' },
  { title: 'Services', align: 'start', key: 'services' },
];

const breadcrumbs = [
  {
    title: 'Settings',
    disabled: false,
    href: '/settings',
  },
  {
    title: 'Messages',
    disabled: true,
    href: '/settings/messages',
  },
];

onMounted(() => {
  _vm.init().catch(console.error);
});

onUnmounted(() => {
  _vm.dispose().catch(console.error);
});    
</script>
<template>  
  <v-container>
    <v-breadcrumbs :items="breadcrumbs"></v-breadcrumbs>

    <v-tabs
      v-model="tab"
      align-tabs="center"
      color="primary"
    >
      <v-tab :value="1">Subscriptions</v-tab>
      <v-tab :value="2">Message handlers</v-tab>
      <v-tab :value="3">Message flow</v-tab>
    </v-tabs>      
    <v-tabs-window v-model="tab">
      <v-tabs-window-item :value="1">
        <v-container>
          <v-row>
            <v-data-table-virtual
                      class="mt-3"
                      :headers="subscriptionsHeaders"
                      :items="_subscriptions"
                      :loading="isFetching"
                      density="compact"
                      fixed-header
                  >
              <template v-slot:item.services="{ value }">
                {{ value.join(', ') }}
              </template>              

            </v-data-table-virtual>              
          </v-row>            
        </v-container>
      </v-tabs-window-item>

      <v-tabs-window-item :value="2">
        <v-container>
          <v-row>
            <v-data-table-virtual
                      class="mt-3"
                      :headers="handlersHeaders"
                      :items="_handlers"
                      :loading="isFetching"
                      density="compact"
                      fixed-header
                  >
              <template v-slot:item.services="{ value }">
                {{ value.join(', ') }}
              </template>              
              <template v-slot:item.messageTypes="{ value }">
                {{ value.join(', ') }}
              </template>              
            </v-data-table-virtual>
          </v-row>
        </v-container>

      </v-tabs-window-item>
    </v-tabs-window>

    <v-row>
      <v-btn
              class="text-none mt-8"
              text="Refresh"
              color="primary"
              prepend-icon="mdi-refresh" 
              v-on:click="_vm.refresh()"
              ></v-btn>

    </v-row>
  </v-container>
</template>

<style>
</style>