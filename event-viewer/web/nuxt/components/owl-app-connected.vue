<script setup lang="ts">
import { inject, ref, onMounted, onUnmounted } from 'vue';
import { type MessageBus, type ConnectionInfo, type EventCallback } from 'core-lib';

const messageBus = inject<MessageBus>('messageBus');
if (!messageBus) {
  throw new Error('Expected to receive a MessageBus!');
}
const connectionString = inject<string>('connectionString');
if (!connectionString) {
  throw new Error('Expected to receive a connectionString!');
}

const connectionStatus = ref(messageBus?.connectionInfo?.status);
const isConnected = ref(false);
const connectionError = ref();
const connectionInfoChanged: EventCallback = (info: ConnectionInfo) => {
    connectionStatus.value = info.status;
    connectionError.value = info.connectionError;
    isConnected.value = info.status === 'connected';
};
const start = () => messageBus.start(connectionString).catch(console.error);

onMounted(() => {
  messageBus.on('connectionInfoChanged', connectionInfoChanged);
});

onUnmounted(() => {
  messageBus.off('connectionInfoChanged', connectionInfoChanged);
});

</script>

<template>
  <div>
    <div v-if="isConnected">
      <slot />
    </div>
    <div v-else>
      <p>Status: {{ connectionStatus }}</p>
      <div v-if="connectionError">
        <p>Error: {{ connectionError.message }}</p>
        <p>
          <v-btn
            class="text-none mt-8"
            text="Retry"
            color="primary"
            prepend-icon="mdi-refresh" 
            v-on:click="start()"
            ></v-btn>
        </p>
      </div>      
    </div>
  </div>
</template>
