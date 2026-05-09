<script setup lang="ts">
import { ref } from "vue";
import { RichLineClamp } from "vue-clamp";

const expanded = ref(false);
const html =
  '<small class="rich-meta">Feature essay · Apr 8</small><br>Read <a href="/docs">how the <strong>component tabs</strong> now stay scrollable on small screens</a> while the <mark>article excerpt</mark> keeps its inline emphasis.';
</script>

<template>
  <RichLineClamp v-model:expanded="expanded" :html="html" :max-lines="2" boundary="word">
    <template #after="{ clamped, toggle }">
      <button v-if="clamped" type="button" @click="toggle">
        {{ expanded ? "Less" : "More" }}
      </button>
    </template>
  </RichLineClamp>
</template>
