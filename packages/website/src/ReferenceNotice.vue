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
  margin: 12px 0 0;
  padding-top: 12px;
  border-top: 1px solid var(--c-border);
}

.reference-notice-title {
  margin: 0 0 6px;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--c-text);
}

.reference-notice-copy {
  margin: 0;
  max-width: 58rem;
  font-size: 0.82rem;
  line-height: 1.6;
  color: var(--c-text-2);
}

.reference-notice-copy :deep(p) {
  margin: 0;
}

.reference-notice-copy :deep(ul) {
  display: grid;
  gap: 5px;
  margin: 0;
  padding-left: 1.15rem;
}

.reference-notice-copy :deep(li) {
  padding-left: 0.1rem;
}

.reference-notice-copy :deep(li::marker) {
  color: var(--c-text-3);
}

.reference-notice-copy :deep(code) {
  font-size: 0.85em;
}
</style>
