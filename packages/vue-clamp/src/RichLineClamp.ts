import {
  computed,
  defineComponent,
  h,
  mergeProps,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
} from "vue";
import { cssLength, normalizeLineLimit } from "./layout.ts";
import { useMultilineClamp } from "./multiline.ts";
import { clampRichTextToLayout, prepareRichText } from "./rich.ts";
import { hasSlotContent } from "./slot.ts";

import type { CSSProperties, PropType } from "vue";
import type { RichLineClampExposed, RichLineClampSlotProps } from "./types.ts";

const slotStyle: CSSProperties = {
  display: "inline-flex",
  flexWrap: "nowrap",
  maxWidth: "100%",
  whiteSpace: "nowrap",
  verticalAlign: "baseline",
};

const propsDef = {
  as: {
    type: String,
    default: "div",
  },
  html: {
    type: String,
    required: true,
  },
  maxLines: Number,
  maxHeight: [Number, String] as PropType<number | string | undefined>,
  ellipsis: {
    type: String,
    default: "…",
  },
  expanded: {
    type: Boolean,
    default: false,
  },
} as const;

const emitsDef = {
  "update:expanded": (value: boolean) => typeof value === "boolean",
  clampchange: (value: boolean) => typeof value === "boolean",
};

function hasStableImageBox(image: HTMLImageElement): boolean {
  const { height, width } = getComputedStyle(image);
  return Number.parseFloat(width) > 0 && Number.parseFloat(height) > 0;
}

export const RichLineClamp = defineComponent({
  name: "RichLineClamp",
  inheritAttrs: false,
  props: propsDef,
  emits: emitsDef,
  setup(props, { attrs, emit, expose, slots }) {
    const htmlRef = ref<HTMLElement | null>(null);
    const visibleHtml = ref(props.html);
    const isFallback = ref(false);

    const lineLimit = computed(() => normalizeLineLimit(props.maxLines));
    const hasLimit = computed(() => lineLimit.value !== undefined || props.maxHeight !== undefined);
    const preparedHtml = computed(() => prepareRichText(props.html));
    let imageAbortController: AbortController | null = null;
    let pendingImages = new Set<HTMLImageElement>();

    function stopTrackingImages(): void {
      imageAbortController?.abort();
      imageAbortController = null;
      pendingImages.clear();
    }

    function settleTrackedImage(image: HTMLImageElement): void {
      if (!pendingImages.delete(image) || pendingImages.size > 0) {
        return;
      }

      stopTrackingImages();
      requestRecompute();
    }

    function trackCurrentImages(): void {
      stopTrackingImages();

      const htmlElement = htmlRef.value;
      if (!htmlElement) {
        return;
      }

      const images = [...htmlElement.querySelectorAll("img")].filter(
        (element): element is HTMLImageElement =>
          element instanceof HTMLImageElement && !element.complete && !hasStableImageBox(element),
      );
      if (images.length === 0) {
        return;
      }

      const controller = new AbortController();
      const { signal } = controller;

      imageAbortController = controller;
      pendingImages = new Set(images);

      for (const image of images) {
        const handleImageSettle = (): void => {
          if (signal.aborted) {
            return;
          }

          settleTrackedImage(image);
        };

        image.addEventListener("load", handleImageSettle, { once: true, signal });
        image.addEventListener("error", handleImageSettle, { once: true, signal });

        if (image.complete) {
          settleTrackedImage(image);
        }
      }
    }

    function resetRichState(): Promise<void> {
      stopTrackingImages();
      return resetClamp();
    }

    async function applyHtmlState(
      nextHtml: string,
      nextClamped: boolean,
      nextFallback: boolean,
    ): Promise<void> {
      const changed =
        visibleHtml.value !== nextHtml ||
        isClamped.value !== nextClamped ||
        isFallback.value !== nextFallback;

      visibleHtml.value = nextHtml;
      isClamped.value = nextClamped;
      isFallback.value = nextFallback;

      if (changed) {
        await nextTick();
      }
    }

    async function resetClamp(): Promise<void> {
      return applyHtmlState(props.html, false, false);
    }

    const {
      rootRef,
      contentRef,
      beforeRef,
      bodyRef,
      afterRef,
      expanded,
      isClamped,
      expand,
      collapse,
      toggle,
      requestRecompute,
    } = useMultilineClamp({
      getExpanded: () => props.expanded,
      onExpandedChange: (value) => {
        emit("update:expanded", value);
      },
      onClampedChange: (value) => {
        emit("clampchange", value);
      },
      recompute: async ({ expanded }): Promise<void> => {
        const { ellipsis, html: sourceHtml, maxHeight } = props;
        if (expanded.value || sourceHtml.length === 0 || !hasLimit.value) {
          await resetRichState();
          return;
        }

        const rootElement = rootRef.value;
        const contentElement = contentRef.value;
        const htmlElement = htmlRef.value;
        const prepared = preparedHtml.value;

        if (!rootElement || !contentElement || !htmlElement || !prepared) {
          await resetRichState();
          return;
        }

        const nextState = clampRichTextToLayout(
          prepared,
          rootElement,
          contentElement,
          htmlElement,
          ellipsis,
          lineLimit.value,
          maxHeight,
        );

        if (nextState.html === null) {
          await resetRichState();
          return;
        }

        await applyHtmlState(nextState.html, nextState.html !== prepared.html, nextState.fallback);

        if (nextState.fallback) {
          stopTrackingImages();
        } else {
          trackCurrentImages();
        }
      },
    });

    watch(
      [() => props.html, () => props.maxLines, () => props.maxHeight, () => props.ellipsis],
      () => {
        visibleHtml.value = props.html;
        isFallback.value = false;
        requestRecompute();
      },
      { flush: "post" },
    );

    onBeforeUnmount(() => {
      stopTrackingImages();
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
    } satisfies RichLineClampExposed);

    return () => {
      const { as: rootTag, html: sourceHtml, maxHeight } = props;
      const collapsedMaxHeight =
        !expanded.value && !isFallback.value ? cssLength(maxHeight) : undefined;

      const slotProps: RichLineClampSlotProps = {
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

      return h(
        rootTag,
        mergeProps(attrs, {
          "data-part": "root",
          ref: rootRef,
          style: {
            maxHeight: collapsedMaxHeight,
            overflow: collapsedMaxHeight ? "hidden" : undefined,
          },
        }),
        h(
          "span",
          {
            "data-part": "content",
            ref: contentRef,
          },
          [
            hasBeforeSlot
              ? h(
                  "span",
                  {
                    "data-part": "before",
                    ref: beforeRef,
                    style: slotStyle,
                  },
                  beforeSlot,
                )
              : null,
            h(
              "span",
              {
                "data-part": "body",
                ref: bodyRef,
              },
              [
                h("span", {
                  key: "html",
                  ref: htmlRef,
                  innerHTML: expanded.value || !hasLimit.value ? sourceHtml : visibleHtml.value,
                }),
              ],
            ),
            hasAfterSlot
              ? h(
                  "span",
                  {
                    "data-part": "after",
                    ref: afterRef,
                    style: slotStyle,
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
