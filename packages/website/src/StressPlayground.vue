<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { X } from "@lucide/vue";
import { InlineClamp, LineClamp, RichLineClamp, WrapClamp } from "vue-clamp";
import FpsMeter from "./FpsMeter.vue";
import { overlayScrollbarsDirective, verticalOverlayScrollbarsOptions } from "./overlayScrollbars";

type StressSurface = "line" | "rich" | "inline" | "wrap";
type StressLimitKind = "height" | "lines";
type NativeClampStatus = {
  feature: string;
  mode: "single-line" | "multi-line";
};

type StressWrapItem = {
  id: string;
  label: string;
};

type StressItem = {
  html: string;
  id: number;
  inlineText: string;
  limitKind: StressLimitKind | "inline";
  text: string;
  wrapItems: StressWrapItem[];
};

const props = withDefaults(
  defineProps<{
    initialSurface?: StressSurface;
  }>(),
  {
    initialSurface: "line",
  },
);

const emit = defineEmits<{
  close: [];
}>();

const vOverlayScrollbars = overlayScrollbarsDirective;
const verticalOverlayScrollbars = verticalOverlayScrollbarsOptions;
const closeButtonRef = ref<HTMLButtonElement | null>(null);
const dialogRef = ref<HTMLElement | null>(null);
const selectedSurface = ref<StressSurface>(props.initialSurface);
const componentCountExponent = ref(1);
const sharedWidth = ref(360);
const workloadScale = ref(3);
const limitKind = ref<StressLimitKind>("lines");
const maxLines = ref(3);
const maxHeight = ref(96);

type ScrollLockSnapshot = {
  bodyLeft: string;
  bodyOverflow: string;
  bodyPosition: string;
  bodyRight: string;
  bodyTop: string;
  bodyWidth: string;
  htmlOverflow: string;
  scrollX: number;
  scrollY: number;
};

let scrollLockSnapshot: ScrollLockSnapshot | null = null;

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const surfaceOptions = [
  { label: "LineClamp", value: "line" },
  { label: "RichLineClamp", value: "rich" },
  { label: "InlineClamp", value: "inline" },
  { label: "WrapClamp", value: "wrap" },
] satisfies { label: string; value: StressSurface }[];

const limitKindOptions = [
  { label: "Lines", value: "lines" },
  { label: "Height", value: "height" },
] satisfies { label: string; value: StressLimitKind }[];

const sampleTexts = [
  "Vue Clamp keeps dense application text readable while preserving the full source text for assistive technology.",
  "Resize the shared width to force every instance through the same layout change and watch the FPS meter while the browser settles.",
  "Switch the active limit mode to exercise line-count or height-based clamping under synchronized layout changes.",
  "A long localized sentence with punctuation, inline separators, and repeated words makes boundary decisions visible during resize.",
  "Manual stress runs are useful for spotting jank that aggregate summaries can miss when many components update together.",
  "The same payload is repeated across many component instances to make paint, layout, and clamp work easier to observe.",
  "Controls intentionally update every rendered example at once, matching the way dense product screens often resize.",
  "The stress playground favors fast iteration and visible feedback while many instances update together.",
];

const wrapLabels = [
  "Design",
  "Docs",
  "Runtime",
  "Testing",
  "Accessibility",
  "SSR",
  "Hydration",
  "Resize",
  "Telemetry",
  "Release",
  "Content",
  "I18n",
  "Search",
  "Navigation",
  "Changelog",
  "Review",
];

watch(
  () => props.initialSurface,
  (surface) => {
    selectedSurface.value = surface;
  },
);

const componentCount = computed(() =>
  Math.min(1000, Math.max(10, Math.round(10 ** componentCountExponent.value))),
);

const selectedSurfaceLabel = computed(
  () => surfaceOptions.find((option) => option.value === selectedSurface.value)?.label ?? "",
);

const textRepeatCount = computed(() => workloadScale.value);
const wrapItemCount = computed(() => workloadScale.value * 8);
const workloadDescription = computed(() =>
  selectedSurface.value === "wrap"
    ? `${wrapItemCount.value} items`
    : `${textRepeatCount.value}x text`,
);
const hasLimitControls = computed(() => selectedSurface.value !== "inline");
const nativeClampStatus = computed<NativeClampStatus | null>(() => {
  if (selectedSurface.value !== "line" || limitKind.value !== "lines") {
    return null;
  }

  if (maxLines.value === 1) {
    return {
      feature: "text-overflow",
      mode: "single-line",
    };
  }

  if (maxLines.value > 1 && supportsNativeLineClamp()) {
    return {
      feature: "line-clamp",
      mode: "multi-line",
    };
  }

  return null;
});

const stressItems = computed<StressItem[]>(() =>
  Array.from({ length: componentCount.value }, (_, index) => stressItemFor(index)),
);

const sharedWidthStyle = computed(() => ({
  "--stress-width": `${sharedWidth.value}px`,
}));

function stressItemFor(index: number): StressItem {
  const surface = selectedSurface.value;
  const item: StressItem = {
    html: "",
    id: index,
    inlineText: "",
    limitKind: surface === "inline" ? "inline" : limitKind.value,
    text: "",
    wrapItems: [],
  };

  switch (surface) {
    case "rich":
      item.html = richHtmlFor(index);
      break;
    case "inline":
      item.inlineText = inlineTextFor(index);
      break;
    case "wrap":
      item.wrapItems = wrapItemsFor(index);
      break;
    default:
      item.text = textFor(index);
  }

  return item;
}

function textFor(index: number): string {
  const segments: string[] = [];

  for (let offset = 0; offset < textRepeatCount.value; offset += 1) {
    segments.push(sampleTexts[(index + offset) % sampleTexts.length]!);
  }

  return `${index + 1}. ${segments.join(" ")}`;
}

function richHtmlFor(index: number): string {
  const segments: string[] = [];

  for (let offset = 0; offset < textRepeatCount.value; offset += 1) {
    const text = sampleTexts[(index + offset) % sampleTexts.length]!;
    const label = wrapLabels[(index + offset) % wrapLabels.length]!;
    segments.push(
      `<strong>${label}</strong> ${text} <em>Measured inline flow</em> keeps <code>code</code>, <a href="#components">links</a>, and marked fragments in one trusted HTML payload.`,
    );
  }

  return `${index + 1}. ${segments.join(" ")}`;
}

function inlineTextFor(index: number): string {
  const parts: string[] = [];

  for (let offset = 0; offset < textRepeatCount.value; offset += 1) {
    const label = wrapLabels[(index + offset) % wrapLabels.length]!.toLowerCase();
    parts.push(`${label}/component-${index + 1}-${offset + 1}.vue`);
  }

  return `/workspace/vue-clamp/${parts.join("/")}#${sampleTexts[index % sampleTexts.length]}`;
}

function wrapItemsFor(index: number): StressWrapItem[] {
  return Array.from({ length: wrapItemCount.value }, (_, itemIndex) => {
    const label = wrapLabels[(index + itemIndex) % wrapLabels.length]!;

    return {
      id: `${index}-${itemIndex}`,
      label: `${label} ${itemIndex + 1}`,
    };
  });
}

function supportsNativeLineClamp(): boolean {
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
    return false;
  }

  return CSS.supports("-webkit-line-clamp", "2") || CSS.supports("line-clamp", "2");
}

function close(): void {
  emit("close");
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
    return;
  }

  if (event.key !== "Tab") {
    return;
  }

  const dialog = dialogRef.value;
  if (!dialog) {
    return;
  }

  const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
  const firstElement = focusableElements[0] ?? closeButtonRef.value;
  const lastElement = focusableElements.at(-1) ?? firstElement;
  const activeElement = document.activeElement;

  if (!firstElement || !lastElement) {
    event.preventDefault();
    return;
  }

  if (!dialog.contains(activeElement)) {
    event.preventDefault();
    firstElement.focus();
    return;
  }

  if (event.shiftKey && activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
    return;
  }

  if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

function lockPageScroll(): void {
  if (scrollLockSnapshot) {
    return;
  }

  const { body, documentElement } = document;
  scrollLockSnapshot = {
    bodyLeft: body.style.left,
    bodyOverflow: body.style.overflow,
    bodyPosition: body.style.position,
    bodyRight: body.style.right,
    bodyTop: body.style.top,
    bodyWidth: body.style.width,
    htmlOverflow: documentElement.style.overflow,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  };

  documentElement.style.overflow = "hidden";
  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${scrollLockSnapshot.scrollY}px`;
  body.style.left = `-${scrollLockSnapshot.scrollX}px`;
  body.style.right = "0";
  body.style.width = "100%";
}

function unlockPageScroll(): void {
  if (!scrollLockSnapshot) {
    return;
  }

  const { body, documentElement } = document;
  const { scrollX, scrollY } = scrollLockSnapshot;

  documentElement.style.overflow = scrollLockSnapshot.htmlOverflow;
  body.style.overflow = scrollLockSnapshot.bodyOverflow;
  body.style.position = scrollLockSnapshot.bodyPosition;
  body.style.top = scrollLockSnapshot.bodyTop;
  body.style.left = scrollLockSnapshot.bodyLeft;
  body.style.right = scrollLockSnapshot.bodyRight;
  body.style.width = scrollLockSnapshot.bodyWidth;
  scrollLockSnapshot = null;

  window.scrollTo(scrollX, scrollY);
}

onMounted(() => {
  lockPageScroll();
  window.addEventListener("keydown", handleKeydown);
  closeButtonRef.value?.focus();
});

onBeforeUnmount(() => {
  unlockPageScroll();
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div class="stress-overlay" data-stress-playground role="presentation" @click.self="close">
      <section
        ref="dialogRef"
        class="stress-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stress-playground-title"
      >
        <div
          v-overlay-scrollbars="verticalOverlayScrollbars"
          class="stress-modal-scroll"
          data-stress-modal-scroll
        >
          <header class="stress-header">
            <div class="stress-title-group">
              <div class="stress-title-row">
                <h3 id="stress-playground-title">Stress playground</h3>
                <span
                  v-if="nativeClampStatus"
                  class="stress-native-marker"
                  data-stress-native-status
                  :data-stress-native-mode="nativeClampStatus.mode"
                  :aria-label="`Native CSS ${nativeClampStatus.feature}`"
                  :title="`Native CSS ${nativeClampStatus.feature}`"
                >
                  Native
                </span>
              </div>
              <p>
                {{ selectedSurfaceLabel }} · {{ componentCount }} components ·
                {{ workloadDescription }} · {{ sharedWidth }}px shared width
              </p>
            </div>
            <div class="stress-header-tools">
              <div class="stress-meter">
                <span class="stress-meter-label">Live</span>
                <FpsMeter class="stress-fps" />
              </div>
              <button
                ref="closeButtonRef"
                class="stress-close"
                data-stress-close
                type="button"
                aria-label="Close stress playground"
                @click="close"
              >
                <X :size="18" :stroke-width="2" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div class="stress-controls">
            <div class="stress-control stress-surface-control">
              <span class="stress-control-label">Component</span>
              <span class="stress-surface-options" role="group" aria-label="Stress component">
                <button
                  v-for="option in surfaceOptions"
                  :key="option.value"
                  class="stress-surface-option"
                  :class="{ active: selectedSurface === option.value }"
                  :data-stress-surface="option.value"
                  type="button"
                  :aria-pressed="selectedSurface === option.value"
                  @click="selectedSurface = option.value"
                >
                  {{ option.label }}
                </button>
              </span>
            </div>

            <label class="stress-control">
              <span class="stress-control-label">Components</span>
              <span class="stress-control-row">
                <input
                  v-model.number="componentCountExponent"
                  data-stress-count-slider
                  class="stress-range"
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                />
                <span class="stress-value" data-stress-count>{{ componentCount }}</span>
              </span>
            </label>

            <label class="stress-control">
              <span class="stress-control-label">Width</span>
              <span class="stress-control-row">
                <input
                  v-model.number="sharedWidth"
                  data-stress-width-slider
                  class="stress-range"
                  type="range"
                  min="180"
                  max="720"
                  step="4"
                />
                <span class="stress-value" data-stress-width>{{ sharedWidth }}px</span>
              </span>
            </label>

            <label class="stress-control">
              <span class="stress-control-label">{{
                selectedSurface === "wrap" ? "Item count" : "Text length"
              }}</span>
              <span class="stress-control-row">
                <input
                  v-model.number="workloadScale"
                  data-stress-payload-slider
                  class="stress-range"
                  type="range"
                  min="1"
                  max="8"
                  step="1"
                />
                <span class="stress-value" data-stress-payload>{{ workloadDescription }}</span>
              </span>
            </label>

            <div v-if="hasLimitControls" class="stress-control">
              <span class="stress-control-label">Limit</span>
              <span class="stress-surface-options" role="group" aria-label="Stress limit mode">
                <button
                  v-for="option in limitKindOptions"
                  :key="option.value"
                  class="stress-surface-option"
                  :class="{ active: limitKind === option.value }"
                  :data-stress-limit-mode="option.value"
                  type="button"
                  :aria-pressed="limitKind === option.value"
                  @click="limitKind = option.value"
                >
                  {{ option.label }}
                </button>
              </span>
            </div>

            <label v-if="hasLimitControls && limitKind === 'lines'" class="stress-control">
              <span class="stress-control-label">Max lines</span>
              <span class="stress-control-row">
                <input
                  v-model.number="maxLines"
                  data-stress-max-lines-slider
                  class="stress-range"
                  type="range"
                  min="1"
                  max="8"
                  step="1"
                />
                <span class="stress-value" data-stress-max-lines>{{ maxLines }}</span>
              </span>
            </label>

            <label v-if="hasLimitControls && limitKind === 'height'" class="stress-control">
              <span class="stress-control-label">Max height</span>
              <span class="stress-control-row">
                <input
                  v-model.number="maxHeight"
                  data-stress-max-height-slider
                  class="stress-range"
                  type="range"
                  min="24"
                  max="220"
                  step="4"
                />
                <span class="stress-value" data-stress-max-height>{{ maxHeight }}px</span>
              </span>
            </label>
          </div>

          <div
            v-overlay-scrollbars="verticalOverlayScrollbars"
            class="stress-workload"
            data-stress-workload
            :style="sharedWidthStyle"
          >
            <div class="stress-list">
              <article
                v-for="item in stressItems"
                :key="`${selectedSurface}-${item.id}`"
                class="stress-item"
                :data-stress-item="item.limitKind"
                :data-stress-surface-item="selectedSurface"
              >
                <span class="stress-item-meta">
                  {{ selectedSurfaceLabel }} · {{ item.limitKind }}
                </span>

                <template v-if="selectedSurface === 'line'">
                  <LineClamp
                    v-if="item.limitKind === 'lines'"
                    class="stress-clamp"
                    :text="item.text"
                    :max-lines="maxLines"
                  />
                  <LineClamp
                    v-else
                    class="stress-clamp"
                    :text="item.text"
                    :max-height="maxHeight"
                  />
                </template>

                <template v-else-if="selectedSurface === 'rich'">
                  <RichLineClamp
                    v-if="item.limitKind === 'lines'"
                    class="stress-clamp stress-rich"
                    :html="item.html"
                    :max-lines="maxLines"
                  />
                  <RichLineClamp
                    v-else
                    class="stress-clamp stress-rich"
                    :html="item.html"
                    :max-height="maxHeight"
                  />
                </template>

                <InlineClamp
                  v-else-if="selectedSurface === 'inline'"
                  class="stress-clamp stress-inline"
                  :text="item.inlineText"
                  location="middle"
                />

                <template v-else>
                  <WrapClamp
                    v-if="item.limitKind === 'lines'"
                    class="stress-clamp stress-wrap"
                    :items="item.wrapItems"
                    item-key="id"
                    :max-lines="maxLines"
                  >
                    <template #item="{ item: wrapItem }">
                      <span class="stress-token">{{ wrapItem.label }}</span>
                    </template>
                    <template #after="{ hiddenItems }">
                      <span class="stress-token stress-token-summary">
                        +{{ hiddenItems.length }}
                      </span>
                    </template>
                  </WrapClamp>
                  <WrapClamp
                    v-else
                    class="stress-clamp stress-wrap"
                    :items="item.wrapItems"
                    item-key="id"
                    :max-height="maxHeight"
                  >
                    <template #item="{ item: wrapItem }">
                      <span class="stress-token">{{ wrapItem.label }}</span>
                    </template>
                    <template #after="{ hiddenItems }">
                      <span class="stress-token stress-token-summary">
                        +{{ hiddenItems.length }}
                      </span>
                    </template>
                  </WrapClamp>
                </template>
              </article>
            </div>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.stress-overlay {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22px;
  background: color-mix(in srgb, #020617 42%, transparent);
  backdrop-filter: blur(12px);
}

.stress-dialog {
  --stress-dialog-block-size: calc(100svh - 44px);

  overflow: hidden;
  inline-size: min(1120px, 100%);
  block-size: var(--stress-dialog-block-size);
  background: var(--c-bg);
  border: 1px solid color-mix(in srgb, var(--c-border) 84%, transparent);
  border-radius: 14px;
  box-shadow: 0 28px 80px color-mix(in srgb, #020617 28%, transparent);
}

.stress-modal-scroll {
  block-size: 100%;
  overflow: auto;
}

.stress-modal-scroll :deep([data-overlayscrollbars-viewport]) {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  block-size: 100%;
  overscroll-behavior: contain;
}

.stress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 14px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--c-border) 82%, transparent);
}

.stress-title-group {
  min-width: 0;
}

.stress-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.stress-title-group h3 {
  margin: 0;
  font-size: 1rem;
  line-height: 1.3;
  letter-spacing: 0;
}

.stress-title-group p {
  margin: 2px 0 0;
  font-size: 0.78rem;
  color: var(--c-text-3);
}

.stress-header-tools {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stress-meter {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  background: color-mix(in srgb, var(--c-bg-soft) 72%, transparent);
  border: 1px solid color-mix(in srgb, var(--c-border) 82%, transparent);
  border-radius: 9px;
}

.stress-meter-label {
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1;
  color: var(--c-text-3);
  text-transform: uppercase;
  letter-spacing: 0;
}

.stress-fps {
  flex: 0 0 auto;
}

.stress-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 34px;
  inline-size: 34px;
  block-size: 34px;
  color: var(--c-text-2);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;
}

.stress-close:hover {
  color: var(--c-text);
  background: var(--c-bg-mute);
  border-color: var(--c-border);
}

.stress-close:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.stress-controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 16px 28px;
  padding: 14px 16px;
  background: color-mix(in srgb, var(--c-bg-soft) 64%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--c-border) 82%, transparent);
}

.stress-control {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.stress-surface-control {
  grid-column: 1 / -1;
}

.stress-control-label {
  font-size: 0.73rem;
  font-weight: 600;
  line-height: 1.2;
  color: var(--c-text-3);
  text-transform: uppercase;
  letter-spacing: 0;
}

.stress-control-row {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 7px;
}

.stress-surface-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.stress-surface-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  font-size: 0.76rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--c-text-2);
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: 7px;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;
}

.stress-surface-option:hover {
  color: var(--c-text);
  border-color: var(--c-border-dark);
}

.stress-surface-option.active,
.stress-surface-option[aria-pressed="true"] {
  color: var(--c-accent-text);
  background: var(--c-accent-soft);
  border-color: color-mix(in srgb, var(--c-accent) 24%, transparent);
}

.stress-surface-option:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.stress-range {
  flex: 1 1 auto;
  min-width: 96px;
  height: 4px;
  appearance: none;
  background: var(--c-bg-mute);
  border-radius: 2px;
  cursor: pointer;
}

.stress-range:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.stress-range::-webkit-slider-thumb {
  appearance: none;
  inline-size: 14px;
  block-size: 14px;
  background: var(--c-accent);
  border: 2px solid var(--c-bg);
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--c-border-dark);
}

.stress-value {
  flex: 0 0 auto;
  min-width: 2.5ch;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  line-height: 1;
  color: var(--c-text);
}

.stress-native-marker {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  min-height: 18px;
  padding: 0 6px;
  font-size: 0.62rem;
  font-weight: 700;
  line-height: 1;
  color: var(--c-accent-text);
  background: var(--c-accent-soft);
  border: 1px solid color-mix(in srgb, var(--c-accent) 22%, transparent);
  border-radius: 999px;
  letter-spacing: 0;
  text-transform: uppercase;
}

.stress-workload {
  overflow: auto;
  min-block-size: 0;
  padding: 14px 16px 18px;
}

.stress-workload :deep([data-overlayscrollbars-viewport]) {
  overscroll-behavior: contain;
}

.stress-list {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
}

.stress-item {
  position: relative;
  display: grid;
  gap: 5px;
  flex: 0 0 min(100%, var(--stress-width));
  padding: 8px 10px;
  background: var(--c-bg);
  border: 1px solid color-mix(in srgb, var(--c-border) 78%, transparent);
  border-radius: 7px;
}

.stress-item-meta {
  font-family: var(--font-mono);
  font-size: 0.64rem;
  font-weight: 600;
  line-height: 1;
  color: var(--c-text-3);
  text-transform: uppercase;
  letter-spacing: 0;
}

.stress-clamp {
  display: block;
  max-width: 100%;
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--c-text);
}

.stress-rich :deep(code) {
  padding: 0 0.2em;
  background: var(--c-code-bg);
  border-radius: 4px;
}

.stress-inline {
  width: 100%;
}

.stress-wrap {
  width: 100%;
}

.stress-token {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 7px;
  font-size: 0.76rem;
  line-height: 1;
  color: var(--c-text-2);
  background: var(--c-bg-soft);
  border: 1px solid var(--c-border);
  border-radius: 999px;
}

.stress-token-summary {
  color: var(--c-accent-text);
  background: var(--c-accent-soft);
  border-color: color-mix(in srgb, var(--c-accent) 22%, transparent);
}

@media (max-width: 639px) {
  .stress-overlay {
    align-items: stretch;
    padding: 0;
  }

  .stress-dialog {
    inline-size: 100%;
    block-size: 100svh;
    border: none;
    border-radius: 0;
  }

  .stress-header {
    align-items: flex-start;
    padding: max(12px, env(safe-area-inset-top)) 12px 12px;
  }

  .stress-header-tools {
    gap: 8px;
  }

  .stress-meter {
    padding: 4px 6px;
    gap: 6px;
  }

  .stress-meter-label {
    display: none;
  }

  .stress-controls {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 12px;
  }

  .stress-workload {
    padding: 12px 12px max(18px, env(safe-area-inset-bottom));
  }
}
</style>
