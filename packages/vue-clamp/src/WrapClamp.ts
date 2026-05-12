import {
  defineComponent,
  h,
  mergeProps,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  watchPostEffect,
} from "vue";
import {
  combinedSizeSignature,
  createCoalescingRunner,
  cssLength,
  listenForFontLoads,
  normalizeLineLimit,
} from "./layout.ts";
import { blockAsProp, expandedProp, maxHeightProp, maxLinesProp } from "./props.ts";
import { findLargestFittingCount } from "./search.ts";
import { hasSlotContent } from "./slot.ts";

import type { CSSProperties, PropType, VNodeChild } from "vue";
import type { WrapClampExposed, WrapClampItemSlotProps, WrapClampSlotProps } from "./types.ts";

type ItemKeyResolver = (item: unknown, index: number) => string | number;
type SequenceMeasurement = {
  allFit: boolean;
  visibleItems: number;
};
type SequenceMeasurementOptions = {
  recordItemWidth?: (index: number, width: number) => void;
};
type ClampLimits = {
  clipToRootHeight: boolean;
  lineLimit: number | undefined;
};
type Size = {
  height: number;
  width: number;
};
type StaticFlowStatus = "fit" | "overflow" | "unknown";
type StaticFlowEstimate = {
  fitCount: number;
  status: StaticFlowStatus;
};
type StaticFlowEstimateOptions = {
  afterWidth?: number;
  beforeWidth?: number;
  containerWidth: number;
  itemCount: number;
  itemWidth: (index: number) => number | null;
  lineLimit: number;
};

// DOMRect reads can differ by sub-pixel fractions across layout passes. Half a
// CSS pixel keeps those harmless differences from becoming clamp churn.
const layoutTolerance = 0.5;
// Materialized grow budgets are performance caps, not correctness caps. If the
// search reaches a cap while items remain, the fast path rejects and baseline
// settlement continues from the committed count.
const fallbackMaterializedGrowItems = 32;
const maxMaterializedGrowItemsPerLine = 48;

// WrapClamp treats each rendered item and slot as an atomic inline-flex box. It
// never clips through an item because callers own item rendering semantics.
const itemStyle: CSSProperties = {
  display: "inline-flex",
  maxWidth: "100%",
  verticalAlign: "baseline",
  whiteSpace: "nowrap",
};

const hiddenItemStyle: CSSProperties = {
  ...itemStyle,
  display: "none",
};

const contentStyle: CSSProperties = {
  display: "inline-flex",
  flexWrap: "wrap",
  maxWidth: "100%",
  width: "100%",
};

const propsDef = {
  as: blockAsProp,
  items: {
    type: Array as PropType<readonly unknown[]>,
    default: () => [],
  },
  itemKey: [String, Function] as PropType<string | ItemKeyResolver | undefined>,
  maxLines: maxLinesProp,
  maxHeight: maxHeightProp,
  expanded: expandedProp,
} as const;

const emitsDef = {
  "update:expanded": (value: boolean) => typeof value === "boolean",
  clampchange: (value: boolean) => typeof value === "boolean",
};

function resolveItemKey(
  itemKey: string | ItemKeyResolver | undefined,
  item: unknown,
  index: number,
): string | number {
  if (typeof itemKey === "function") {
    // Functional keys let callers describe identity for arbitrary item shapes.
    return itemKey(item, index);
  }

  if (
    typeof itemKey === "string" &&
    item &&
    typeof item === "object" &&
    itemKey in (item as Record<string, unknown>)
  ) {
    const value = (item as Record<string, unknown>)[itemKey];
    if (typeof value === "string" || typeof value === "number") {
      return value;
    }
  }

  // Falling back to index keeps primitive arrays usable without requiring a key
  // option, matching Vue's simple-list ergonomics.
  return index;
}

function defaultItemText(item: unknown): string {
  if (typeof item === "string") {
    return item;
  }

  if (typeof item === "number" || typeof item === "boolean" || typeof item === "bigint") {
    return String(item);
  }

  const serialized = JSON.stringify(item);
  return typeof serialized === "string" ? serialized : "";
}

function isPositiveFiniteSize(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function simulateStaticFlow({
  afterWidth = 0,
  beforeWidth = 0,
  containerWidth,
  itemCount,
  itemWidth,
  lineLimit,
}: StaticFlowEstimateOptions): StaticFlowEstimate {
  let currentLineWidth = Math.max(0, beforeWidth);
  let lineCount = 1;
  let fitCount = 0;

  for (let index = 0; index < itemCount; index += 1) {
    const width = itemWidth(index);
    if (!isPositiveFiniteSize(width)) {
      return {
        fitCount,
        status: "unknown",
      };
    }

    if (currentLineWidth > 0 && currentLineWidth + width > containerWidth + layoutTolerance) {
      lineCount += 1;
      currentLineWidth = 0;

      if (lineCount > lineLimit) {
        return {
          fitCount,
          status: "overflow",
        };
      }
    }

    currentLineWidth += width;
    fitCount = index + 1;
  }

  if (afterWidth > 0) {
    if (currentLineWidth > 0 && currentLineWidth + afterWidth > containerWidth + layoutTolerance) {
      lineCount += 1;
      currentLineWidth = 0;

      if (lineCount > lineLimit) {
        return {
          fitCount,
          status: "overflow",
        };
      }
    }

    if (currentLineWidth + afterWidth > containerWidth + layoutTolerance) {
      return {
        fitCount,
        status: "overflow",
      };
    }
  }

  return {
    fitCount,
    status: "fit",
  };
}

function measureElementSize(element: HTMLElement | null): Size | null {
  if (!element) {
    return null;
  }

  const { height, width } = element.getBoundingClientRect();
  if (!isPositiveFiniteSize(width) || !isPositiveFiniteSize(height)) {
    return null;
  }

  return {
    height,
    width,
  };
}

function isSameSize(current: Size | null, next: Size | null): boolean {
  if (current === null || next === null) {
    return current === next;
  }

  return (
    Math.abs(current.width - next.width) <= layoutTolerance &&
    Math.abs(current.height - next.height) <= layoutTolerance
  );
}

function isSameMeasuredLine(rect: DOMRectReadOnly, lineTop: number, lineBottom: number): boolean {
  const verticalOverlap = Math.min(rect.bottom, lineBottom) - Math.max(rect.top, lineTop);
  const smallerHeight = Math.min(rect.height, lineBottom - lineTop);
  return verticalOverlap > Math.min(layoutTolerance, smallerHeight / 2);
}

function measureSequence(
  rootElement: HTMLElement,
  contentElement: HTMLElement | null,
  limits: ClampLimits,
  options: SequenceMeasurementOptions = {},
): SequenceMeasurement {
  const { clipToRootHeight, lineLimit } = limits;

  if (!contentElement) {
    // Missing content is a lifecycle state, not evidence that items are hidden.
    return {
      allFit: true,
      visibleItems: 0,
    };
  }

  let visibleTop = 0;
  let visibleBottom = 0;

  if (clipToRootHeight) {
    // maxHeight clipping depends on the root's visible box, while line counting
    // depends on each child box below.
    const rootRect = rootElement.getBoundingClientRect();
    visibleTop = rootRect.top + rootElement.clientTop;
    visibleBottom = visibleTop + rootElement.clientHeight;
  }

  let lineCount = 0;
  let lineTop = 0;
  let lineBottom = 0;
  let visibleItems = 0;

  for (const child of contentElement.children) {
    if (!(child instanceof HTMLElement)) {
      continue;
    }

    const part = child.dataset.part;
    if (part !== "before" && part !== "item" && part !== "after") {
      // Only component-owned atomic boxes should affect the clamp decision.
      continue;
    }

    const rect = child.getBoundingClientRect();
    if (!isPositiveFiniteSize(rect.width) || !isPositiveFiniteSize(rect.height)) {
      continue;
    }

    if (lineCount === 0) {
      lineCount = 1;
      lineTop = rect.top;
      lineBottom = rect.bottom;
    } else {
      // Mixed-height flex items can have different top coordinates under
      // center, end, or baseline alignment. Same-line boxes still overlap in
      // the vertical axis in the supported horizontal flex-flow model.
      if (!isSameMeasuredLine(rect, lineTop, lineBottom)) {
        lineCount += 1;
        lineTop = rect.top;
        lineBottom = rect.bottom;
      } else {
        lineTop = Math.min(lineTop, rect.top);
        lineBottom = Math.max(lineBottom, rect.bottom);
      }
    }

    if (lineLimit !== undefined && lineCount > lineLimit) {
      // Early return keeps measurement proportional to the first overflow, not
      // the full item count.
      return {
        allFit: false,
        visibleItems,
      };
    }

    if (
      clipToRootHeight &&
      (rect.top < visibleTop - layoutTolerance || rect.bottom > visibleBottom + layoutTolerance)
    ) {
      // maxHeight can reject a sequence even when the line count is acceptable.
      return {
        allFit: false,
        visibleItems,
      };
    }

    if (part === "item") {
      options.recordItemWidth?.(visibleItems, rect.width);
      visibleItems += 1;
    }
  }

  return {
    allFit: true,
    visibleItems,
  };
}

export const WrapClamp = defineComponent({
  name: "WrapClamp",
  inheritAttrs: false,
  props: propsDef,
  emits: emitsDef,
  setup(props, { attrs, emit, expose, slots }) {
    const { expanded: expandedProp, items: initialItems } = props;
    const rootRef = ref<HTMLElement | null>(null);
    const contentRef = ref<HTMLElement | null>(null);
    const beforeRef = ref<HTMLElement | null>(null);
    const afterRef = ref<HTMLElement | null>(null);
    const expanded = ref(expandedProp);
    const visibleCount = ref(initialItems.length);
    const materializedCount = ref(0);
    const isClamped = ref(false);

    let resizeObserver: ResizeObserver | null = null;
    let stopFonts = () => {};
    let lastLayoutSignature: string | null = null;
    let lastRootWidth: number | null = null;
    let measuredItemWidths: number[] = [];

    function expand(): void {
      expanded.value = true;
    }

    function collapse(): void {
      expanded.value = false;
    }

    function toggle(): void {
      expanded.value = !expanded.value;
    }

    async function applyVisibleCount(nextVisibleCount: number): Promise<void> {
      const { items } = props;
      const totalItems = items.length;
      const normalizedVisibleCount = Math.max(0, Math.min(totalItems, nextVisibleCount));
      const nextClamped = normalizedVisibleCount < totalItems;
      const changed =
        visibleCount.value !== normalizedVisibleCount || isClamped.value !== nextClamped;
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
      return combinedSizeSignature(
        rootRef.value,
        contentRef.value,
        beforeRef.value,
        afterRef.value,
      );
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
      return (
        slots.after === undefined && (limits.lineLimit !== undefined || limits.clipToRootHeight)
      );
    }

    function renderedItemElements(): HTMLElement[] {
      const contentElement = contentRef.value;
      if (!contentElement) {
        return [];
      }

      const elements: HTMLElement[] = [];
      for (const child of contentElement.children) {
        if (child instanceof HTMLElement && child.dataset.part === "item") {
          elements.push(child);
        }
      }

      return elements;
    }

    function showItemCandidate(
      itemElements: readonly HTMLElement[],
      currentCount: number,
      nextCount: number,
    ): number {
      const start = Math.min(currentCount, nextCount);
      const end = Math.max(currentCount, nextCount);

      for (let index = start; index < end; index += 1) {
        const element = itemElements[index];
        if (element) {
          element.style.display = index < nextCount ? "inline-flex" : "none";
        }
      }

      return nextCount;
    }

    function measureCurrentSequence(
      rootElement: HTMLElement,
      limits: ClampLimits,
    ): SequenceMeasurement {
      const { clipToRootHeight, lineLimit } = limits;
      if (lineLimit === undefined && (slots.after !== undefined || !clipToRootHeight)) {
        return measureSequence(rootElement, contentRef.value, limits);
      }

      const nextWidths = measuredItemWidths.slice(0, props.items.length);
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

    function averageMeasuredItemWidth(): number | null {
      let widthSum = 0;
      let widthCount = 0;

      for (const itemWidth of measuredItemWidths) {
        if (isPositiveFiniteSize(itemWidth)) {
          widthSum += itemWidth;
          widthCount += 1;
        }
      }

      return widthCount > 0 ? widthSum / widthCount : null;
    }

    function visibleAtomicHeight(): number | null {
      const contentElement = contentRef.value;
      if (!contentElement) {
        return null;
      }

      let height = 0;
      for (const child of contentElement.children) {
        if (!(child instanceof HTMLElement)) {
          continue;
        }

        const part = child.dataset.part;
        if (part !== "before" && part !== "item") {
          continue;
        }

        const rect = child.getBoundingClientRect();
        if (!isPositiveFiniteSize(rect.width) || !isPositiveFiniteSize(rect.height)) {
          continue;
        }

        height = Math.max(height, rect.height);
        if (part === "item") {
          break;
        }
      }

      return height > 0 ? height : null;
    }

    function estimateMaterializedGrowLineLimit(
      rootElement: HTMLElement,
      limits: ClampLimits,
    ): number | null {
      const { clipToRootHeight, lineLimit } = limits;
      if (!clipToRootHeight) {
        return lineLimit ?? null;
      }

      const atomicHeight = visibleAtomicHeight();
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
        itemWidth: (index) => itemWidthAt(index, fallbackItemWidth),
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
      const averageItemWidth = averageMeasuredItemWidth();
      // The extra item gives DOM search an overflow side when the estimate
      // lands exactly on the fitting frontier.
      let estimatedFrontierCount = fallbackMaterializedGrowItems;
      if (averageItemWidth !== null) {
        estimatedFrontierCount = estimateMaterializedFrontierFromWidths(
          containerWidth,
          lineLimit,
          totalItems,
          averageItemWidth,
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

    function itemWidthAt(index: number, fallbackWidth: number): number {
      const measuredWidth = measuredItemWidths[index];
      return isPositiveFiniteSize(measuredWidth) ? measuredWidth : fallbackWidth;
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
            itemWidth: (index) => itemWidthAt(index, averageItemWidth),
            lineLimit,
          }).status === "fit",
        hint,
      );
    }

    async function applyStaticFlowCountHint(
      containerWidth: number,
      limits: ClampLimits,
    ): Promise<void> {
      const { items } = props;
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
      const { items } = props;
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

      const itemElements = renderedItemElements();
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
      const { items } = props;
      if (
        slots.after === undefined ||
        limits.clipToRootHeight ||
        limits.lineLimit === undefined ||
        visibleCount.value >= items.length
      ) {
        return;
      }

      const averageItemWidth = averageMeasuredItemWidth();
      if (averageItemWidth === null || rootWidthDelta < averageItemWidth - layoutTolerance) {
        return;
      }

      const beforeSize = measureElementSize(beforeRef.value);
      const afterSize = measureElementSize(afterRef.value);
      const estimatedVisibleCount = estimateDynamicAfterGrowHintCount(
        rootWidth,
        limits.lineLimit,
        items.length,
        averageItemWidth,
        beforeSize?.width ?? 0,
        afterSize?.width ?? 0,
        visibleCount.value,
      );

      if (estimatedVisibleCount <= visibleCount.value + 1 || estimatedVisibleCount > items.length) {
        return;
      }

      await applyVisibleCount(estimatedVisibleCount);
    }

    async function settleVisibleCount(
      rootElement: HTMLElement,
      limits: ClampLimits,
    ): Promise<void> {
      const { items } = props;
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
      const { items, maxHeight, maxLines } = props;
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
      if (
        rootWidthGrew &&
        (await applyStaticFlowMaterializedGrow(rootElement, rootWidth, limits))
      ) {
        return;
      }

      if (rootWidthGrew) {
        await applyDynamicAfterGrowHint(rootWidth, rootWidthDelta, limits);
      }

      await settleVisibleCount(rootElement, limits);
    }

    const requestRecompute = createCoalescingRunner(async () => {
      await recompute();
      lastLayoutSignature = layoutSignature();
    });

    watch(
      () => props.expanded,
      (value) => {
        expanded.value = value;
      },
    );

    watch(
      expanded,
      (value) => {
        if (props.expanded !== value) {
          emit("update:expanded", value);
        }

        requestRecompute();
      },
      { flush: "post" },
    );

    watch(
      [() => props.maxLines, () => props.maxHeight, () => props.itemKey, () => props.items],
      () => {
        measuredItemWidths = [];
        requestRecompute();
      },
      { deep: true, flush: "post" },
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

    onBeforeUnmount(() => {
      resizeObserver?.disconnect();
      stopFonts();
    });

    expose({
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

    return () => {
      const { as, itemKey, items, maxHeight } = props;
      const collapsedMaxHeight = !expanded.value ? cssLength(maxHeight) : undefined;
      const renderedVisibleCount = Math.min(visibleCount.value, items.length);
      const renderedItemCount = Math.min(
        items.length,
        Math.max(renderedVisibleCount, materializedCount.value),
      );
      const hasAffixSlot = slots.before !== undefined || slots.after !== undefined;
      const slotProps = hasAffixSlot
        ? ({
            expand,
            collapse,
            toggle,
            clamped: renderedVisibleCount < items.length,
            expanded: expanded.value,
            hiddenItems: items.slice(renderedVisibleCount),
          } satisfies WrapClampSlotProps)
        : undefined;
      const beforeSlot = slotProps === undefined ? undefined : slots.before?.(slotProps);
      const afterSlot = slotProps === undefined ? undefined : slots.after?.(slotProps);

      const children: VNodeChild[] = [];

      if (hasSlotContent(beforeSlot)) {
        children.push(
          h(
            "span",
            {
              "data-part": "before",
              ref: beforeRef,
              style: itemStyle,
            },
            beforeSlot,
          ),
        );
      }

      for (let index = 0; index < renderedItemCount; index += 1) {
        const item = items[index];
        const hiddenProbeItem = index >= renderedVisibleCount;
        const itemContent =
          slots.item?.({
            item,
            index,
          } satisfies WrapClampItemSlotProps) ?? defaultItemText(item);

        children.push(
          h(
            "span",
            {
              "aria-hidden": hiddenProbeItem ? "true" : undefined,
              "data-part": "item",
              key: resolveItemKey(itemKey, item, index),
              style: hiddenProbeItem ? hiddenItemStyle : itemStyle,
            },
            itemContent,
          ),
        );
      }

      if (hasSlotContent(afterSlot)) {
        children.push(
          h(
            "span",
            {
              "data-part": "after",
              ref: afterRef,
              style: itemStyle,
            },
            afterSlot,
          ),
        );
      }

      return h(
        as,
        mergeProps(attrs, {
          "data-part": "root",
          ref: rootRef,
          style: {
            maxHeight: collapsedMaxHeight,
            overflow: "hidden",
          },
        }),
        h(
          "span",
          {
            "data-part": "content",
            ref: contentRef,
            style: contentStyle,
          },
          children,
        ),
      );
    };
  },
});
