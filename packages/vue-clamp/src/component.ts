import {
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
import type { CSSProperties, PropType } from "vue";
import { computeClampText, getSource } from "./clamp.ts";
import type { Source } from "./clamp.ts";
import {
  boxHeightOffset,
  contentWidth,
  fontShorthand,
  lineHeight,
  measureWidth,
  parsePx,
} from "./measurement.ts";
import { collectText } from "./slot-text.ts";
import type { ClampExposed, ClampLocation, ClampSlotScope } from "./types.ts";

const slotStyle: CSSProperties = {
  display: "inline-flex",
  flexWrap: "nowrap",
  maxWidth: "100%",
  whiteSpace: "nowrap",
  verticalAlign: "baseline",
};

const lineProbeStyle: CSSProperties = {
  position: "absolute",
  visibility: "hidden",
  pointerEvents: "none",
  whiteSpace: "nowrap",
};

function normalizeMaxHeight(value: number | string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return typeof value === "number" ? `${value}px` : value;
}

function normalizeMaxLines(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.max(1, Math.floor(value));
}

export const Clamp = defineComponent({
  name: "vue-clamp",
  inheritAttrs: false,
  props: {
    tag: {
      type: String,
      default: "div",
    },
    autoresize: {
      type: Boolean,
      default: false,
    },
    maxLines: Number,
    maxHeight: [Number, String] as PropType<number | string | undefined>,
    ellipsis: {
      type: String,
      default: "…",
    },
    location: {
      type: String as PropType<ClampLocation>,
      default: "end",
      validator(value: string) {
        return value === "start" || value === "middle" || value === "end";
      },
    },
    expanded: {
      type: Boolean,
      default: false,
    },
  },
  emits: {
    "update:expanded": (value: boolean) => typeof value === "boolean",
    clampchange: (value: boolean) => typeof value === "boolean",
  },
  setup(props, { attrs, emit, expose, slots }) {
    const rootRef = ref<HTMLElement | null>(null);
    const beforeRef = ref<HTMLElement | null>(null);
    const textRef = ref<HTMLElement | null>(null);
    const afterRef = ref<HTMLElement | null>(null);
    const lineProbeRef = ref<HTMLElement | null>(null);
    const displayText = ref("");
    const open = ref(props.expanded);
    const clamped = ref(false);
    const lineHeightPx = ref(0);
    const boxHeight = ref(0);
    const ready = ref(
      props.expanded || (props.maxLines === undefined && props.maxHeight === undefined),
    );

    let queued = false;
    let resizeObserver: ResizeObserver | null = null;
    let cleanupFonts: (() => void) | null = null;
    let emittedClamp: boolean | undefined;
    let slotSnapshotText = "";
    let sourceText = "";
    let preparedSource: Source | null = null;

    function hasLimit(): boolean {
      return props.maxLines !== undefined || props.maxHeight !== undefined;
    }

    function rootStyle(hidden: boolean): CSSProperties {
      if (open.value) {
        return {
          maxHeight: undefined,
          visibility: hidden ? "hidden" : undefined,
        };
      }

      const explicitMaxHeight = normalizeMaxHeight(props.maxHeight);
      const normalizedMaxLines = normalizeMaxLines(props.maxLines);
      let lineClampHeight: string | undefined;
      if (normalizedMaxLines !== undefined && lineHeightPx.value > 0) {
        lineClampHeight = `${normalizedMaxLines * lineHeightPx.value + boxHeight.value}px`;
      }

      let maxHeight = explicitMaxHeight ?? lineClampHeight;
      if (explicitMaxHeight && lineClampHeight) {
        maxHeight = `min(${explicitMaxHeight}, ${lineClampHeight})`;
      }

      return {
        maxHeight,
        overflow: "hidden",
        visibility: hidden ? "hidden" : undefined,
      };
    }

    function expand(): void {
      open.value = true;
    }

    function collapse(): void {
      open.value = false;
    }

    function toggle(): void {
      open.value = !open.value;
    }

    function recompute(): void {
      if (sourceText.length === 0 && slotSnapshotText.length > 0 && !open.value && hasLimit()) {
        return;
      }

      if (open.value || sourceText.length === 0 || !hasLimit()) {
        displayText.value = sourceText;
        clamped.value = false;
        ready.value = true;
        return;
      }

      const root = rootRef.value;
      const textEl = textRef.value;
      if (!root || !textEl) {
        clamped.value = false;
        return;
      }

      const maxHeight = parsePx(getComputedStyle(root).maxHeight);
      const nextBoxHeight = boxHeightOffset(root);
      const nextLineH = lineHeight(textEl, lineProbeRef.value);
      const nextFont = fontShorthand(getComputedStyle(textEl));

      if (nextLineH > 0) {
        lineHeightPx.value = nextLineH;
      }
      if (boxHeight.value !== nextBoxHeight) {
        boxHeight.value = nextBoxHeight;
      }

      const maxWidth = contentWidth(root);
      if (maxWidth <= 0 || nextLineH <= 0) {
        clamped.value = false;
        return;
      }

      preparedSource = getSource(preparedSource, sourceText, nextFont);

      const result = computeClampText({
        source: preparedSource,
        containerWidth: maxWidth,
        lineHeight: nextLineH,
        location: props.location,
        ellipsis: props.ellipsis,
        beforeWidth: measureWidth(beforeRef.value),
        afterWidth: measureWidth(afterRef.value),
        maxLines: props.maxLines,
        maxHeight,
      });

      displayText.value = result.displayText;
      clamped.value = result.clamped;
      ready.value = true;
    }

    function queue(): void {
      if (queued) {
        return;
      }

      queued = true;

      queueMicrotask(() => {
        queued = false;
        recompute();
      });
    }

    function syncText(nextValue: string, syncNow = false): void {
      const nextText = nextValue.trim();
      if (sourceText === nextText) {
        return;
      }

      sourceText = nextText;
      if (nextText.length === 0) {
        preparedSource = null;
      }

      if (open.value || nextText.length === 0 || !hasLimit()) {
        displayText.value = nextText;
        clamped.value = false;
        ready.value = true;
        return;
      }

      if (syncNow) {
        recompute();
        return;
      }

      queue();
    }

    watch(
      () => props.expanded,
      (value) => {
        open.value = value;
      },
    );

    watch(open, (value) => {
      if (props.expanded !== value) {
        emit("update:expanded", value);
      }
      queue();
    });

    watch(
      () => [props.maxLines, props.maxHeight, props.ellipsis, props.location],
      () => {
        queue();
      },
      { flush: "post" },
    );

    watch(
      [clamped, ready],
      ([value, nextReady]) => {
        if (!nextReady || emittedClamp === value) {
          return;
        }

        emittedClamp = value;
        void nextTick(() => emit("clampchange", value));
      },
      { immediate: true },
    );

    watchPostEffect((onCleanup) => {
      if (typeof ResizeObserver === "undefined") {
        return;
      }

      resizeObserver ??= new ResizeObserver(() => {
        queue();
      });

      const observedElements: Element[] = [];
      if (rootRef.value && (props.autoresize || !ready.value)) {
        observedElements.push(rootRef.value);
      }
      if (beforeRef.value) {
        observedElements.push(beforeRef.value);
      }
      if (afterRef.value) {
        observedElements.push(afterRef.value);
      }

      for (const element of observedElements) {
        resizeObserver.observe(element);
      }

      queue();

      onCleanup(() => {
        for (const element of observedElements) {
          resizeObserver?.unobserve(element);
        }
      });
    });

    onMounted(() => {
      syncText(slotSnapshotText, true);

      const fontFaceSet = document.fonts;
      if (!fontFaceSet) {
        return;
      }

      const handleFontLoad = () => {
        queue();
      };

      void fontFaceSet.ready.then(handleFontLoad);
      fontFaceSet.addEventListener?.("loadingdone", handleFontLoad);
      cleanupFonts = () => {
        fontFaceSet.removeEventListener?.("loadingdone", handleFontLoad);
      };
    });

    onUpdated(() => {
      syncText(slotSnapshotText);
    });

    onBeforeUnmount(() => {
      resizeObserver?.disconnect();
      cleanupFonts?.();
    });

    expose({
      expand,
      collapse,
      toggle,
      get clamped() {
        return clamped.value;
      },
      get expanded() {
        return open.value;
      },
    } satisfies ClampExposed);

    return () => {
      const nextSlotText = collectText(slots.default?.());
      slotSnapshotText = nextSlotText;
      const slotScope: ClampSlotScope = {
        expand,
        collapse,
        toggle,
        clamped: clamped.value,
        expanded: open.value,
      };
      const hasLimitNow = hasLimit();
      const hidden = !ready.value && !open.value && hasLimitNow && nextSlotText.length > 0;

      const shouldRenderSourceText =
        open.value || nextSlotText.length === 0 || !hasLimitNow || displayText.value.length === 0;
      const renderedText = shouldRenderSourceText ? nextSlotText : displayText.value;
      const beforeSlot = slots.before?.(slotScope);
      const afterSlot = slots.after?.(slotScope);

      return h(
        props.tag,
        mergeProps(attrs, {
          ref: rootRef,
          style: rootStyle(hidden),
        }),
        [
          h("span", null, [
            beforeSlot
              ? h(
                  "span",
                  {
                    ref: beforeRef,
                    style: slotStyle,
                  },
                  beforeSlot,
                )
              : null,
            h(
              "span",
              {
                ref: textRef,
                role: "text",
                "aria-label": nextSlotText,
              },
              renderedText,
            ),
            afterSlot
              ? h(
                  "span",
                  {
                    ref: afterRef,
                    style: slotStyle,
                  },
                  afterSlot,
                )
              : null,
          ]),
          h(
            "span",
            {
              ref: lineProbeRef,
              "aria-hidden": "true",
              style: lineProbeStyle,
            },
            "M",
          ),
        ],
      );
    };
  },
});

export default Clamp;
