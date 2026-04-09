import {
  computed,
  defineComponent,
  h,
  mergeProps,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUpdated,
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
import {
  canUseNativeClamp,
  clampTextToLayout,
  isNativeClamped,
  normalizeLocationRatio,
  prepareText,
} from "./text.ts";

import type { CSSProperties, PropType, VNodeChild } from "vue";
import type { LineClampExposed, LineClampLocation, LineClampSlotProps } from "./types.ts";

const slotStyle: CSSProperties = {
  display: "inline-flex",
  flexWrap: "nowrap",
  maxWidth: "100%",
  whiteSpace: "nowrap",
  verticalAlign: "baseline",
};

const nativeContentStyle: CSSProperties = {
  alignItems: "baseline",
  display: "inline-flex",
  maxWidth: "100%",
  verticalAlign: "baseline",
  width: "100%",
};

const nativeTextStyle: CSSProperties = {
  display: "block",
  overflow: "hidden",
  overflowWrap: "normal",
  whiteSpace: "nowrap",
};

const nativeTextContainerStyle: CSSProperties = {
  display: "block",
  flex: "1 1 auto",
  minWidth: "0",
};

const nativeSlotStyle: CSSProperties = {
  ...slotStyle,
  flex: "none",
};

const visuallyHiddenTextStyle: CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  overflow: "hidden",
  whiteSpace: "nowrap",
  clipPath: "inset(50%)",
};

const lineClampProps = {
  as: {
    type: String,
    default: "div",
  },
  text: {
    type: String,
    default: "",
  },
  maxLines: Number,
  maxHeight: [Number, String] as PropType<number | string | undefined>,
  ellipsis: {
    type: String,
    default: "…",
  },
  location: {
    type: [String, Number] as PropType<LineClampLocation>,
    default: "end",
    validator(value: unknown) {
      return (
        value === "start" ||
        value === "middle" ||
        value === "end" ||
        (typeof value === "number" && Number.isFinite(value))
      );
    },
  },
  expanded: {
    type: Boolean,
    default: false,
  },
} as const;

const lineClampEmits = {
  "update:expanded": (value: boolean) => typeof value === "boolean",
  clampchange: (value: boolean) => typeof value === "boolean",
};

export const LineClamp = defineComponent({
  name: "LineClamp",
  inheritAttrs: false,
  props: lineClampProps,
  emits: lineClampEmits,
  setup(props, { attrs, emit, expose, slots }) {
    const rootRef = ref<HTMLElement | null>(null);
    const contentRef = ref<HTMLElement | null>(null);
    const beforeRef = ref<HTMLElement | null>(null);
    const bodyRef = ref<HTMLElement | null>(null);
    const textRef = ref<HTMLElement | null>(null);
    const afterRef = ref<HTMLElement | null>(null);
    const visibleText = ref(props.text);
    const expanded = ref(props.expanded);
    const isClamped = ref(false);

    const lineLimit = computed(() => normalizeLineLimit(props.maxLines));
    const hasLimit = computed(() => lineLimit.value !== undefined || props.maxHeight !== undefined);
    const locationRatio = computed(() => normalizeLocationRatio(props.location));
    const preparedText = computed(() => prepareText(props.text));
    const nativeOverflowMode = computed(() =>
      canUseNativeClamp(
        expanded.value,
        lineLimit.value,
        props.maxHeight,
        locationRatio.value,
        props.ellipsis,
      ),
    );

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

    async function applyTextState(nextText: string, nextClamped: boolean): Promise<void> {
      const changed = visibleText.value !== nextText || isClamped.value !== nextClamped;

      visibleText.value = nextText;
      isClamped.value = nextClamped;

      if (changed) {
        await nextTick();
      }
    }

    async function resetClamp(): Promise<void> {
      await applyTextState(props.text, false);
    }

    function layoutSignature(): string {
      return combinedSizeSignature(
        rootRef.value,
        contentRef.value,
        bodyRef.value,
        beforeRef.value,
        afterRef.value,
      );
    }

    async function recompute(): Promise<void> {
      if (expanded.value || props.text.length === 0 || !hasLimit.value) {
        await resetClamp();
        return;
      }

      const rootElement = rootRef.value;
      const contentElement = contentRef.value;
      const textElement = textRef.value;

      if (!rootElement || !contentElement || !textElement) {
        await resetClamp();
        return;
      }

      if (nativeOverflowMode.value) {
        const nextClamped = isNativeClamped(textElement);
        await applyTextState(props.text, nextClamped ?? false);
        return;
      }

      const nextText = clampTextToLayout(
        preparedText.value,
        rootElement,
        contentElement,
        textElement,
        locationRatio.value,
        props.ellipsis,
        lineLimit.value,
        props.maxHeight,
      );

      if (nextText === null) {
        await resetClamp();
        return;
      }

      await applyTextState(nextText, nextText !== preparedText.value.text);
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
      [
        () => props.text,
        () => props.maxLines,
        () => props.maxHeight,
        () => props.ellipsis,
        () => props.location,
      ],
      () => {
        visibleText.value = props.text;
        queueRecompute();
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
          queueRecompute();
        }
      });

      const observed = [
        rootRef.value,
        contentRef.value,
        bodyRef.value,
        beforeRef.value,
        afterRef.value,
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

    onUpdated(() => {
      if (layoutSignature() !== lastLayoutSignature) {
        queueRecompute();
      }
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
    } satisfies LineClampExposed);

    return () => {
      const collapsedMaxHeight = !expanded.value ? cssLength(props.maxHeight) : undefined;

      const slotProps: LineClampSlotProps = {
        expand,
        collapse,
        toggle,
        clamped: isClamped.value,
        expanded: expanded.value,
      };
      const beforeSlot = slots.before?.(slotProps);
      const afterSlot = slots.after?.(slotProps);
      const hasBeforeSlot = hasSlotContent(beforeSlot);
      const hasAfterSlot = hasSlotContent(afterSlot);
      const nativeOverflow = nativeOverflowMode.value;
      const needsAccessibleSourceText =
        !nativeOverflow && visibleText.value !== props.text && hasLimit.value && !expanded.value;
      const bodyStyle = nativeOverflow ? nativeTextContainerStyle : { position: "relative" };
      const shouldRenderFullText =
        nativeOverflow || expanded.value || visibleText.value.length === 0 || !hasLimit.value;
      const renderedText = shouldRenderFullText ? props.text : visibleText.value;
      const bodyChildren: VNodeChild[] = [
        needsAccessibleSourceText
          ? h(
              "span",
              {
                style: visuallyHiddenTextStyle,
              },
              props.text,
            )
          : null,
        h(
          "span",
          {
            key: "text",
            ref: textRef,
            "aria-hidden": needsAccessibleSourceText ? "true" : undefined,
            style: nativeOverflow
              ? {
                  ...nativeTextStyle,
                  textOverflow: nativeOverflow,
                }
              : undefined,
          },
          renderedText,
        ),
      ];

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
            ref: contentRef,
            style: nativeOverflow ? nativeContentStyle : undefined,
          },
          [
            hasBeforeSlot
              ? h(
                  "span",
                  {
                    "data-part": "before",
                    ref: beforeRef,
                    style: nativeOverflow ? nativeSlotStyle : slotStyle,
                  },
                  beforeSlot,
                )
              : null,
            h(
              "span",
              {
                "data-part": "body",
                ref: bodyRef,
                style: bodyStyle,
              },
              bodyChildren,
            ),
            hasAfterSlot
              ? h(
                  "span",
                  {
                    "data-part": "after",
                    ref: afterRef,
                    style: nativeOverflow ? nativeSlotStyle : slotStyle,
                  },
                  afterSlot,
                )
              : null,
          ],
        ),
      );
    };
  },
});
