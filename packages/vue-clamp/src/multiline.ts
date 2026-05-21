import { onBeforeUnmount, onMounted, onUpdated, shallowRef, watch, watchPostEffect } from "vue";
import { useClampControls } from "./controls.ts";
import { combinedSizeSignature, createCoalescingRunner, listenForFontLoads } from "./layout.ts";

import type { Ref } from "vue";

export type MultilineFrameRefs = {
  readonly rootRef: Ref<HTMLElement | null>;
  readonly contentRef: Ref<HTMLElement | null>;
  readonly beforeRef: Ref<HTMLElement | null>;
  readonly bodyRef: Ref<HTMLElement | null>;
  readonly afterRef: Ref<HTMLElement | null>;
};

type ShellState = MultilineFrameRefs & {
  readonly isClamped: Ref<boolean>;
};

export type MultilineShellOptions = {
  readonly expanded: Ref<boolean>;
  readonly onClampedChange: (value: boolean) => void;
  readonly recompute: (expanded: Ref<boolean>) => Promise<void>;
};

export type MultilineShell = ShellState & {
  readonly expand: () => void;
  readonly collapse: () => void;
  readonly toggle: () => void;
  readonly requestRecompute: () => void;
};

// LineClamp and RichLineClamp have different clamp engines but the same shell:
// controlled expansion, slot/root refs, invalidation sources, and event timing.
// Keeping that shell here avoids two subtly divergent lifecycle implementations.
export function useMultilineClamp(options: MultilineShellOptions): MultilineShell {
  const { expanded, onClampedChange, recompute } = options;
  const controls = useClampControls(expanded);
  const state: ShellState = {
    rootRef: shallowRef<HTMLElement | null>(null),
    contentRef: shallowRef<HTMLElement | null>(null),
    beforeRef: shallowRef<HTMLElement | null>(null),
    bodyRef: shallowRef<HTMLElement | null>(null),
    afterRef: shallowRef<HTMLElement | null>(null),
    isClamped: shallowRef(false),
  };

  let resizeObserver: ResizeObserver | null = null;
  let stopFonts = () => {};
  let lastLayoutSignature: string | null = null;

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
    await recompute(expanded);
    lastLayoutSignature = layoutSignature();
  });

  watch(
    expanded,
    () => {
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
    ...controls,
    requestRecompute,
  };
}
