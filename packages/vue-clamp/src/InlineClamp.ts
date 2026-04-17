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
import { ellipsisProp, locationProp } from "./props.ts";
import { normalizeLocationRatio, prepareText, searchClampedTextToFit } from "./text.ts";

import type { CSSProperties, PropType } from "vue";
import type { InlineClampSplit } from "./types.ts";

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
    const locationRatio = computed(() => normalizeLocationRatio(props.location));
    const visibleBody = ref(parts.value.body);
    let resizeObserver: ResizeObserver | null = null;
    let stopFonts = () => {};
    let lastLayoutSignature: string | null = null;

    function layoutSignature(): string {
      return combinedSizeSignature(rootRef.value?.parentElement ?? null, rootRef.value);
    }

    function clampBody(): string | null {
      const rootElement = rootRef.value;
      const bodyElement = bodyRef.value;
      const body = parts.value.body;

      if (!rootElement || !bodyElement) {
        return body;
      }

      bodyElement.textContent = body;

      const limit = rootElement.getBoundingClientRect().width;

      if (limit <= 0) {
        return null;
      }

      const fits = () => rootElement.scrollWidth <= limit + fitTolerance;

      if (fits()) {
        return body;
      }

      const prepared = prepareText(body);
      const nextBody = searchClampedTextToFit(
        prepared,
        locationRatio.value,
        props.ellipsis,
        (candidate) => {
          bodyElement.textContent = candidate;
          return fits();
        },
        "preserve-outer",
      );
      bodyElement.textContent = nextBody;

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
      [parts, () => props.ellipsis, () => props.location],
      () => {
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

export type { InlineClampParts, InlineClampProps, InlineClampSplit } from "./types.ts";
