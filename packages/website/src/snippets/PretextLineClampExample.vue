<script setup lang="ts">
import { LineClamp } from "vue-clamp/pretext";

const text =
  "Frequently resized summaries can opt into predictive word-boundary clamping without changing the LineClamp API.";
</script>

<template>
  <LineClamp :text="text" :max-lines="2" boundary="word" />
</template>
