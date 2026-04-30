<script setup lang="ts">
type PillControlOption = {
  buttonAttrs?: Record<string, boolean | number | string | undefined>;
  label: string;
  value: string;
};

const props = withDefaults(
  defineProps<{
    ariaLabel?: string;
    buttonClass?: string;
    compact?: boolean;
    modelValue?: string | null;
    mono?: boolean;
    options: ReadonlyArray<PillControlOption>;
  }>(),
  {
    buttonClass: "",
    compact: false,
    modelValue: null,
    mono: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

function select(value: string): void {
  emit("update:modelValue", value);
}
</script>

<template>
  <div class="pill-controls" :class="{ compact, mono }" role="group" :aria-label="ariaLabel">
    <button
      v-for="option in options"
      :key="option.value"
      class="pill-controls-button"
      :class="[buttonClass, { active: modelValue === option.value }]"
      type="button"
      :aria-pressed="modelValue === option.value"
      v-bind="option.buttonAttrs"
      @click="select(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.pill-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pill-controls-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 54px;
  max-width: 100%;
  min-height: var(--control-height, 28px);
  padding: 0 10px;
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.1;
  font-family: var(--font-body);
  color: var(--c-text-2);
  background: var(--c-bg-soft);
  border: 1px solid var(--c-border);
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  transition:
    border-color 0.15s,
    background 0.15s,
    color 0.15s,
    box-shadow 0.15s;
}

.pill-controls-button:hover {
  border-color: var(--c-border-dark);
  color: var(--c-text);
  background: color-mix(in srgb, var(--c-bg-soft) 76%, var(--c-bg));
}

.pill-controls-button.active,
.pill-controls-button[aria-pressed="true"] {
  color: var(--c-accent-text);
  background: var(--c-accent-soft);
  border-color: color-mix(in srgb, var(--c-accent) 52%, var(--c-border));
}

.pill-controls-button:focus-visible {
  outline: none;
  color: var(--c-accent-text);
  border-color: var(--c-accent);
  box-shadow: var(--focus-ring);
}

.pill-controls.compact .pill-controls-button {
  min-width: 48px;
  min-height: 24px;
  padding: 0 9px;
  font-size: 0.7rem;
}

.pill-controls.mono .pill-controls-button {
  font-family: var(--font-mono);
}
</style>
