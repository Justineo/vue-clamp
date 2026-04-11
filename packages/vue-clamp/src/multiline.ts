import { onBeforeUnmount, onMounted, onUpdated, ref, watch, watchPostEffect } from "vue";
import { combinedSizeSignature, createCoalescingRunner, listenForFontLoads } from "./layout.ts";

import type { Ref } from "vue";

type FrameRefs = {
  rootRef: Ref<HTMLElement | null>;
  contentRef: Ref<HTMLElement | null>;
  beforeRef: Ref<HTMLElement | null>;
  bodyRef: Ref<HTMLElement | null>;
  afterRef: Ref<HTMLElement | null>;
};

type ClampState = FrameRefs & {
  expanded: Ref<boolean>;
  isClamped: Ref<boolean>;
};

type ClampShellOptions = {
  getExpanded: () => boolean;
  onExpandedChange: (value: boolean) => void;
  onClampedChange: (value: boolean) => void;
  recompute: (state: ClampState) => Promise<void>;
};

function frameElements(refs: FrameRefs): HTMLElement[] {
  return [
    refs.rootRef.value,
    refs.contentRef.value,
    refs.bodyRef.value,
    refs.beforeRef.value,
    refs.afterRef.value,
  ].filter((element): element is HTMLElement => element instanceof HTMLElement);
}

export function useMultilineClamp(options: ClampShellOptions) {
  const { getExpanded, onExpandedChange, onClampedChange, recompute } = options;
  const state: ClampState = {
    rootRef: ref<HTMLElement | null>(null),
    contentRef: ref<HTMLElement | null>(null),
    beforeRef: ref<HTMLElement | null>(null),
    bodyRef: ref<HTMLElement | null>(null),
    afterRef: ref<HTMLElement | null>(null),
    expanded: ref(getExpanded()),
    isClamped: ref(false),
  };

  let resizeObserver: ResizeObserver | null = null;
  let stopFonts = () => {};
  let lastLayoutSignature: string | null = null;

  function expand(): void {
    state.expanded.value = true;
  }

  function collapse(): void {
    state.expanded.value = false;
  }

  function toggle(): void {
    state.expanded.value = !state.expanded.value;
  }

  function layoutSignature(): string {
    return combinedSizeSignature(
      state.rootRef.value,
      state.contentRef.value,
      state.bodyRef.value,
      state.beforeRef.value,
      state.afterRef.value,
    );
  }

  async function syncLatestState(): Promise<void> {
    await recompute(state);
    lastLayoutSignature = layoutSignature();
  }

  const requestRecompute = createCoalescingRunner(syncLatestState);

  watch(
    () => getExpanded(),
    (value) => {
      state.expanded.value = value;
    },
  );

  watch(
    state.expanded,
    (value) => {
      if (getExpanded() !== value) {
        onExpandedChange(value);
      }

      requestRecompute();
    },
    { flush: "post" },
  );

  watch(
    state.isClamped,
    (value) => {
      onClampedChange(value);
    },
    { flush: "post", immediate: true },
  );

  watchPostEffect((onCleanup) => {
    resizeObserver ??= new ResizeObserver(() => {
      if (layoutSignature() !== lastLayoutSignature) {
        requestRecompute();
      }
    });

    const observed = frameElements(state);

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

  return {
    ...state,
    expand,
    collapse,
    toggle,
    requestRecompute,
  };
}
