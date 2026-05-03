import {
  computed,
  defineComponent,
  h,
  mergeProps,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  ref,
  watch,
  watchPostEffect,
} from "vue";
import { combinedSizeSignature, createCoalescingRunner, listenForFontLoads } from "./layout.ts";
import { boundaryProp, ellipsisProp, locationProp } from "./props.ts";
import { normalizeLocationRatio, prepareText, clampTextToFit } from "./text.ts";

import type { CSSProperties, PropType } from "vue";
import type { InlineClampSplit } from "./types.ts";
import type { TextClampResult } from "./text.ts";

// InlineClamp measures a single inline-block because affixes and middle
// truncation cannot be represented by native text-overflow.
const rootStyle: CSSProperties = {
  display: "inline-block",
  maxWidth: "100%",
  minWidth: "0",
  overflow: "hidden",
  position: "relative",
  whiteSpace: "nowrap",
  verticalAlign: "baseline",
};

const visuallyHiddenTextStyle: CSSProperties = {
  clipPath: "inset(50%)",
  height: "1px",
  overflow: "hidden",
  position: "absolute",
  whiteSpace: "nowrap",
  width: "1px",
};

const fitTolerance = 0.5;

const propsDef = {
  as: {
    type: String,
    default: "span",
  },
  text: {
    type: String,
    required: true,
  },
  ellipsis: ellipsisProp,
  location: locationProp,
  boundary: boundaryProp,
  split: Function as PropType<InlineClampSplit | undefined>,
} as const;

export const InlineClamp = defineComponent({
  name: "InlineClamp",
  inheritAttrs: false,
  props: propsDef,
  setup(props, { attrs }) {
    const rootRef = ref<HTMLElement | null>(null);
    const bodyRef = ref<HTMLElement | null>(null);
    const parts = computed(() => props.split?.(props.text) ?? { body: props.text });
    const preparedBody = computed(() => prepareText(parts.value.body, props.boundary));
    const locationRatio = computed(() => normalizeLocationRatio(props.location));
    const visibleBody = ref(parts.value.body);
    let resizeObserver: ResizeObserver | null = null;
    let stopFonts = () => {};
    let lastLayoutSignature: string | null = null;
    let lastTextClamp: TextClampResult | null = null;

    function layoutSignature(): string {
      // The parent controls available inline width while the root records the
      // rendered result; observing both catches shrink and grow transitions.
      return combinedSizeSignature(rootRef.value?.parentElement ?? null, rootRef.value);
    }

    function clampBody(): string | null {
      const rootElement = rootRef.value;
      const bodyElement = bodyRef.value;
      const body = parts.value.body;

      if (!rootElement || !bodyElement) {
        return body;
      }

      // Always restore the full body before measuring. Otherwise a previously
      // shortened inline-block could become the stale width limit after growth.
      bodyElement.textContent = body;

      const limit = rootElement.getBoundingClientRect().width;

      if (limit <= 0) {
        // Do not replace visible text with a zero-width guess during mount or
        // hidden layout states.
        return null;
      }

      const fits = () => rootElement.scrollWidth <= limit + fitTolerance;
      const prepared = preparedBody.value;
      const ratio = locationRatio.value;

      if (fits()) {
        // Store the full body as the next warm-start point so a following shrink
        // starts from the real upper bound.
        lastTextClamp = {
          boundaryOffsets: prepared.boundaryOffsets,
          kept: prepared.boundaryOffsets.length - 1,
          text: body,
        };
        return body;
      }

      const nextResult = clampTextToFit({
        ellipsis: props.ellipsis,
        fit: {
          apply(candidate) {
            bodyElement.textContent = candidate;
          },
          fits,
        },
        hint: lastTextClamp,
        prepared,
        ratio,
        // Split affixes already own the outer spacing; preserve spaces at the
        // body edges so custom split functions keep browser-like inline flow.
        spacing: "preserve-outer",
      });
      const nextBody = nextResult.text;
      lastTextClamp = nextResult;

      return nextBody;
    }

    const requestRecompute = createCoalescingRunner(async () => {
      const nextBody = clampBody();

      if (nextBody !== null && visibleBody.value !== nextBody) {
        visibleBody.value = nextBody;
      }

      lastLayoutSignature = layoutSignature();
    });

    watch(
      [parts, () => props.ellipsis, () => props.location, () => props.boundary],
      () => {
        // A split or semantic prop change means the previous boundary hint may
        // refer to a different body string.
        lastTextClamp = null;
        visibleBody.value = parts.value.body;
        requestRecompute();
      },
      { flush: "post" },
    );

    watchPostEffect((onCleanup) => {
      const rootElement = rootRef.value;

      if (!rootElement) {
        return;
      }

      const observed = [rootElement.parentElement, rootElement].filter(
        (element): element is HTMLElement => element instanceof HTMLElement,
      );

      resizeObserver ??= new ResizeObserver(() => {
        if (layoutSignature() !== lastLayoutSignature) {
          // Width-only changes are the hot path, so recompute only when the
          // coarse dimensions actually changed.
          requestRecompute();
        }
      });

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

    onUpdated(() => {
      if (layoutSignature() !== lastLayoutSignature) {
        // Vue-driven style changes can happen before ResizeObserver delivery; keep
        // the final clamped text in the same update cycle.
        requestRecompute();
      }
    });

    onBeforeUnmount(() => {
      resizeObserver?.disconnect();
      stopFonts();
    });

    return () => {
      const { as } = props;
      const currentParts = parts.value;
      const isRewritten = visibleBody.value !== currentParts.body;
      const ariaHidden = isRewritten ? "true" : undefined;

      // The accessible fallback uses the full original text, including split
      // affixes, so screen readers do not receive the visual ellipsis rewrite.
      return h(
        as,
        mergeProps(attrs, {
          "data-part": "root",
          ref: rootRef,
          style: rootStyle,
        }),
        [
          isRewritten
            ? h(
                "span",
                {
                  style: visuallyHiddenTextStyle,
                },
                props.text,
              )
            : null,
          currentParts.start
            ? h(
                "span",
                {
                  "aria-hidden": ariaHidden,
                  "data-part": "start",
                },
                currentParts.start,
              )
            : null,
          h(
            "span",
            {
              "aria-hidden": ariaHidden,
              "data-part": "body",
              ref: bodyRef,
            },
            visibleBody.value,
          ),
          currentParts.end
            ? h(
                "span",
                {
                  "aria-hidden": ariaHidden,
                  "data-part": "end",
                },
                currentParts.end,
              )
            : null,
        ],
      );
    };
  },
});
