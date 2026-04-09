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
import { createQueuedTask, normalizeLineLimit, sizeSignature } from "./layout.ts";
import { clampRichTextToLayout, prepareRichText } from "./rich.ts";
import { hasSlotContent } from "./slot.ts";

import type { CSSProperties, PropType } from "vue";
import type { RichLineClampExposed, RichLineClampSlotProps } from "./types.ts";

const isDev = typeof process === "undefined" ? true : process.env.NODE_ENV !== "production";

const slotStyle: CSSProperties = {
  display: "inline-flex",
  flexWrap: "nowrap",
  maxWidth: "100%",
  whiteSpace: "nowrap",
  verticalAlign: "baseline",
};

const clampProps = {
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

const clampEmits = {
  "update:expanded": (value: boolean) => typeof value === "boolean",
  clampchange: (value: boolean) => typeof value === "boolean",
};

export const RichLineClamp = defineComponent({
  name: "RichLineClamp",
  inheritAttrs: false,
  props: clampProps,
  emits: clampEmits,
  setup(props, { attrs, emit, expose, slots }) {
    const rootRef = ref<HTMLElement | null>(null);
    const contentRef = ref<HTMLElement | null>(null);
    const beforeRef = ref<HTMLElement | null>(null);
    const bodyRef = ref<HTMLElement | null>(null);
    const contentBodyRef = ref<HTMLElement | null>(null);
    const afterRef = ref<HTMLElement | null>(null);
    const renderedHtml = ref(props.html);
    const expanded = ref(props.expanded);
    const isClamped = ref(false);
    const canClipCollapsed = ref(true);

    const lineLimit = computed(() => normalizeLineLimit(props.maxLines));
    const hasLimit = computed(() => lineLimit.value !== undefined || props.maxHeight !== undefined);
    const preparedRichText = computed(() => prepareRichText(props.html));

    let resizeObserver: ResizeObserver | null = null;
    let stopFonts = () => {};
    let settledLayoutSignature: string | null = null;
    const warnedMessages = new Set<string>();

    function warn(message: string): void {
      if (!isDev || warnedMessages.has(message)) {
        return;
      }

      warnedMessages.add(message);
      console.warn(`[vue-clamp] ${message}`);
    }

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
      nextCanClipCollapsed: boolean,
    ): Promise<void> {
      const changed =
        renderedHtml.value !== nextHtml ||
        isClamped.value !== nextClamped ||
        canClipCollapsed.value !== nextCanClipCollapsed;

      renderedHtml.value = nextHtml;
      isClamped.value = nextClamped;
      canClipCollapsed.value = nextCanClipCollapsed;

      if (changed) {
        await nextTick();
      }
    }

    async function resetClamp(): Promise<void> {
      await applyHtmlState(props.html, false, true);
    }

    function layoutSignature(): string {
      return [
        sizeSignature(rootRef.value),
        sizeSignature(contentRef.value),
        sizeSignature(bodyRef.value),
        sizeSignature(beforeRef.value),
        sizeSignature(afterRef.value),
      ].join("|");
    }

    async function recomputeOnce(): Promise<void> {
      if (expanded.value || props.html.length === 0 || !hasLimit.value) {
        await resetClamp();
        return;
      }

      const rootElement = rootRef.value;
      const contentElement = contentRef.value;
      const contentBodyElement = contentBodyRef.value;
      const prepared = preparedRichText.value;

      if (!rootElement || !contentElement || !contentBodyElement || !prepared) {
        await resetClamp();
        return;
      }

      const nextState = clampRichTextToLayout(
        prepared,
        rootElement,
        contentElement,
        contentBodyElement,
        props.ellipsis,
        lineLimit.value,
        props.maxHeight,
      );

      if (nextState.reason) {
        warn(nextState.reason);
      }

      if (nextState.html === null) {
        await resetClamp();
        return;
      }

      await applyHtmlState(nextState.html, nextState.html !== prepared.html, !nextState.fallback);
    }

    const requestRecompute = createQueuedTask(async () => {
      await recomputeOnce();
      settledLayoutSignature = layoutSignature();
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
      [() => props.html, () => props.maxLines, () => props.maxHeight, () => props.ellipsis],
      () => {
        renderedHtml.value = props.html;
        requestRecompute();
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
        if (layoutSignature() !== settledLayoutSignature) {
          requestRecompute();
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
      const contentBodyElement = contentBodyRef.value;
      if (!contentBodyElement) {
        return;
      }

      const images = Array.from(contentBodyElement.querySelectorAll("img")).filter(
        (element): element is HTMLImageElement => element instanceof HTMLImageElement,
      );

      function handleImageChange(): void {
        requestRecompute();
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
      requestRecompute();

      const fontFaceSet = document.fonts;
      if (!fontFaceSet) {
        return;
      }

      function handleFontLoad(): void {
        requestRecompute();
      }

      void fontFaceSet.ready.then(handleFontLoad);
      fontFaceSet.addEventListener("loadingdone", handleFontLoad);
      stopFonts = () => {
        fontFaceSet.removeEventListener("loadingdone", handleFontLoad);
      };
    });

    onUpdated(() => {
      if (layoutSignature() !== settledLayoutSignature) {
        requestRecompute();
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
      let collapsedMaxHeight: string | number | undefined;

      if (!expanded.value && canClipCollapsed.value && props.maxHeight !== undefined) {
        collapsedMaxHeight =
          typeof props.maxHeight === "number" ? `${props.maxHeight}px` : props.maxHeight;
      }

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
                  ref: contentBodyRef,
                  innerHTML: expanded.value || !hasLimit.value ? props.html : renderedHtml.value,
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
