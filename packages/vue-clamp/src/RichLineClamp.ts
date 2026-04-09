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

const richClampProps = {
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

const richClampEmits = {
  "update:expanded": (value: boolean) => typeof value === "boolean",
  clampchange: (value: boolean) => typeof value === "boolean",
};

export const RichLineClamp = defineComponent({
  name: "RichLineClamp",
  inheritAttrs: false,
  props: richClampProps,
  emits: richClampEmits,
  setup(props, { attrs, emit, expose, slots }) {
    const rootRef = ref<HTMLElement | null>(null);
    const contentRef = ref<HTMLElement | null>(null);
    const beforeRef = ref<HTMLElement | null>(null);
    const bodyRef = ref<HTMLElement | null>(null);
    const htmlRef = ref<HTMLElement | null>(null);
    const afterRef = ref<HTMLElement | null>(null);
    const visibleHtml = ref(props.html);
    const expanded = ref(props.expanded);
    const isClamped = ref(false);
    const isFallback = ref(false);

    const lineLimit = computed(() => normalizeLineLimit(props.maxLines));
    const hasLimit = computed(() => lineLimit.value !== undefined || props.maxHeight !== undefined);
    const preparedHtml = computed(() => prepareRichText(props.html));

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
      if (expanded.value || props.html.length === 0 || !hasLimit.value) {
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
        props.ellipsis,
        lineLimit.value,
        props.maxHeight,
      );

      if (nextState.html === null) {
        await resetClamp();
        return;
      }

      await applyHtmlState(nextState.html, nextState.html !== prepared.html, nextState.fallback);
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
      [() => props.html, () => props.maxLines, () => props.maxHeight, () => props.ellipsis],
      () => {
        visibleHtml.value = props.html;
        isFallback.value = false;
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
    } satisfies RichLineClampExposed);

    return () => {
      const collapsedMaxHeight =
        !expanded.value && !isFallback.value ? cssLength(props.maxHeight) : undefined;

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
        props.as,
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
                  innerHTML: expanded.value || !hasLimit.value ? props.html : visibleHtml.value,
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
