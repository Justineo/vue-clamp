<script setup lang="ts">
defineProps<{
  surface: string;
  title: string;
}>();
</script>

<template>
  <section class="reference-notice" :data-reference-notice="surface" role="note">
    <p class="reference-notice-title">{{ title }}</p>
    <div class="reference-notice-copy">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.reference-notice {
  margin: -4px 0 20px;
  padding: 12px 14px;
  border: 1px solid var(--c-border);
  border-left: 3px solid var(--c-accent);
  border-radius: var(--radius);
  background: var(--c-bg-soft);
}

.reference-notice-title {
  margin: 0 0 4px;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.4;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--c-accent-text);
}

.reference-notice-copy {
  display: grid;
  gap: 6px;
  margin: 0;
  max-width: 58rem;
  font-size: 0.82rem;
  line-height: 1.6;
  color: var(--c-text-2);
}

.reference-notice-copy :deep(p) {
  margin: 0;
}

.reference-notice-copy :deep(code) {
  font-size: 0.85em;
}
</style>
