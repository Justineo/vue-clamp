<script setup lang="ts" generic="T = unknown">
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  shallowRef,
  useAttrs,
  watch,
  watchPostEffect,
} from "vue";
import {
  combinedSizeSignature,
  createCoalescingRunner,
  cssLength,
  listenForFontLoads,
  normalizeLineLimit,
} from "../layout.ts";
import { useClampControls } from "../controls.ts";
import { findLargestFittingCount } from "../search.ts";
import {
  averageItemWidth,
  findItemElements,
  isSameSize,
  measureElementSize,
  measureSequence,
  measureVisibleAtomicHeight,
  showItemCandidate,
  simulateStaticFlow,
  itemWidthAt,
  layoutTolerance,
} from "./flow.ts";
import { renderRoot } from "./render.ts";

import type { ComponentPublicInstance, VNodeChild } from "vue";
import type { ClampEmits } from "../types.ts";
import type { ClampLimits, SequenceMeasurement } from "./types.ts";
import type {
  WrapClampExposed,
  WrapClampProps,
  WrapClampSlotProps,
  WrapClampSlots,
} from "./types.ts";

// Materialized grow budgets are performance caps, not correctness caps. If the
// search reaches a cap while items remain, the fast path rejects and baseline
// settlement continues from the committed count.
const fallbackMaterializedGrowItems = 32;
const maxMaterializedGrowItemsPerLine = 48;

defineOptions({
  name: "WrapClamp",
  inheritAttrs: false,
});

const {
  as: rootTag = "div",
  items = [],
  itemKey,
  maxLines,
  maxHeight,
} = defineProps<Omit<WrapClampProps<T>, "expanded">>();
const expanded = defineModel<NonNullable<WrapClampProps<T>["expanded"]>>("expanded", {
  default: false,
});
const emit = defineEmits<Omit<ClampEmits, "update:expanded">>();
const slots = defineSlots<WrapClampSlots<T>>();
const attrs = useAttrs();
const { expand, collapse, toggle } = useClampControls(expanded);

const rootRef = shallowRef<HTMLElement | null>(null);
const contentRef = shallowRef<HTMLElement | null>(null);
const beforeRef = shallowRef<HTMLElement | null>(null);
const afterRef = shallowRef<HTMLElement | null>(null);
const visibleCount = shallowRef(items.length);
const materializedCount = shallowRef(0);
const isClamped = shallowRef(false);

let resizeObserver: ResizeObserver | null = null;
let stopFonts = () => {};
let lastLayoutSignature: string | null = null;
let lastRootWidth: number | null = null;
let measuredItemWidths: number[] = [];
let isRecomputing = false;

async function applyVisibleCount(nextVisibleCount: number): Promise<void> {
  const totalItems = items.length;
  const normalizedVisibleCount = Math.max(0, Math.min(totalItems, nextVisibleCount));
  const nextClamped = normalizedVisibleCount < totalItems;
  const changed = visibleCount.value !== normalizedVisibleCount || isClamped.value !== nextClamped;
  const materializedChanged = materializedCount.value !== 0;

  visibleCount.value = normalizedVisibleCount;
  materializedCount.value = 0;
  isClamped.value = nextClamped;

  if (changed || materializedChanged) {
    // Measurement reads the rendered item sequence, so each visible-count
    // change must be committed before the next probe.
    await nextTick();
  }
}

function layoutSignature(): string {
  return combinedSizeSignature(rootRef.value, contentRef.value, beforeRef.value, afterRef.value);
}

function canUseStaticFlowCountHint(
  limits: ClampLimits,
): limits is ClampLimits & { lineLimit: number } {
  return (
    slots.before === undefined &&
    slots.after === undefined &&
    !limits.clipToRootHeight &&
    limits.lineLimit !== undefined
  );
}

function canUseStaticFlowSearch(limits: ClampLimits): boolean {
  return slots.after === undefined && (limits.lineLimit !== undefined || limits.clipToRootHeight);
}

function measureCurrentSequence(
  rootElement: HTMLElement,
  limits: ClampLimits,
): SequenceMeasurement {
  const { clipToRootHeight, lineLimit } = limits;
  if (lineLimit === undefined && (slots.after !== undefined || !clipToRootHeight)) {
    return measureSequence(rootElement, contentRef.value, limits);
  }

  const nextWidths = measuredItemWidths.slice(0, items.length);
  const measurement = measureSequence(rootElement, contentRef.value, limits, {
    recordItemWidth(index, width) {
      nextWidths[index] = width;
    },
  });
  measuredItemWidths = nextWidths;

  return measurement;
}

function estimateVisibleCountFromWidths(
  containerWidth: number,
  lineLimit: number,
  totalItems: number,
  beforeWidth = 0,
): number | null {
  const result = simulateStaticFlow({
    beforeWidth,
    containerWidth,
    itemCount: totalItems,
    itemWidth: (index) => measuredItemWidths[index] ?? null,
    lineLimit,
  });

  return result.status === "unknown" && result.fitCount === 0 ? null : result.fitCount;
}

function estimateMaterializedGrowLineLimit(
  rootElement: HTMLElement,
  limits: ClampLimits,
): number | null {
  const { clipToRootHeight, lineLimit } = limits;
  if (!clipToRootHeight) {
    return lineLimit ?? null;
  }

  const atomicHeight = measureVisibleAtomicHeight(contentRef.value);
  if (atomicHeight === null || rootElement.clientHeight <= 0) {
    return lineLimit ?? null;
  }

  const clipLineLimit = Math.max(
    1,
    Math.floor((rootElement.clientHeight + layoutTolerance) / atomicHeight),
  );

  return lineLimit === undefined ? clipLineLimit : Math.min(lineLimit, clipLineLimit);
}

function estimateMaterializedFrontierFromWidths(
  containerWidth: number,
  lineLimit: number,
  totalItems: number,
  fallbackItemWidth: number,
  beforeWidth: number,
): number {
  const result = simulateStaticFlow({
    beforeWidth,
    containerWidth,
    itemCount: totalItems,
    itemWidth: (index) => itemWidthAt(measuredItemWidths, index, fallbackItemWidth),
    lineLimit,
  });

  // Include the first predicted overflow item so DOM search has an overflow
  // side instead of accepting a too-low upper bound.
  return result.status === "overflow" ? Math.min(totalItems, result.fitCount + 1) : totalItems;
}

function estimateMaterializedGrowCount(
  containerWidth: number,
  lineLimit: number,
  currentVisibleCount: number,
  totalItems: number,
  beforeWidth = 0,
): number {
  const averageWidth = averageItemWidth(measuredItemWidths);
  // The extra item gives DOM search an overflow side when the estimate
  // lands exactly on the fitting frontier.
  let estimatedFrontierCount = fallbackMaterializedGrowItems;
  if (averageWidth !== null) {
    estimatedFrontierCount = estimateMaterializedFrontierFromWidths(
      containerWidth,
      lineLimit,
      totalItems,
      averageWidth,
      beforeWidth,
    );
  }
  const materializationCap = Math.max(
    fallbackMaterializedGrowItems,
    lineLimit * maxMaterializedGrowItemsPerLine,
  );
  const cappedTargetCount = Math.min(estimatedFrontierCount, materializationCap);

  return Math.min(totalItems, Math.max(currentVisibleCount + 1, cappedTargetCount));
}

function estimateDynamicAfterGrowHintCount(
  containerWidth: number,
  lineLimit: number,
  totalItems: number,
  averageItemWidth: number,
  beforeWidth: number,
  afterWidth: number,
  hint: number,
): number {
  return findLargestFittingCount(
    0,
    totalItems,
    (candidate) =>
      simulateStaticFlow({
        afterWidth,
        beforeWidth,
        containerWidth,
        itemCount: candidate,
        itemWidth: (index) => itemWidthAt(measuredItemWidths, index, averageItemWidth),
        lineLimit,
      }).status === "fit",
    hint,
  );
}

async function applyStaticFlowCountHint(
  containerWidth: number,
  limits: ClampLimits,
): Promise<void> {
  if (!canUseStaticFlowCountHint(limits)) {
    return;
  }

  const estimatedVisibleCount = estimateVisibleCountFromWidths(
    containerWidth,
    limits.lineLimit,
    items.length,
  );

  if (estimatedVisibleCount !== null && estimatedVisibleCount !== visibleCount.value) {
    await applyVisibleCount(estimatedVisibleCount);
  }
}

async function applyStaticFlowShrink(
  rootElement: HTMLElement,
  limits: ClampLimits,
): Promise<boolean> {
  if (!canUseStaticFlowSearch(limits)) {
    return false;
  }

  const beforeSize = measureElementSize(beforeRef.value);
  const measurement = measureCurrentSequence(rootElement, limits);
  if (measurement.allFit || measurement.visibleItems >= visibleCount.value) {
    return false;
  }

  await applyVisibleCount(measurement.visibleItems);

  const nextBeforeSize = measureElementSize(beforeRef.value);
  const verification = measureCurrentSequence(rootElement, limits);
  return (
    verification.allFit &&
    verification.visibleItems === visibleCount.value &&
    isSameSize(beforeSize, nextBeforeSize)
  );
}

async function applyStaticFlowMaterializedGrow(
  rootElement: HTMLElement,
  rootWidth: number,
  limits: ClampLimits,
): Promise<boolean> {
  if (!canUseStaticFlowSearch(limits)) {
    return false;
  }

  const currentVisibleCount = visibleCount.value;
  const totalItems = items.length;
  const beforeSize = measureElementSize(beforeRef.value);
  const searchLineLimit = estimateMaterializedGrowLineLimit(rootElement, limits);
  if (searchLineLimit === null) {
    return false;
  }

  const searchItemCount = estimateMaterializedGrowCount(
    rootWidth,
    searchLineLimit,
    currentVisibleCount,
    totalItems,
    beforeSize?.width,
  );
  if (currentVisibleCount >= searchItemCount) {
    return false;
  }

  // The no-after grow path materializes a bounded suffix once, then toggles
  // component-owned item shells during search. User slots are not rerun for
  // every candidate.
  materializedCount.value = searchItemCount;
  await nextTick();

  const itemElements = findItemElements(contentRef.value);
  const contentElement = contentRef.value;
  if (!contentElement || itemElements.length < searchItemCount) {
    await applyVisibleCount(currentVisibleCount);
    return false;
  }

  let shownCount = currentVisibleCount;
  const bestFitCount = findLargestFittingCount(
    currentVisibleCount,
    searchItemCount,
    (candidate) => {
      shownCount = showItemCandidate(itemElements, shownCount, candidate);

      const measurement = measureSequence(rootElement, contentElement, limits);
      return measurement.allFit && measurement.visibleItems === candidate;
    },
  );

  showItemCandidate(itemElements, shownCount, currentVisibleCount);
  await applyVisibleCount(bestFitCount);

  const reachedSearchLimit = bestFitCount === searchItemCount && searchItemCount < totalItems;
  const nextBeforeSize = measureElementSize(beforeRef.value);
  const verification = measureCurrentSequence(rootElement, limits);
  return (
    verification.allFit &&
    verification.visibleItems === visibleCount.value &&
    isSameSize(beforeSize, nextBeforeSize) &&
    !reachedSearchLimit
  );
}

async function applyDynamicAfterGrowHint(
  rootWidth: number,
  rootWidthDelta: number,
  limits: ClampLimits,
): Promise<void> {
  if (
    slots.after === undefined ||
    limits.clipToRootHeight ||
    limits.lineLimit === undefined ||
    visibleCount.value >= items.length
  ) {
    return;
  }

  const averageWidth = averageItemWidth(measuredItemWidths);
  if (averageWidth === null || rootWidthDelta < averageWidth - layoutTolerance) {
    return;
  }

  const beforeSize = measureElementSize(beforeRef.value);
  const afterSize = measureElementSize(afterRef.value);
  const estimatedVisibleCount = estimateDynamicAfterGrowHintCount(
    rootWidth,
    limits.lineLimit,
    items.length,
    averageWidth,
    beforeSize?.width ?? 0,
    afterSize?.width ?? 0,
    visibleCount.value,
  );

  if (estimatedVisibleCount <= visibleCount.value + 1 || estimatedVisibleCount > items.length) {
    return;
  }

  await applyVisibleCount(estimatedVisibleCount);
}

async function settleVisibleCount(rootElement: HTMLElement, limits: ClampLimits): Promise<void> {
  const totalItems = items.length;
  let measurement = measureCurrentSequence(rootElement, limits);

  while (
    visibleCount.value > 0 &&
    (!measurement.allFit || measurement.visibleItems < visibleCount.value)
  ) {
    // First shrink to a known fitting prefix. Measurement may report fewer
    // visible items than requested when before/after slots consume space.
    await applyVisibleCount(Math.min(measurement.visibleItems, visibleCount.value - 1));
    measurement = measureCurrentSequence(rootElement, limits);
  }

  while (
    measurement.allFit &&
    measurement.visibleItems === visibleCount.value &&
    visibleCount.value < totalItems
  ) {
    const currentVisibleCount = visibleCount.value;
    // Then grow one item at a time to recover space after width increases.
    // Linear growth is deliberate because each item can have arbitrary width.
    await applyVisibleCount(currentVisibleCount + 1);
    measurement = measureCurrentSequence(rootElement, limits);

    if (!measurement.allFit || measurement.visibleItems < currentVisibleCount + 1) {
      await applyVisibleCount(currentVisibleCount);
      return;
    }
  }
}

async function recompute(): Promise<void> {
  const totalItems = items.length;
  const limits: ClampLimits = {
    clipToRootHeight: maxHeight !== undefined,
    lineLimit: normalizeLineLimit(maxLines),
  };

  if (
    expanded.value ||
    totalItems === 0 ||
    (limits.lineLimit === undefined && !limits.clipToRootHeight)
  ) {
    // Without an active clamp constraint, render the full item list so slot
    // props and DOM order stay straightforward.
    await applyVisibleCount(totalItems);
    return;
  }

  const rootElement = rootRef.value;
  const rootWidth = rootElement?.getBoundingClientRect().width ?? 0;
  if (!rootElement || rootWidth <= 0) {
    // Hidden or unmounted roots cannot produce stable item measurements.
    lastRootWidth = null;
    await applyVisibleCount(totalItems);
    return;
  }

  const previousRootWidth = lastRootWidth;
  const rootWidthDelta = previousRootWidth === null ? 0 : rootWidth - previousRootWidth;
  const rootWidthShrank = rootWidthDelta < -layoutTolerance;
  const rootWidthGrew = rootWidthDelta > layoutTolerance;
  lastRootWidth = rootWidth;

  await applyVisibleCount(Math.min(visibleCount.value, totalItems));
  // Fast paths are ordered from cheapest proof to most speculative hint.
  // Any rejected path falls through to live-DOM settlement below.
  if (rootWidthShrank && (await applyStaticFlowShrink(rootElement, limits))) {
    return;
  }

  await applyStaticFlowCountHint(rootWidth, limits);
  if (rootWidthGrew && (await applyStaticFlowMaterializedGrow(rootElement, rootWidth, limits))) {
    return;
  }

  if (rootWidthGrew) {
    await applyDynamicAfterGrowHint(rootWidth, rootWidthDelta, limits);
  }

  await settleVisibleCount(rootElement, limits);
}

const requestRecompute = createCoalescingRunner(async () => {
  isRecomputing = true;

  try {
    await recompute();
    lastLayoutSignature = layoutSignature();
  } finally {
    isRecomputing = false;
  }
});

function getAffixSlotProps(
  visibleItemCount: number,
  expandedValue: boolean,
): WrapClampSlotProps<T> | undefined {
  if (slots.before === undefined && slots.after === undefined) {
    return undefined;
  }

  return {
    expand,
    collapse,
    toggle,
    clamped: visibleItemCount < items.length,
    expanded: expandedValue,
    hiddenItems: items.slice(visibleItemCount),
  };
}

// `defineRender` exposes this setup-local function as the SFC render entry;
// `renderRoot` owns the root/content/item structure so there is no authored
// template to keep in sync.
function render(): VNodeChild {
  const visibleItemCount = Math.min(visibleCount.value, items.length);
  const renderedItemCount = Math.min(
    items.length,
    Math.max(visibleItemCount, materializedCount.value),
  );
  const expandedValue = expanded.value;

  return renderRoot({
    affixSlotProps: getAffixSlotProps(visibleItemCount, expandedValue),
    afterSlot: slots.after,
    attrs,
    beforeSlot: slots.before,
    itemKey,
    itemSlot: slots.item,
    items,
    renderedItemCount,
    rootStyle: {
      maxHeight: !expandedValue ? cssLength(maxHeight) : undefined,
      overflow: "hidden",
    },
    rootTag,
    setAfterRef: setAfterElement,
    setBeforeRef: setBeforeElement,
    setContentRef: setContentElement,
    setRootRef: setRootElement,
    visibleItemCount,
  });
}

defineRender(render);

function setRootElement(element: ComponentPublicInstance | Element | null): void {
  rootRef.value = element instanceof HTMLElement ? element : null;
}

function setContentElement(element: ComponentPublicInstance | Element | null): void {
  contentRef.value = element instanceof HTMLElement ? element : null;
}

function setBeforeElement(element: ComponentPublicInstance | Element | null): void {
  beforeRef.value = element instanceof HTMLElement ? element : null;
}

function setAfterElement(element: ComponentPublicInstance | Element | null): void {
  afterRef.value = element instanceof HTMLElement ? element : null;
}

watch(
  expanded,
  () => {
    requestRecompute();
  },
  { flush: "post" },
);

watch(
  [() => maxLines, () => maxHeight, () => itemKey, () => items, () => items.length],
  () => {
    measuredItemWidths = [];
    requestRecompute();
  },
  { flush: "post" },
);

watch(
  isClamped,
  (value) => {
    emit("clampchange", value);
  },
  { flush: "post", immediate: true },
);

watchPostEffect((onCleanup) => {
  resizeObserver ??= new ResizeObserver(() => {
    if (layoutSignature() !== lastLayoutSignature) {
      // Slot boxes are part of the wrap sequence, so their size changes must
      // invalidate the item count even when the item array is unchanged.
      requestRecompute();
    }
  });

  const observed: HTMLElement[] = [];
  if (rootRef.value instanceof HTMLElement) {
    observed.push(rootRef.value);
  }
  if (contentRef.value instanceof HTMLElement) {
    observed.push(contentRef.value);
  }
  if (beforeRef.value instanceof HTMLElement) {
    observed.push(beforeRef.value);
  }
  if (afterRef.value instanceof HTMLElement) {
    observed.push(afterRef.value);
  }

  for (const element of observed) {
    resizeObserver.observe(element);
  }

  onCleanup(() => {
    for (const element of observed) {
      resizeObserver?.unobserve(element);
    }
  });
});

onMounted(() => {
  requestRecompute();
  stopFonts = listenForFontLoads(() => {
    measuredItemWidths = [];
    requestRecompute();
  });
});

onUpdated(() => {
  if (!isRecomputing && layoutSignature() === lastLayoutSignature) {
    measuredItemWidths = [];
    requestRecompute();
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  stopFonts();
});

defineExpose({
  expand,
  collapse,
  toggle,
  get clamped() {
    return isClamped.value;
  },
  get expanded() {
    return expanded.value;
  },
} satisfies WrapClampExposed);
</script>
