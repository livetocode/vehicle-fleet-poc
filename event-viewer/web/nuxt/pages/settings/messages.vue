<script setup lang="ts">
import { onMounted, onUnmounted, inject } from 'vue';
import { type MessageBus } from '../utils/messaging';
import { MessagesViewModel } from './messages.vm';
import { MdPreview } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';

useHead({
    title: 'Messages',
});


const appConfig = useAppConfig();
const logger = createLogger(appConfig.viewer.logging, 'viewer');

const messageBus = inject<MessageBus>('messageBus');
const _vm = new MessagesViewModel(messageBus, logger);
const _subscriptions = _vm.subscriptions;
const _handlers = _vm.handlers;
const _routes = _vm.routes;
const isFetching = _vm.isFetching;
const tab = ref(0);
const searchSubscriptions = ref('');
const searchHandlers = ref('');
const searchRoutes = ref('');

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

const routesHeaders = [
  { title: 'Sender', align: 'start', key: 'sender' },
  { title: 'Message Type', align: 'start', key: 'messageType' },
  { title: 'Subject', align: 'start', key: 'subject' },
  { title: 'Receiver', align: 'start', key: 'receiver' },
  { title: 'Subscription', align: 'start', key: 'subscription' },
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

const defaultHeaderProps = {
  style: 'font-weight: 600',
}

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
      <v-tab :value="3">Message routes</v-tab>
      <v-tab :value="4">Documentation</v-tab>
    </v-tabs>      
    <v-tabs-window v-model="tab">
      <v-tabs-window-item :value="1">
        <v-container>
          <v-row>
            <v-col cols="4">
              <v-text-field
                v-model="searchSubscriptions"
                label="Search"
                prepend-inner-icon="mdi-magnify"
                variant="solo"
                density="compact"
                hide-details
                single-line
                clearable
              ></v-text-field>              
            </v-col>
          </v-row>
          <v-row>
            <v-data-table-virtual
                      class="mt-3"
                      :headerProps="defaultHeaderProps"
                      :headers="subscriptionsHeaders"
                      :items="_subscriptions"
                      :loading="isFetching"
                      :search="searchSubscriptions"
                      item-value="id"
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
            <v-col cols="4">
              <v-text-field
                v-model="searchHandlers"
                label="Search"
                prepend-inner-icon="mdi-magnify"
                variant="solo"
                density="compact"
                hide-details
                single-line
                clearable
              ></v-text-field>              
            </v-col>
          </v-row>
          <v-row>
            <v-data-table-virtual
              class="mt-3"
              :headerProps="defaultHeaderProps"
              :headers="handlersHeaders"
              :items="_handlers"
              :loading="isFetching"
              :search="searchHandlers"
              item-value="id"
              density="compact"
              show-expand
              fixed-header
            >
              <template v-slot:item.services="{ value }">
                {{ value.join(', ') }}
              </template>              
              <template v-slot:item.messageTypes="{ value }">
                {{ value.join(', ') }}
              </template>              
              <template v-slot:expanded-row="{ columns, item }">
                <tr>
                  <td :colspan="columns.length" class="pl-10 pr-10 pt-3 pb-3">
                    {{ item.description }}
                  </td>
                </tr>
              </template>
            </v-data-table-virtual>
          </v-row>
        </v-container>

      </v-tabs-window-item>

      <v-tabs-window-item :value="3">
        <v-container>
          <v-row>
            <v-col cols="4">
              <v-text-field
                v-model="searchRoutes"
                label="Search"
                prepend-inner-icon="mdi-magnify"
                variant="solo"
                density="compact"
                hide-details
                single-line
                clearable
              ></v-text-field>              
            </v-col>
          </v-row>
          <v-row>
            <v-data-table-virtual
              class="mt-3"
              :headerProps="defaultHeaderProps"
              :headers="routesHeaders"
              :items="_routes"
              :loading="isFetching"
              :search="searchRoutes"
              item-value="id"
              density="compact"
              fixed-header
            >
            </v-data-table-virtual>
          </v-row>
        </v-container>

      </v-tabs-window-item>

      <v-tabs-window-item :value="4">
        <v-container>
          <v-row>
            <MdPreview :modelValue="_vm.docs.value" />
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
      <v-btn
        v-if="tab === 4"
        class="text-none mt-8 ml-4"
        text="Copy as Markdown"
        color="primary"
        prepend-icon="mdi-content-copy" 
        v-on:click="_vm.copy()"
        ></v-btn>
    </v-row>
  </v-container>
</template>

<style>
</style>