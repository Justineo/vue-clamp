<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{
  modelValue: string;
  options: ReadonlyArray<{
    description?: string;
    id?: string;
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

const scrollRef = ref<HTMLElement | null>(null);
const canScrollStart = ref(false);
const canScrollEnd = ref(false);

let resizeObserver: ResizeObserver | null = null;
let stopFonts = () => {};

function syncOverflowState(): void {
  const element = scrollRef.value;
  if (!element) {
    canScrollStart.value = false;
    canScrollEnd.value = false;
    return;
  }

  const { clientWidth, scrollLeft, scrollWidth } = element;
  const hasOverflow = scrollWidth > clientWidth + 1;
  canScrollStart.value = hasOverflow && scrollLeft > 1;
  canScrollEnd.value = hasOverflow && scrollLeft + clientWidth < scrollWidth - 1;
}

function queueOverflowSync(): void {
  void nextTick().then(syncOverflowState);
}

watch([() => props.modelValue, () => props.options], queueOverflowSync, {
  deep: true,
  flush: "post",
});

onMounted(() => {
  const element = scrollRef.value;
  if (element) {
    resizeObserver = new ResizeObserver(syncOverflowState);
    resizeObserver.observe(element);
  }

  syncOverflowState();

  const fontFaceSet = document.fonts;
  if (!fontFaceSet) {
    return;
  }

  function handleFontLoad(): void {
    syncOverflowState();
  }

  void fontFaceSet.ready.then(handleFontLoad);
  fontFaceSet.addEventListener("loadingdone", handleFontLoad);
  stopFonts = () => {
    fontFaceSet.removeEventListener("loadingdone", handleFontLoad);
  };
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  stopFonts();
});
</script>

<template>
  <div
    class="component-tabs"
    :class="{
      'has-overflow-start': canScrollStart,
      'has-overflow-end': canScrollEnd,
    }"
    :aria-label="ariaLabel ?? 'Components'"
    role="group"
  >
    <div
      ref="scrollRef"
      class="component-tabs-scroll"
      data-component-tabs-scroll
      @scroll="syncOverflowState"
    >
      <div v-for="option in options" :key="option.value" class="component-tab-slot">
        <button
          :id="option.id"
          class="component-tab"
          :class="{ active: modelValue === option.value }"
          :data-surface-tab="option.value"
          type="button"
          :aria-pressed="modelValue === option.value"
          :aria-describedby="
            option.description ? `component-tab-tooltip-${option.value}` : undefined
          "
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
    <div
      v-if="canScrollEnd"
      class="component-tabs-more"
      data-component-tabs-more
      aria-hidden="true"
    >
      <span class="component-tabs-more-label">More</span>
      <span class="component-tabs-more-arrow">→</span>
    </div>
  </div>
</template>

<style scoped>
.component-tabs {
  position: relative;
  overflow: hidden;
  width: 100%;
  block-size: var(--component-tabs-height, 42px);
  border-bottom: 1px solid var(--c-border);
  background: var(--c-bg);
}

.component-tabs-scroll {
  display: flex;
  width: 100%;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  scroll-snap-type: x proximity;
  touch-action: pan-x pinch-zoom;
}

.component-tabs-scroll::-webkit-scrollbar {
  display: none;
}

.component-tab-slot {
  position: relative;
  flex: 1 0 9rem;
  min-width: 9rem;
  scroll-snap-align: start;
}

.component-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  max-width: 100%;
  padding: 0 18px;
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.component-tab:hover {
  color: var(--c-text);
  background: rgba(255, 255, 255, 0.32);
}

.component-tab:focus-visible {
  outline: none;
  color: var(--c-text);
  background: rgba(255, 255, 255, 0.32);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-accent) 18%, transparent);
  position: relative;
  z-index: 1;
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

.component-tabs::before,
.component-tabs::after {
  content: "";
  position: absolute;
  inset-block: 0;
  width: 26px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 1;
}

.component-tabs::before {
  inset-inline-start: 0;
  background: linear-gradient(to right, var(--c-bg), transparent);
}

.component-tabs::after {
  inset-inline-end: 0;
  background: linear-gradient(to left, var(--c-bg), transparent);
}

.component-tabs.has-overflow-start::before,
.component-tabs.has-overflow-end::after {
  opacity: 1;
}

.component-tabs-more {
  position: absolute;
  inset-inline-end: 8px;
  inset-block-start: 50%;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1;
  color: var(--c-text-3);
  background: color-mix(in srgb, var(--c-bg) 92%, transparent);
  border: 1px solid color-mix(in srgb, var(--c-border) 82%, transparent);
  border-radius: 999px;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--c-bg) 92%, transparent);
  transform: translateY(-50%);
  pointer-events: none;
  z-index: 2;
}

.component-tabs-more-arrow {
  font-family: var(--font-mono);
}

@media (max-width: 760px), (hover: none), (pointer: coarse) {
  .component-tooltip {
    display: none;
  }

  .component-tabs-more {
    inset-inline-end: 6px;
  }
}
</style>
