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
  borderBoxSizeSnapshot,
  createCoalescingRunner,
  emptyBorderBoxSignature,
  listenForFontLoads,
  observeBorderBoxSizes,
  observedBorderBoxSizeSnapshot,
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
  readonly active: Ref<boolean>;
  readonly expanded: Ref<boolean>;
  readonly onClampedChange: (value: boolean) => void;
  readonly onFontLoad?: () => void;
  readonly predictiveWidthRef?: Ref<HTMLElement | null>;
  readonly recompute: (expanded: Ref<boolean>, rootWidth?: number) => Promise<void>;
  readonly syncAffixSignaturesOnRootChange?: boolean;
};

export type MultilineShell = ShellState & {
  readonly expand: () => void;
  readonly collapse: () => void;
  readonly affixSlotProps: () => ClampSlotProps;
  readonly observedSizeSnapshot: (element: HTMLElement | null) => BorderBoxSizeSnapshot;
  readonly setBeforeElement: MultilineAffixRefSetter;
  readonly setAfterElement: MultilineAffixRefSetter;
  readonly toggle: () => void;
  readonly requestRecompute: () => void;
};

const emptySizeSnapshot: BorderBoxSizeSnapshot = {
  signature: emptyBorderBoxSignature,
  width: 0,
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
  const {
    active,
    expanded,
    onClampedChange,
    onFontLoad,
    predictiveWidthRef,
    recompute,
    syncAffixSignaturesOnRootChange = false,
  } = options;
  const controls = useClampControls(expanded);
  const state: ShellState = {
    rootRef: shallowRef<HTMLElement | null>(null),
    contentRef: shallowRef<HTMLElement | null>(null),
    beforeRef: shallowRef<HTMLElement | null>(null),
    bodyRef: shallowRef<HTMLElement | null>(null),
    afterRef: shallowRef<HTMLElement | null>(null),
    isClamped: shallowRef(false),
  };

  let lastLayoutSignature: string | null = null;
  const observedSizes = new WeakMap<Element, BorderBoxSizeSnapshot>();
  let observedPredictiveElement: Element | null = null;
  let observedPredictiveWidth = 0;
  let pendingRootWidth: number | undefined;
  let pendingAffixSignaturesFresh = false;
  let recomputeEpoch = 0;
  let fontRecomputeEpoch = 0;
  let fontRecomputeFrame: number | null = null;

  function readRootSnapshot(): BorderBoxSizeSnapshot {
    return readSize(state.rootRef.value);
  }

  function readLayoutSignature(reuseAffixSignatures = false): string {
    // The content shell captures body geometry, while slots are tracked
    // separately. This signature only needs to decide whether another
    // synchronous clamp pass is needed.
    const content = readSize(state.contentRef.value);
    if (!reuseAffixSignatures) {
      readAffixSignatures();
    }

    return (
      observedSizeSnapshot(state.rootRef.value).signature +
      "|" +
      content.signature +
      "|" +
      observedSizeSnapshot(state.beforeRef.value).signature +
      "|" +
      observedSizeSnapshot(state.afterRef.value).signature
    );
  }

  function readAffixSignatures(): void {
    readSize(state.beforeRef.value);
    readSize(state.afterRef.value);
  }

  function readSize(element: HTMLElement | null): BorderBoxSizeSnapshot {
    const snapshot = borderBoxSizeSnapshot(element);
    if (element) observedSizes.set(element, snapshot);
    return snapshot;
  }

  function requestRecompute(rootWidth?: number): void {
    if (rootWidth !== undefined) {
      pendingRootWidth = rootWidth;
    }

    requestRecomputeRunner();
  }

  function hasObservedSizeChange(entries: readonly ResizeObserverEntry[]): boolean {
    let changed = false;

    for (const entry of entries) {
      if (entry.target === predictiveWidthRef?.value) {
        // The zero-border/padding probe needs only inline size; bypass generic 2D
        // signatures and WeakMap traffic on the predictive resize hot path.
        const firstEntry = entry.target !== observedPredictiveElement;
        const width = entry.contentBoxSize[0]?.inlineSize ?? entry.contentRect.width;
        if (!firstEntry && width === observedPredictiveWidth) {
          continue;
        }

        observedPredictiveElement = entry.target;
        observedPredictiveWidth = width;
        pendingRootWidth = width;
        changed = true;
        continue;
      }

      const previous = observedSizes.get(entry.target);
      const snapshot = observedBorderBoxSizeSnapshot(
        entry,
        previous?.signature ?? emptySizeSnapshot.signature,
        !predictiveWidthRef?.value,
      );
      if (snapshot === null) {
        changed = true;
        continue;
      }

      if (previous?.signature === snapshot.signature) {
        continue;
      }

      observedSizes.set(entry.target, snapshot);
      if (entry.target === state.rootRef.value) {
        pendingRootWidth = snapshot.width;
      }
      changed = true;
    }

    return changed;
  }

  function observedSizeSnapshot(element: HTMLElement | null): BorderBoxSizeSnapshot {
    if (element && element === observedPredictiveElement) {
      return {
        signature: emptyBorderBoxSignature,
        width: observedPredictiveWidth,
      };
    }

    return element ? (observedSizes.get(element) ?? emptySizeSnapshot) : emptySizeSnapshot;
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
    const affixSignaturesFresh = pendingAffixSignaturesFresh;
    const wasClamped = state.isClamped.value;
    pendingRootWidth = undefined;
    pendingAffixSignaturesFresh = false;
    recomputeEpoch += 1;

    await recompute(expanded, rootWidth);
    if (!active.value) {
      lastLayoutSignature = null;
      return;
    }
    if (predictiveWidthRef?.value) {
      // Width and affix entries are the predictive path's complete geometry
      // input. Direct text writes do not need a synchronous settled-layout
      // snapshot; later size changes arrive through the same observer.
      lastLayoutSignature = null;
      return;
    }
    readRootSnapshot();
    lastLayoutSignature = readLayoutSignature(
      affixSignaturesFresh && wasClamped === state.isClamped.value,
    );
  });
  const setBeforeElement = createMultilineAffixRefSetter(state.beforeRef, requestRecompute);
  const setAfterElement = createMultilineAffixRefSetter(state.afterRef, requestRecompute);

  function cancelFontRecompute(): void {
    if (fontRecomputeFrame !== null) {
      cancelAnimationFrame(fontRecomputeFrame);
      fontRecomputeFrame = null;
    }
  }

  function requestFontRecompute(): void {
    onFontLoad?.();
    fontRecomputeEpoch = recomputeEpoch;
    fontRecomputeFrame ??= requestAnimationFrame(() => {
      fontRecomputeFrame = null;

      // A same-frame resize/update pass already measured the current fonts.
      if (fontRecomputeEpoch === recomputeEpoch) {
        requestRecompute();
      }
    });
  }

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
    if (!active.value) {
      return;
    }

    const observed = predictiveWidthRef?.value
      ? [predictiveWidthRef.value, state.beforeRef.value, state.afterRef.value]
      : [state.rootRef.value, state.contentRef.value, state.beforeRef.value, state.afterRef.value];
    const stopObserving = observeBorderBoxSizes(
      observed.filter((element): element is HTMLElement => element instanceof HTMLElement),
      (entries) => {
        // ResizeObserver is the async catch-all for container and slot sizes.
        // Predictive text changes do not observe their own block-size output.
        if (hasObservedSizeChange(entries)) {
          requestRecompute();
        }
      },
    );

    onCleanup(stopObserving);
  });

  watchPostEffect((onCleanup) => {
    if (active.value) {
      onCleanup(listenForFontLoads(requestFontRecompute));
    }
  });

  onMounted(() => {
    if (active.value) {
      requestRecompute();
    }
  });

  onUpdated(() => {
    if (!active.value || predictiveWidthRef?.value) {
      return;
    }

    const previousRootSizeSignature = observedSizeSnapshot(state.rootRef.value).signature;
    const rootSnapshot = readRootSnapshot();
    if (rootSnapshot.signature !== previousRootSizeSignature) {
      // A root change is enough to start the same-flush pass. Rich opts into
      // fresh affix signatures for hidden clone validation; content refreshes
      // after recompute records the settled layout.
      if (syncAffixSignaturesOnRootChange) {
        readAffixSignatures();
        pendingAffixSignaturesFresh = true;
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
    cancelFontRecompute();
  });

  return {
    ...state,
    ...controls,
    affixSlotProps,
    observedSizeSnapshot,
    setBeforeElement,
    setAfterElement,
    requestRecompute,
  };
}
