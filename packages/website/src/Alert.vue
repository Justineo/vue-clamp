<script setup lang="ts">
import { CircleAlert, Info } from "@lucide/vue";

const { tone = "warn" } = defineProps<{
  name: string;
  title: string;
  tone?: "info" | "warn";
}>();
</script>

<template>
  <section
    class="alert"
    :class="`alert-${tone}`"
    :data-alert="name"
    :data-alert-tone="tone"
    role="note"
  >
    <Info v-if="tone === 'info'" class="alert-icon" :size="18" aria-hidden="true" />
    <CircleAlert v-else class="alert-icon" :size="18" aria-hidden="true" />
    <p class="alert-title">{{ title }}</p>
    <div class="alert-copy">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.alert {
  --alert-bg: #fff8ed;
  --alert-border: #eadcc7;
  --alert-copy: color-mix(in srgb, #6f4711 48%, var(--c-text));
  --alert-icon: #8a5a13;
  --alert-marker: #9f6a1c;
  --alert-title: #6f4711;

  margin: 14px 0 0;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  column-gap: 10px;
  row-gap: 6px;
  padding: 12px 14px;
  background: var(--alert-bg);
  border: 1px solid var(--alert-border);
  border-radius: var(--radius);
}

.alert-info {
  --alert-bg: color-mix(in srgb, var(--c-accent-soft) 64%, var(--c-bg));
  --alert-border: color-mix(in srgb, var(--c-accent) 24%, var(--c-border));
  --alert-copy: color-mix(in srgb, var(--c-accent-text) 34%, var(--c-text));
  --alert-icon: var(--c-accent);
  --alert-marker: var(--c-accent);
  --alert-title: var(--c-accent-text);
}

.alert-icon {
  grid-row: 1;
  align-self: center;
  width: 18px;
  height: 18px;
  color: var(--alert-icon);
  stroke-width: 2.4;
}

.alert-warn .alert-icon :deep(circle) {
  fill: currentColor;
}

.alert-warn .alert-icon :deep(line) {
  stroke: var(--alert-bg);
}

.alert-title {
  grid-column: 2;
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--alert-title);
}

.alert-copy {
  grid-column: 2;
  margin: 0;
  max-width: 58rem;
  font-size: 0.82rem;
  line-height: 1.6;
  color: var(--alert-copy);
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
  color: var(--alert-marker);
}

.alert-copy :deep(code) {
  font-size: 0.85em;
}
</style>
