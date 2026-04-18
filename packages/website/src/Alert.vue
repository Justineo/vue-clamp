<script setup lang="ts">
import { CircleAlert } from "@lucide/vue";

defineProps<{
  name: string;
  title: string;
}>();
</script>

<template>
  <section class="alert" :data-alert="name" role="note">
    <CircleAlert class="alert-icon" :size="18" aria-hidden="true" />
    <p class="alert-title">{{ title }}</p>
    <div class="alert-copy">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.alert {
  margin: 14px 0 0;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  column-gap: 10px;
  row-gap: 6px;
  padding: 12px 14px;
  background: #fff8ed;
  border: 1px solid #eadcc7;
  border-radius: var(--radius);
}

.alert-icon {
  grid-row: 1;
  align-self: center;
  width: 18px;
  height: 18px;
  color: #8a5a13;
  stroke-width: 2.4;
}

.alert-icon :deep(circle) {
  fill: currentColor;
}

.alert-icon :deep(line) {
  stroke: #fff8ed;
}

.alert-title {
  grid-column: 2;
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.4;
  color: #6f4711;
}

.alert-copy {
  grid-column: 2;
  margin: 0;
  max-width: 58rem;
  font-size: 0.82rem;
  line-height: 1.6;
  color: color-mix(in srgb, #6f4711 48%, var(--c-text));
}

.alert-copy :deep(p) {
  margin: 0;
}

.alert-copy :deep(ul) {
  display: grid;
  gap: 5px;
  margin: 0;
  padding-left: 1.15rem;
}

.alert-copy :deep(li) {
  padding-left: 0.1rem;
}

.alert-copy :deep(li::marker) {
  color: #9f6a1c;
}

.alert-copy :deep(code) {
  font-size: 0.85em;
}
</style>
