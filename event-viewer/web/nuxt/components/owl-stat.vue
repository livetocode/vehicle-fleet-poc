<script setup lang="ts">
import { formatNumber } from "core-lib";

const props = defineProps({
    stat: {
      type: Object,
      default: null,
    },
});

const formattedValue = computed(() => {
    const val = props.stat?.value;
    if (val === undefined || val === null) {
        return undefined;
    }
    return formatNumber(
        val,
        props.stat?.unitType,
        props.stat?.decimals,
        false // do not append unitType
    );
});

const formattedValues = computed(() => {
    const val = props.stat?.values;
    if (!Array.isArray(val)) {
        return [];
    }
    return val.map(x => ({
            ...formatNumber(
                x.value,
                props.stat?.unitType,
                props.stat?.decimals,
                false // do not append unitType
            ),
            title: x.title,
        })
    );
});
</script>
<template>
  <div>
    <owl-app-sheet
      :class="{
        'stat-content': true,
        'text-center': true,
      }"
    >
      <div>
        <div class="stat-unit grey--text text--darken-3">
          {{ props.stat?.unitPlural }}
        </div>
        <div v-if="formattedValue" class="stat-value">
          {{ formattedValue.text }}
          <span class="stat-unit-type">{{ formattedValue.units }}</span>
        </div>
        <div  v-if="formattedValues" class="d-flex mt-1">
            <div v-for="(val, i) in formattedValues" :key="i" class="stat-values-item">
                <div class="stat-values-item-title">{{val.title }}</div>
                <div>
                    {{ val.text }}
                    <span class="stat-unit-type">{{ val.units }}</span>
                </div>
            </div>
        </div>
        <v-chip-group v-if="props.stat?.flags">
          <v-chip v-for="(flag, idx) in props.stat.flags" :key="idx" size="x-small">{{flag}}</v-chip>
        </v-chip-group>
      </div>
    </owl-app-sheet>
  </div>
</template>
<style scoped>
.stat-content {
  padding: 8px;
}

.stat-value {
  font-size: 1.2em;
  margin-top: 6px;
}

.stat-values-item {
  font-size: 0.8em;
}

.stat-values-item:not(:first-child) {
    border-left: solid 1px rgb(174, 174, 174);
    margin-left: 10px;
    padding-left: 10px;
}

.stat-values-item-title {
    color: rgb(90, 90, 90);
    font-size: 0.8em;
}

.stat-unit {
  font-size: 0.8em;
}

.stat-unit-type {
  font-size: 0.8em;
}

</style>
