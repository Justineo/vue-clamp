<script setup lang="ts">
import { ref } from "vue";
import { LineClamp } from "vue-clamp";

const expanded = ref(false);
const text = "Ship review-ready notes with browser-fit text truncation and keep the toggle inline.";
</script>

<template>
  <LineClamp v-model:expanded="expanded" :text="text" :max-lines="2" boundary="word">
    <template #after="{ clamped, toggle }">
      <button v-if="clamped" type="button" @click="toggle">
        {{ expanded ? "Less" : "More" }}
      </button>
    </template>
  </LineClamp>
</template>
