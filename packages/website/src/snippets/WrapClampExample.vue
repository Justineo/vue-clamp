<script setup lang="ts">
import { ref } from "vue";
import { WrapClamp } from "vue-clamp";

const expanded = ref(false);
const labels = [
  { id: "perf", label: "Performance" },
  { id: "a11y", label: "Accessibility" },
  { id: "docs", label: "Docs" },
  { id: "qa", label: "Needs QA" },
];
</script>

<template>
  <WrapClamp v-model:expanded="expanded" :items="labels" item-key="id" :max-lines="2">
    <template #item="{ item }">
      <span class="tag">{{ item.label }}</span>
    </template>
    <template #after="{ expanded, clamped, hiddenItems, toggle }">
      <button v-if="expanded || clamped" type="button" @click="toggle">
        {{ expanded ? "Less" : `+${hiddenItems.length} more` }}
      </button>
    </template>
  </WrapClamp>
</template>
