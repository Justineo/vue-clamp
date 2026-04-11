import {
  computed,
  defineComponent,
  h,
  mergeProps,
  nextTick,
  ref,
  watch,
  watchPostEffect,
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

    async function resetClamp(nextFallback = false): Promise<void> {
      await applyHtmlState(props.html, false, nextFallback);
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
      queueRecompute,
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
          await resetClamp();
          return;
        }

        const rootElement = rootRef.value;
        const contentElement = contentRef.value;
        const htmlElement = htmlRef.value;
        const prepared = preparedHtml.value;

        if (!rootElement || !contentElement || !htmlElement || !prepared) {
          await resetClamp();
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
          await resetClamp();
          return;
        }

        await applyHtmlState(nextState.html, nextState.html !== prepared.html, nextState.fallback);
      },
    });

    watch(
      [() => props.html, () => props.maxLines, () => props.maxHeight, () => props.ellipsis],
      () => {
        visibleHtml.value = props.html;
        isFallback.value = false;
        queueRecompute();
      },
      { flush: "post" },
    );

    watchPostEffect((onCleanup) => {
      const htmlElement = htmlRef.value;
      if (!htmlElement) {
        return;
      }

      const images = Array.from(htmlElement.querySelectorAll("img")).filter(
        (element): element is HTMLImageElement => element instanceof HTMLImageElement,
      );

      function handleImageChange(): void {
        queueRecompute();
      }

      for (const image of images) {
        if (image.complete) {
          continue;
        }

        image.addEventListener("load", handleImageChange);
        image.addEventListener("error", handleImageChange);
      }

      onCleanup(() => {
        for (const image of images) {
          image.removeEventListener("load", handleImageChange);
          image.removeEventListener("error", handleImageChange);
        }
      });
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
