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
  createQueuedTask,
  cssLength,
  listenForFontLoads,
  normalizeLineLimit,
} from "./layout.ts";
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

const wrapItemStyle: CSSProperties = {
  display: "inline-flex",
  maxWidth: "100%",
  verticalAlign: "baseline",
  whiteSpace: "nowrap",
};

const wrapContentStyle: CSSProperties = {
  display: "inline-flex",
  flexWrap: "wrap",
  maxWidth: "100%",
  width: "100%",
};

const wrapClampProps = {
  as: {
    type: String,
    default: "div",
  },
  items: {
    type: Array as PropType<readonly unknown[]>,
    default: () => [],
  },
  itemKey: [String, Function] as PropType<string | ItemKeyResolver | undefined>,
  maxLines: Number,
  maxHeight: [Number, String] as PropType<number | string | undefined>,
  expanded: {
    type: Boolean,
    default: false,
  },
} as const;

const wrapClampEmits = {
  "update:expanded": (value: boolean) => typeof value === "boolean",
  clampchange: (value: boolean) => typeof value === "boolean",
};

function resolveItemKey(
  itemKey: string | ItemKeyResolver | undefined,
  item: unknown,
  index: number,
): string | number {
  if (typeof itemKey === "function") {
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

function contentElement(rootElement: HTMLElement | null): HTMLElement | null {
  const content = rootElement?.firstElementChild;
  return content instanceof HTMLElement ? content : null;
}

function slotElement(
  contentElement: HTMLElement | null,
  part: "before" | "after",
): HTMLElement | null {
  if (!contentElement) {
    return null;
  }

  for (const child of contentElement.children) {
    if (child instanceof HTMLElement && child.dataset.part === part) {
      return child;
    }
  }

  return null;
}

function measureSequence(
  rootElement: HTMLElement,
  lineLimit: number | undefined,
  clipToRootHeight: boolean,
): SequenceMeasurement {
  const content = contentElement(rootElement);
  let visibleTop = 0;
  let visibleBottom = 0;

  if (clipToRootHeight) {
    const rootRect = rootElement.getBoundingClientRect();
    visibleTop = rootRect.top + rootElement.clientTop;
    visibleBottom = visibleTop + rootElement.clientHeight;
  }

  let lineCount = 0;
  let previousTop: number | null = null;
  let visibleItems = 0;

  if (!content) {
    return {
      allFit: true,
      visibleItems: 0,
    };
  }

  for (const child of content.children) {
    if (!(child instanceof HTMLElement)) {
      continue;
    }

    const part = child.dataset.part;
    if (part !== "before" && part !== "item" && part !== "after") {
      continue;
    }

    const rect = child.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      continue;
    }

    if (previousTop === null || Math.abs(rect.top - previousTop) > 0.5) {
      lineCount += 1;
      previousTop = rect.top;
    }

    if (lineLimit !== undefined && lineCount > lineLimit) {
      return {
        allFit: false,
        visibleItems,
      };
    }

    if (clipToRootHeight && (rect.top < visibleTop - 0.5 || rect.bottom > visibleBottom + 0.5)) {
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
  props: wrapClampProps,
  emits: wrapClampEmits,
  setup(props, { attrs, emit, expose, slots }) {
    const rootRef = ref<HTMLElement | null>(null);
    const expanded = ref(props.expanded);
    const visibleCount = ref(props.items.length);
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
      const normalizedVisibleCount = Math.max(0, Math.min(props.items.length, nextVisibleCount));
      const nextClamped = normalizedVisibleCount < props.items.length;
      const changed =
        visibleCount.value !== normalizedVisibleCount || isClamped.value !== nextClamped;

      visibleCount.value = normalizedVisibleCount;
      isClamped.value = nextClamped;

      if (changed) {
        await nextTick();
      }
    }

    function layoutSignature(): string {
      const content = contentElement(rootRef.value);

      return combinedSizeSignature(
        rootRef.value,
        content,
        slotElement(content, "before"),
        slotElement(content, "after"),
      );
    }

    function slotPropsForCount(nextVisibleCount: number): WrapClampSlotProps {
      const hiddenItems = props.items.slice(nextVisibleCount);

      return {
        expand,
        collapse,
        toggle,
        clamped: nextVisibleCount < props.items.length,
        expanded: expanded.value,
        hiddenItems,
      };
    }

    async function settleVisibleCount(
      rootElement: HTMLElement,
      lineLimit: number | undefined,
      clipToRootHeight: boolean,
    ): Promise<void> {
      let measurement = measureSequence(rootElement, lineLimit, clipToRootHeight);

      while (
        visibleCount.value > 0 &&
        (!measurement.allFit || measurement.visibleItems < visibleCount.value)
      ) {
        await applyVisibleCount(Math.min(measurement.visibleItems, visibleCount.value - 1));
        measurement = measureSequence(rootElement, lineLimit, clipToRootHeight);
      }

      while (
        measurement.allFit &&
        measurement.visibleItems === visibleCount.value &&
        visibleCount.value < props.items.length
      ) {
        const currentVisibleCount = visibleCount.value;
        await applyVisibleCount(currentVisibleCount + 1);
        measurement = measureSequence(rootElement, lineLimit, clipToRootHeight);

        if (!measurement.allFit || measurement.visibleItems < currentVisibleCount + 1) {
          await applyVisibleCount(currentVisibleCount);
          return;
        }
      }
    }

    async function recompute(): Promise<void> {
      const totalItems = props.items.length;
      const lineLimit = normalizeLineLimit(props.maxLines);
      const clipToRootHeight = props.maxHeight !== undefined;
      const hasLimit = lineLimit !== undefined || clipToRootHeight;

      if (expanded.value || totalItems === 0 || !hasLimit) {
        await applyVisibleCount(totalItems);
        return;
      }

      const rootElement = rootRef.value;
      if (!rootElement || rootElement.getBoundingClientRect().width <= 0) {
        await applyVisibleCount(totalItems);
        return;
      }

      await applyVisibleCount(Math.min(visibleCount.value, totalItems));
      await settleVisibleCount(rootElement, lineLimit, clipToRootHeight);
    }

    const queueRecompute = createQueuedTask(async () => {
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

        queueRecompute();
      },
      { flush: "post" },
    );

    watch(
      [() => props.maxLines, () => props.maxHeight, () => props.itemKey, () => props.items],
      () => {
        queueRecompute();
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
          queueRecompute();
        }
      });

      const content = contentElement(rootRef.value);
      const observed = [
        rootRef.value,
        content,
        slotElement(content, "before"),
        slotElement(content, "after"),
      ].filter((element): element is HTMLElement => element instanceof HTMLElement);

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
      queueRecompute();
      stopFonts = listenForFontLoads(queueRecompute);
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
      const collapsedMaxHeight = !expanded.value ? cssLength(props.maxHeight) : undefined;

      const renderedVisibleCount = Math.min(visibleCount.value, props.items.length);
      const slotProps = slotPropsForCount(renderedVisibleCount);
      const beforeSlot = slots.before?.(slotProps);
      const afterSlot = slots.after?.(slotProps);
      const children: VNodeChild[] = [];

      if (hasSlotContent(beforeSlot)) {
        children.push(h("span", { "data-part": "before", style: wrapItemStyle }, beforeSlot));
      }

      for (let index = 0; index < renderedVisibleCount; index += 1) {
        const item = props.items[index];
        const itemSlotProps: WrapClampItemSlotProps = {
          item,
          index,
        };

        children.push(
          h(
            "span",
            {
              "data-part": "item",
              key: resolveItemKey(props.itemKey, item, index),
              style: wrapItemStyle,
            },
            slots.item?.(itemSlotProps) ?? defaultItemText(item),
          ),
        );
      }

      if (hasSlotContent(afterSlot)) {
        children.push(h("span", { "data-part": "after", style: wrapItemStyle }, afterSlot));
      }

      return h(
        props.as,
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
            style: wrapContentStyle,
          },
          children,
        ),
      );
    };
  },
});

export type {
  WrapClampExposed,
  WrapClampItemKey,
  WrapClampItemSlotProps,
  WrapClampProps,
  WrapClampSlotProps,
} from "./types.ts";
