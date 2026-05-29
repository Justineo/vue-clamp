import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  shallowRef,
  watch,
  watchPostEffect,
} from "vue";
import { useClampControls } from "./controls.ts";
import {
  borderBoxObserverOptions,
  borderBoxEntrySizeSnapshot,
  borderBoxEntrySizeSignature,
  borderBoxSizeSnapshot,
  borderBoxSizeSignature,
  createCoalescingRunner,
  listenForFontLoads,
} from "./layout.ts";

import type { ComponentPublicInstance, Ref } from "vue";
import type { BorderBoxSizeSnapshot } from "./layout.ts";
import type { ClampSlotProps } from "./types.ts";

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

export type MultilineAffixRefSetter = (element: ComponentPublicInstance | Element | null) => void;

export type MultilineShellOptions = {
  readonly expanded: Ref<boolean>;
  readonly onClampedChange: (value: boolean) => void;
  readonly recompute: (expanded: Ref<boolean>, rootWidth?: number) => Promise<void>;
  readonly syncAffixSignaturesOnRootChange?: boolean;
};

export type MultilineShell = ShellState & {
  readonly expand: () => void;
  readonly collapse: () => void;
  readonly affixSlotProps: () => ClampSlotProps;
  readonly observedSizeSignature: (element: HTMLElement | null) => string;
  readonly setBeforeElement: MultilineAffixRefSetter;
  readonly setAfterElement: MultilineAffixRefSetter;
  readonly toggle: () => void;
  readonly requestRecompute: () => void;
};

function createMultilineAffixRefSetter(
  target: Ref<HTMLElement | null>,
  requestRecompute: () => void,
): MultilineAffixRefSetter {
  return (element) => {
    const nextElement = element instanceof HTMLElement ? element : null;
    if (target.value === nextElement) {
      return;
    }

    target.value = nextElement;
    // Slot wrappers can appear, disappear, or change identity after filtered
    // slot rendering. Recompute after Vue commits that DOM transition.
    void nextTick(requestRecompute);
  };
}

// LineClamp and RichLineClamp have different clamp engines but the same shell:
// controlled expansion, slot/root refs, invalidation sources, and event timing.
// Keeping that shell here avoids two subtly divergent lifecycle implementations.
export function useMultilineClamp(options: MultilineShellOptions): MultilineShell {
  const { expanded, onClampedChange, recompute, syncAffixSignaturesOnRootChange = false } = options;
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
  let lastRootSizeSignature = "0x0";
  let lastContentSizeSignature = "0x0";
  let lastBeforeSizeSignature = "0x0";
  let lastAfterSizeSignature = "0x0";
  let pendingRootWidth: number | undefined;

  function readRootSnapshot(): BorderBoxSizeSnapshot {
    const snapshot = borderBoxSizeSnapshot(state.rootRef.value);
    lastRootSizeSignature = snapshot.signature;

    return snapshot;
  }

  function readRootSignature(): void {
    lastRootSizeSignature = borderBoxSizeSignature(state.rootRef.value);
  }

  function readLayoutSignature(): string {
    // The content shell captures body geometry, while slots are tracked
    // separately. This signature only needs to decide whether another
    // synchronous clamp pass is needed.
    lastContentSizeSignature = borderBoxSizeSignature(state.contentRef.value);
    lastBeforeSizeSignature = borderBoxSizeSignature(state.beforeRef.value);
    lastAfterSizeSignature = borderBoxSizeSignature(state.afterRef.value);

    return (
      lastRootSizeSignature +
      "|" +
      lastContentSizeSignature +
      "|" +
      lastBeforeSizeSignature +
      "|" +
      lastAfterSizeSignature
    );
  }

  function readAffixSignatures(): void {
    lastBeforeSizeSignature = borderBoxSizeSignature(state.beforeRef.value);
    lastAfterSizeSignature = borderBoxSizeSignature(state.afterRef.value);
  }

  function lastObservedSignature(element: Element): string | null {
    if (element === state.rootRef.value) {
      return lastRootSizeSignature;
    }

    if (element === state.contentRef.value) {
      return lastContentSizeSignature;
    }

    if (element === state.beforeRef.value) {
      return lastBeforeSizeSignature;
    }

    if (element === state.afterRef.value) {
      return lastAfterSizeSignature;
    }

    return null;
  }

  function updateObservedSignature(element: Element, signature: string): void {
    if (element === state.rootRef.value) {
      lastRootSizeSignature = signature;
    } else if (element === state.contentRef.value) {
      lastContentSizeSignature = signature;
    } else if (element === state.beforeRef.value) {
      lastBeforeSizeSignature = signature;
    } else if (element === state.afterRef.value) {
      lastAfterSizeSignature = signature;
    }
  }

  function requestRecompute(rootWidth?: number): void {
    if (rootWidth !== undefined) {
      pendingRootWidth = rootWidth;
    }

    requestRecomputeRunner();
  }

  function signatureForObservedEntry(entry: ResizeObserverEntry): string | null {
    if (entry.target !== state.rootRef.value) {
      return borderBoxEntrySizeSignature(entry);
    }

    const snapshot = borderBoxEntrySizeSnapshot(entry);
    if (snapshot) {
      pendingRootWidth = snapshot.width;
    }

    return snapshot?.signature ?? null;
  }

  function hasObservedSizeChange(entries: readonly ResizeObserverEntry[]): boolean {
    let changed = false;

    for (const entry of entries) {
      const previousSignature = lastObservedSignature(entry.target);
      if (previousSignature === null) {
        continue;
      }

      const nextSignature = signatureForObservedEntry(entry);
      if (nextSignature === null) {
        changed = true;
        continue;
      }

      if (previousSignature === nextSignature) {
        continue;
      }

      updateObservedSignature(entry.target, nextSignature);
      changed = true;
    }

    return changed;
  }

  function observedSizeSignature(element: HTMLElement | null): string {
    return element ? (lastObservedSignature(element) ?? borderBoxSizeSignature(element)) : "0x0";
  }

  function affixSlotProps(): ClampSlotProps {
    return {
      expand: controls.expand,
      collapse: controls.collapse,
      toggle: controls.toggle,
      clamped: state.isClamped.value,
      expanded: expanded.value,
    };
  }

  const requestRecomputeRunner = createCoalescingRunner(async () => {
    const rootWidth = pendingRootWidth;
    pendingRootWidth = undefined;

    await recompute(expanded, rootWidth);
    readRootSignature();
    lastLayoutSignature = readLayoutSignature();
  });
  const setBeforeElement = createMultilineAffixRefSetter(state.beforeRef, requestRecompute);
  const setAfterElement = createMultilineAffixRefSetter(state.afterRef, requestRecompute);

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
    resizeObserver ??= new ResizeObserver((entries) => {
      // ResizeObserver is the async catch-all for layout changes not caused by
      // Vue props, such as container resizes and slot content dimensions.
      if (hasObservedSizeChange(entries)) {
        requestRecompute();
      }
    });

    const observed = [
      state.rootRef.value,
      state.contentRef.value,
      state.beforeRef.value,
      state.afterRef.value,
    ].filter((element): element is HTMLElement => element instanceof HTMLElement);

    for (const element of observed) {
      resizeObserver.observe(element, borderBoxObserverOptions);
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
    const previousRootSizeSignature = lastRootSizeSignature;
    const rootSnapshot = readRootSnapshot();
    if (rootSnapshot.signature !== previousRootSizeSignature) {
      // A root change is enough to start the same-flush pass. Rich opts into
      // fresh affix signatures for hidden clone validation; content refreshes
      // after recompute records the settled layout.
      if (syncAffixSignaturesOnRootChange) {
        readAffixSignatures();
      }
      requestRecompute(rootSnapshot.width);
      return;
    }

    if (readLayoutSignature() !== lastLayoutSignature) {
      // Same-flush Vue updates should not wait for a later ResizeObserver tick;
      // otherwise stale clamp output can be painted for one frame.
      requestRecompute(rootSnapshot.width);
    }
  });

  onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    stopFonts();
  });

  return {
    ...state,
    ...controls,
    affixSlotProps,
    observedSizeSignature,
    setBeforeElement,
    setAfterElement,
    requestRecompute,
  };
}
