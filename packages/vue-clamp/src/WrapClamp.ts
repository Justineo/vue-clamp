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
import { hasSlotContent } from "./slot.ts";

import type { CSSProperties, PropType, VNodeChild } from "vue";
import type {
  WrapClampExposed,
  WrapClampItemKey,
  WrapClampItemSlotProps,
  WrapClampSlotProps,
} from "./types.ts";

type ItemKeyResolver = Exclude<WrapClampItemKey<unknown>, string>;
type SequenceMeasurement = {
  allFit: boolean;
  visibleItems: number;
};

// WrapClamp treats each rendered item and slot as an atomic inline-flex box. It
// never clips through an item because callers own item rendering semantics.
const itemStyle: CSSProperties = {
  display: "inline-flex",
  maxWidth: "100%",
  verticalAlign: "baseline",
  whiteSpace: "nowrap",
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

function measureSequence(
  rootElement: HTMLElement,
  contentElement: HTMLElement | null,
  lineLimit: number | undefined,
  clipToRootHeight: boolean,
): SequenceMeasurement {
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
  let previousTop: number | null = null;
  let visibleItems = 0;

  if (!contentElement) {
    // Missing content is a lifecycle state, not evidence that items are hidden.
    return {
      allFit: true,
      visibleItems: 0,
    };
  }

  for (const child of contentElement.children) {
    if (!(child instanceof HTMLElement)) {
      continue;
    }

    const part = child.dataset.part;
    if (part !== "before" && part !== "item" && part !== "after") {
      // Only component-owned atomic boxes should affect the clamp decision.
      continue;
    }

    const { bottom, height, top, width } = child.getBoundingClientRect();
    if (width <= 0 || height <= 0) {
      continue;
    }

    if (previousTop === null || Math.abs(top - previousTop) > 0.5) {
      // Wrapped inline-flex children share a line by vertical position. The
      // tolerance absorbs sub-pixel rounding differences across browsers.
      lineCount += 1;
      previousTop = top;
    }

    if (lineLimit !== undefined && lineCount > lineLimit) {
      // Early return keeps measurement proportional to the first overflow, not
      // the full item count.
      return {
        allFit: false,
        visibleItems,
      };
    }

    if (clipToRootHeight && (top < visibleTop - 0.5 || bottom > visibleBottom + 0.5)) {
      // maxHeight can reject a sequence even when the line count is acceptable.
      return {
        allFit: false,
        visibleItems,
      };
    }

    if (part === "item") {
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
    const isClamped = ref(false);

    let resizeObserver: ResizeObserver | null = null;
    let stopFonts = () => {};
    let lastLayoutSignature: string | null = null;

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

      visibleCount.value = normalizedVisibleCount;
      isClamped.value = nextClamped;

      if (changed) {
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

    async function settleVisibleCount(
      rootElement: HTMLElement,
      lineLimit: number | undefined,
      clipToRootHeight: boolean,
    ): Promise<void> {
      const { items } = props;
      const totalItems = items.length;
      let measurement = measureSequence(rootElement, contentRef.value, lineLimit, clipToRootHeight);

      while (
        visibleCount.value > 0 &&
        (!measurement.allFit || measurement.visibleItems < visibleCount.value)
      ) {
        // First shrink to a known fitting prefix. Measurement may report fewer
        // visible items than requested when before/after slots consume space.
        await applyVisibleCount(Math.min(measurement.visibleItems, visibleCount.value - 1));
        measurement = measureSequence(rootElement, contentRef.value, lineLimit, clipToRootHeight);
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
        measurement = measureSequence(rootElement, contentRef.value, lineLimit, clipToRootHeight);

        if (!measurement.allFit || measurement.visibleItems < currentVisibleCount + 1) {
          await applyVisibleCount(currentVisibleCount);
          return;
        }
      }
    }

    async function recompute(): Promise<void> {
      const { items, maxHeight, maxLines } = props;
      const totalItems = items.length;
      const lineLimit = normalizeLineLimit(maxLines);
      const clipToRootHeight = maxHeight !== undefined;
      const hasLimit = lineLimit !== undefined || clipToRootHeight;

      if (expanded.value || totalItems === 0 || !hasLimit) {
        // Without an active clamp constraint, render the full item list so slot
        // props and DOM order stay straightforward.
        await applyVisibleCount(totalItems);
        return;
      }

      const rootElement = rootRef.value;
      if (!rootElement || rootElement.getBoundingClientRect().width <= 0) {
        // Hidden or unmounted roots cannot produce stable item measurements.
        await applyVisibleCount(totalItems);
        return;
      }

      await applyVisibleCount(Math.min(visibleCount.value, totalItems));
      await settleVisibleCount(rootElement, lineLimit, clipToRootHeight);
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

      const observed = [rootRef.value, contentRef.value, beforeRef.value, afterRef.value].filter(
        (element): element is HTMLElement => element instanceof HTMLElement,
      );

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
      stopFonts = listenForFontLoads(requestRecompute);
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
      const slotProps: WrapClampSlotProps = {
        expand,
        collapse,
        toggle,
        clamped: renderedVisibleCount < items.length,
        expanded: expanded.value,
        hiddenItems: items.slice(renderedVisibleCount),
      };
      const beforeSlot = slots.before?.(slotProps);
      const afterSlot = slots.after?.(slotProps);
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

      for (let index = 0; index < renderedVisibleCount; index += 1) {
        const item = items[index];
        const itemSlotProps: WrapClampItemSlotProps = {
          item,
          index,
        };

        children.push(
          h(
            "span",
            {
              "data-part": "item",
              key: resolveItemKey(itemKey, item, index),
              style: itemStyle,
            },
            slots.item?.(itemSlotProps) ?? defaultItemText(item),
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
