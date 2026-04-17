<script setup lang="ts">
defineProps<{
  name: string;
  title: string;
}>();
</script>

<template>
  <section class="alert" :data-alert="name" role="note">
    <p class="alert-title">{{ title }}</p>
    <div class="alert-copy">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.alert {
  position: relative;
  margin: 14px 0 0;
  padding: 12px 14px 12px 38px;
  background: #fff8ed;
  border-block: 1px solid #eadcc7;
}

.alert::before {
  content: "!";
  position: absolute;
  top: 13px;
  left: 14px;
  display: inline-grid;
  place-items: center;
  width: 16px;
  height: 16px;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1;
  color: #8a5a13;
  border: 1px solid #d6b577;
  border-radius: 50%;
}

.alert-title {
  margin: 0 0 6px;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.4;
  color: #6f4711;
}

.alert-copy {
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
