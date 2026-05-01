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

// LineClamp and RichLineClamp have different clamp engines but the same shell:
// controlled expansion, slot/root refs, invalidation sources, and event timing.
// Keeping that shell here avoids two subtly divergent lifecycle implementations.
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
    // Slot and body sizes can change without a prop change. A coarse signature is
    // enough to decide whether another synchronous clamp pass is needed.
    return combinedSizeSignature(
      state.rootRef.value,
      state.contentRef.value,
      state.bodyRef.value,
      state.beforeRef.value,
      state.afterRef.value,
    );
  }

  const requestRecompute = createCoalescingRunner(async () => {
    await recompute(state);
    lastLayoutSignature = layoutSignature();
  });

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
        // The internal state can be changed by exposed methods, so emit only
        // when the controlled prop is not already carrying the same value.
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
        // ResizeObserver is the async catch-all for layout changes not caused by
        // Vue props, such as container resizes and slot content dimensions.
        requestRecompute();
      }
    });

    const observed = [
      state.rootRef.value,
      state.contentRef.value,
      state.bodyRef.value,
      state.beforeRef.value,
      state.afterRef.value,
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
    requestRecompute();
    stopFonts = listenForFontLoads(requestRecompute);
  });

  onUpdated(() => {
    if (layoutSignature() !== lastLayoutSignature) {
      // Same-flush Vue updates should not wait for a later ResizeObserver tick;
      // otherwise stale clamp output can be painted for one frame.
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
