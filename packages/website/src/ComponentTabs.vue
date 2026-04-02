<script setup lang="ts">
defineProps<{
  modelValue: string;
  options: ReadonlyArray<{
    description?: string;
    label: string;
    value: string;
  }>;
  ariaLabel?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

function select(value: string): void {
  emit("update:modelValue", value);
}
</script>

<template>
  <div class="component-tabs" :aria-label="ariaLabel ?? 'Components'" role="group">
    <div v-for="option in options" :key="option.value" class="component-tab-slot">
      <button
        class="component-tab"
        :class="{ active: modelValue === option.value }"
        :data-surface-tab="option.value"
        type="button"
        :aria-pressed="modelValue === option.value"
        :aria-describedby="option.description ? `component-tab-tooltip-${option.value}` : undefined"
        @click="select(option.value)"
      >
        {{ option.label }}
      </button>
      <span
        v-if="option.description"
        :id="`component-tab-tooltip-${option.value}`"
        :data-surface-tooltip="option.value"
        class="component-tooltip"
        role="tooltip"
      >
        {{ option.description }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.component-tabs {
  display: flex;
  width: 100%;
  border-top: 1px solid var(--c-border);
  border-bottom: 1px solid var(--c-border);
  background: var(--c-bg-soft);
}

.component-tab-slot {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
}

.component-tab-slot + .component-tab-slot {
  box-shadow: inset 1px 0 0 var(--c-border);
}

.component-tab {
  width: 100%;
  padding: 13px 18px 12px;
  font-size: 0.82rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--c-text-3);
  background: transparent;
  border: none;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.component-tab:hover {
  color: var(--c-text);
  background: rgba(255, 255, 255, 0.32);
}

.component-tab.active {
  color: var(--c-text);
  background: var(--c-bg);
  box-shadow:
    inset 0 -2px 0 var(--c-accent),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.component-tooltip {
  position: absolute;
  inset-inline-start: 50%;
  inset-block-end: calc(100% + 10px);
  max-inline-size: min(18rem, calc(100vw - 32px));
  padding: 7px 10px;
  font-size: 0.72rem;
  line-height: 1.45;
  color: var(--c-bg);
  background: rgba(29, 30, 34, 0.94);
  border-radius: 7px;
  box-shadow: 0 10px 24px rgba(18, 20, 28, 0.16);
  transform: translate(-50%, 4px);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  white-space: normal;
  text-align: center;
  z-index: 2;
  transition:
    opacity 0.15s,
    transform 0.15s,
    visibility 0s linear 0.15s;
}

.component-tab-slot:hover .component-tooltip,
.component-tab:focus-visible + .component-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translate(-50%, 0);
  transition-delay: 0s;
}

@supports (anchor-name: --component-tab) and (position-anchor: --component-tab) and
  (position-area: top center) {
  .component-tab-slot {
    anchor-scope: --component-tab;
  }

  .component-tab {
    anchor-name: --component-tab;
  }

  .component-tooltip {
    position: fixed;
    inset: auto;
    position-anchor: --component-tab;
    position-area: top;
    position-try-fallbacks: flip-block;
    position-try-order: most-height;
    justify-self: anchor-center;
    margin: 0;
    margin-block: 10px;
    transform: none;
  }

  .component-tab-slot:hover .component-tooltip,
  .component-tab:focus-visible + .component-tooltip {
    transform: none;
  }
}
</style>
