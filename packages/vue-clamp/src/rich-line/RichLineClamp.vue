<script setup lang="ts">
import { computed, h, mergeProps, nextTick, shallowRef, useAttrs, watch } from "vue";
import { borderBoxWidth, cssLength, normalizeLineLimit } from "../layout.ts";
import { useMultilineClamp } from "../multiline.ts";
import { renderMultilineAffixSlot } from "../multiline-render.ts";
import { multilineNativeSlotStyle, multilineSlotStyle } from "../multiline-styles.ts";
import {
  getNativeContentStyle,
  measureNativeClamped,
  nativeBodyStyle,
  nativeTextStyle,
  resolveNativeMode,
} from "../native.ts";
import { canSafelyCloneRichProbe, clampRich, patchRich, prepareRich } from "../rich.ts";
import {
  estimateColdSearchMaxProbeCount,
  richWarmExpansionLimit,
  shouldVerifyFullCandidate,
  warmSearchLocalCoverage,
  warmTargetBeatsCold,
} from "../search.ts";
import { richProbeStyle } from "./styles.ts";

import type { VNodeChild } from "vue";
import type { ClampEmits } from "../types.ts";
import type { NativeClampMode } from "../native.ts";
import type {
  PreparedRich,
  RichClampProbe,
  RichClampResult,
  RichSearchIndex,
  RichState,
} from "../rich.ts";
import type { RichLineClampExposed, RichLineClampProps, RichLineClampSlots } from "./types.ts";

type ProbeElements = {
  affixes: {
    after: ProbeAffixState;
    before: ProbeAffixState;
  };
  body: HTMLElement;
  content: HTMLElement;
};

type ProbeAffixState = {
  clone: HTMLElement | null;
  signature: string | null;
  source: HTMLElement | null;
};

type PreparedProbe = {
  affixSignature: string;
  probe: RichClampProbe;
};

type RankHint = {
  hasObservedRankSlope: boolean;
  rank: number;
  rankCount: number;
  rankPerPx: number;
  textRankSafe: boolean;
  width: number;
};

// Bootstrap locality before a measured word-rank slope exists. This is a
// conservative fallback, not a proof that the pixel window is globally optimal.
const warmBootstrapWidthDelta = 32;
const nativeRichBodyStyle = {
  ...nativeBodyStyle,
  ...nativeTextStyle,
};

defineOptions({
  name: "RichLineClamp",
  inheritAttrs: false,
});

const {
  as: rootTag = "div",
  html,
  maxLines,
  maxHeight,
  ellipsis = "…",
  boundary = "grapheme",
} = defineProps<Omit<RichLineClampProps, "expanded">>();
const expanded = defineModel<NonNullable<RichLineClampProps["expanded"]>>("expanded", {
  default: false,
});
const emit = defineEmits<Omit<ClampEmits, "update:expanded">>();
const slots = defineSlots<RichLineClampSlots>();
const attrs = useAttrs();

const probeRef = shallowRef<HTMLElement | null>(null);
const isFallback = shallowRef(false);

// The visible tree and hidden probe advance independently. measuredState is both
// the latest warm hint and the hidden body's patch origin.
const preparedHtml = computed(() => prepareRich(html, boundary));
const hasActiveClamp = computed(
  () =>
    !expanded.value &&
    html.length > 0 &&
    (normalizeLineLimit(maxLines) !== undefined || maxHeight !== undefined),
);
let visibleState: RichState | null = null;
let visibleIsPatched = false;
let measuredState: RichState | null = null;
let probeElements: ProbeElements | null = null;
let probeSearchIndex: RichSearchIndex | null = null;
let measuredAffixSignature: string | null = null;
let measuredWidth: number | null = null;
let rankHint: RankHint | null = null;
let clampedMaxWidth: number | null = null;
let sourceProbeSafety: { prepared: PreparedRich; safe: boolean } | null = null;
let probeCloneBlocked = false;

const {
  rootRef,
  contentRef,
  beforeRef,
  bodyRef,
  afterRef,
  isClamped,
  expand,
  collapse,
  toggle,
  observedSizeSignature,
  affixSlotProps,
  setBeforeElement,
  setAfterElement,
  requestRecompute,
} = useMultilineClamp({
  active: hasActiveClamp,
  expanded,
  onClampedChange: (value) => {
    emit("clampchange", value);
  },
  syncAffixSignaturesOnRootChange: true,
  recompute: async (expanded, rootWidthSnapshot): Promise<void> => {
    const lineLimit = normalizeLineLimit(maxLines);

    if (
      expanded.value ||
      html.length === 0 ||
      (lineLimit === undefined && maxHeight === undefined)
    ) {
      // Expanded, empty, and unlimited states should leave the trusted HTML
      // visible as authored.
      await resetClamp();
      return;
    }

    const bodyElement = bodyRef.value;

    if (!bodyElement) {
      await resetClamp();
      return;
    }

    const nativeMode = getNativeMode(lineLimit);
    if (nativeMode) {
      const contentElement = contentRef.value;
      if (!contentElement) {
        await resetClamp();
        return;
      }

      if (visibleIsPatched) {
        const prepared = preparedHtml.value;
        if (!prepared) {
          await resetClamp();
          return;
        }

        patchVisible(prepared, { kind: "full" });
      }

      resetStates();
      clearProbe();
      const clampedElement = nativeMode === "multi-line" ? contentElement : bodyElement;
      const nextClamped = measureNativeClamped(
        clampedElement,
        nativeMode,
        nativeMode === "multi-line" ? rootWidthSnapshot : undefined,
      );
      await applyStatus(nextClamped ?? false, false);
      return;
    }

    const prepared = preparedHtml.value;
    if (!prepared) {
      // DOMParser can be unavailable in non-browser environments. Keep the
      // authored source rather than trying to measure an unknown tree.
      await resetClamp();
      return;
    }

    if (probeCloneBlocked) {
      await applySourceFallback(prepared);
      return;
    }

    if (
      !canSafelyPrepareSource(prepared) ||
      !canSafelyCloneRichProbe(beforeRef.value) ||
      !canSafelyCloneRichProbe(afterRef.value)
    ) {
      // Arbitrary connected clones can run custom-element lifecycle hooks,
      // duplicate document/form identities, or activate embedded resources.
      // Preserve the authored source instead of approximating those cases.
      probeCloneBlocked = true;
      await applySourceFallback(prepared);
      return;
    }

    const preparedProbe = prepareProbe(rootWidthSnapshot);
    if (!preparedProbe) {
      await resetClamp();
      return;
    }

    const { affixSignature, probe } = preparedProbe;
    const sameAffix = affixSignature === measuredAffixSignature;
    const skipFullFit = canSkipFullFit(probe.width, sameAffix);
    const searchHint = canUseSearchHint(probe.width, sameAffix, lineLimit) ? measuredState : null;
    const preferHintedTextRun =
      searchHint?.kind === "clamped" && measuredWidth !== null && sameAffix;
    const result = clampRich({
      ellipsis,
      from: measuredState,
      hint: searchHint,
      lineLimit,
      maxHeight,
      prepared,
      preferHintedTextRun,
      probe,
      searchIndex: probeSearchIndex,
      skipFullFit,
      verifyFullCandidate: shouldVerifyFullCandidate(
        skipFullFit,
        probe.width,
        measuredWidth,
        measuredState?.kind === "full",
        clampedMaxWidth,
      ),
    });
    measuredState = result.state;
    probeSearchIndex = result.searchIndex ?? null;
    measuredAffixSignature = affixSignature;
    measuredWidth = probe.width;
    updateRankHint(result, probe.width, sameAffix);
    updateClampedMaxWidth(result, probe.width, sameAffix);
    if (!result.state) {
      // A zero-width probe should not replace visible content with a guessed rich
      // fragment.
      await resetClamp();
      return;
    }

    patchVisible(prepared, result.state);
    await applyStatus(result.state.kind === "clamped", result.fallback);
  },
});

function createProbe(): ProbeElements {
  const content = document.createElement("span");
  const body = document.createElement("span");
  content.dataset.part = "content";
  body.dataset.part = "body";
  content.appendChild(body);

  return {
    affixes: {
      after: createProbeAffixState(),
      before: createProbeAffixState(),
    },
    body,
    content,
  };
}

function createProbeAffixState(): ProbeAffixState {
  return {
    clone: null,
    signature: null,
    source: null,
  };
}

function ensureProbeRoot(probeRoot: HTMLElement, content: HTMLElement): void {
  if (content.parentNode === probeRoot && probeRoot.childNodes.length === 1) {
    return;
  }

  probeRoot.replaceChildren(content);
}

function syncProbeContent(
  elements: ProbeElements,
  beforeElement: HTMLElement | null,
  afterElement: HTMLElement | null,
): void {
  const { body, content } = elements;
  const beforeClone = syncProbeAffixClone(
    elements.affixes.before,
    beforeElement,
    observedSizeSignature(beforeElement),
  );
  const afterClone = syncProbeAffixClone(
    elements.affixes.after,
    afterElement,
    observedSizeSignature(afterElement),
  );

  if (!beforeClone && !afterClone) {
    if (body.parentNode !== content || content.childNodes.length !== 1) {
      content.replaceChildren(body);
    }

    return;
  }

  const nextChildren: HTMLElement[] = [];
  if (beforeClone) {
    nextChildren.push(beforeClone);
  }

  nextChildren.push(body);

  if (afterClone) {
    nextChildren.push(afterClone);
  }

  const currentChildren = content.childNodes;
  let structureChanged = currentChildren.length !== nextChildren.length;
  for (let index = 0; !structureChanged && index < nextChildren.length; index += 1) {
    structureChanged = currentChildren[index] !== nextChildren[index];
  }

  if (structureChanged) {
    content.replaceChildren(...nextChildren);
  }
}

function syncProbeAffixClone(
  affixState: ProbeAffixState,
  source: HTMLElement | null,
  nextSignature: string,
): HTMLElement | null {
  if (!source) {
    affixState.clone = null;
    affixState.signature = null;
    affixState.source = null;
    return null;
  }

  if (affixState.clone && affixState.source === source && affixState.signature === nextSignature) {
    return affixState.clone;
  }

  // Slot content affects fit but should not be mutated by rich candidate
  // patches, so the probe receives cloned slot boxes.
  const clone = source.cloneNode(true) as HTMLElement;
  affixState.clone = clone;
  affixState.signature = nextSignature;
  affixState.source = source;

  return clone;
}

function resetStates(): void {
  // visibleIsPatched describes the live DOM, not a reusable patch cursor. It
  // intentionally survives semantic-state resets until source DOM is restored.
  visibleState = null;
  measuredState = null;
  probeSearchIndex = null;
  measuredAffixSignature = null;
  measuredWidth = null;
  rankHint = null;
  clampedMaxWidth = null;
}

function clearProbe(): void {
  probeRef.value?.replaceChildren();
  probeElements = null;
}

function canSafelyPrepareSource(prepared: PreparedRich): boolean {
  if (sourceProbeSafety?.prepared === prepared) {
    return sourceProbeSafety.safe;
  }

  // `html`/`boundary` changes create a new prepared source, so the static
  // clone-safety walk is paid once per source rather than once per reclamp.
  const safe = canSafelyCloneRichProbe(prepared.root) && canSafelyCloneRichProbe(bodyRef.value);
  sourceProbeSafety = { prepared, safe };
  return safe;
}

function getNativeMode(lineLimit: number | undefined): NativeClampMode | null {
  if (probeCloneBlocked) {
    return null;
  }

  return resolveNativeMode({
    boundary,
    ellipsis,
    expanded: expanded.value,
    hasAfterSlot: afterRef.value !== null,
    lineLimit,
    locationRatio: 1,
    maxHeight,
  });
}

function canUseSearchHint(
  width: number,
  sameAffix: boolean,
  lineLimit: number | undefined,
): boolean {
  if (!measuredState || !sameAffix) {
    return false;
  }

  const stateWidth = measuredWidth;
  if (stateWidth === null || width === stateWidth) {
    return true;
  }

  const hint = rankHint;
  if (boundary === "word" && hint?.hasObservedRankSlope && hint.textRankSafe) {
    const count = hint.rankCount;
    const start = Math.max(0, Math.min(count - 1, hint.rank));
    const target = estimatedTargetRank(hint, width);
    const rankMove = Math.abs(target - start);

    return warmTargetBeatsCold({
      allowPatchTieBreak:
        rankMove <= warmSearchLocalCoverage(richWarmExpansionLimit) || lineLimit !== 1,
      coldCost: estimateColdSearchMaxProbeCount(count),
      count,
      expansionLimit: richWarmExpansionLimit,
      hint: start,
      target,
    });
  }

  return Math.abs(width - stateWidth) <= warmBootstrapWidthDelta;
}

function estimatedTargetRank(hint: RankHint, width: number): number {
  const deltaWidth = width - hint.width;
  const rankMove = Math.abs(deltaWidth) * hint.rankPerPx;
  const start = Math.max(0, Math.min(hint.rankCount - 1, hint.rank));
  const target = start + Math.sign(deltaWidth) * Math.ceil(rankMove);

  return Math.max(0, Math.min(hint.rankCount - 1, target));
}

function nextRankPerPx(
  result: RichClampResult,
  width: number,
  sameAffix: boolean,
  previous: RankHint | null,
): number {
  const rank = result.rank ?? 0;
  if (!sameAffix || !previous || previous.rankCount !== result.rankCount) {
    return Math.max(1 / width, rank / width);
  }

  const deltaWidth = Math.abs(width - previous.width);
  if (deltaWidth === 0) {
    return previous.rankPerPx;
  }

  const observed = Math.abs(rank - previous.rank) / deltaWidth;

  return Number.isFinite(observed) && observed > 0 ? observed : previous.rankPerPx;
}

function updateRankHint(result: RichClampResult, width: number, sameAffix: boolean): void {
  if (result.rank === undefined || result.rankCount === undefined || result.rankCount <= 0) {
    rankHint = null;
    return;
  }

  const previous = rankHint;
  rankHint = {
    // Same-width invalidations preserve a slope learned from an earlier resize.
    hasObservedRankSlope:
      sameAffix && !!previous && (previous.hasObservedRankSlope || previous.width !== width),
    rank: result.rank,
    rankCount: result.rankCount,
    rankPerPx: nextRankPerPx(result, width, sameAffix, previous),
    textRankSafe: result.textRankSafe ?? false,
    width,
  };
}

function updateClampedMaxWidth(result: RichClampResult, width: number, sameAffix: boolean): void {
  if (result.state?.kind !== "clamped") {
    clampedMaxWidth = null;
    return;
  }

  clampedMaxWidth = sameAffix ? Math.max(width, clampedMaxWidth ?? width) : width;
}

function canSkipFullFit(width: number, sameAffix: boolean): boolean {
  const state = measuredState;
  const stateWidth = measuredWidth;
  if (state?.kind !== "clamped" || stateWidth === null || !sameAffix) {
    return false;
  }

  const hint = rankHint;
  if (boundary === "word" && hint?.hasObservedRankSlope) {
    return estimatedTargetRank(hint, width) < hint.rankCount - 1;
  }

  return width <= stateWidth + warmBootstrapWidthDelta;
}

function patchVisible(prepared: PreparedRich, state: RichState): void {
  const bodyElement = bodyRef.value;
  if (!bodyElement) {
    // If Vue has not mounted the target body, discard states rather than
    // applying future patches against an unknown DOM state.
    visibleIsPatched = false;
    resetStates();
    return;
  }

  visibleState = patchRich(prepared, bodyElement, visibleState, state, ellipsis);
  visibleIsPatched = state.kind === "clamped";
}

async function applyStatus(nextClamped: boolean, nextFallback: boolean): Promise<void> {
  const changed = isClamped.value !== nextClamped || isFallback.value !== nextFallback;

  isClamped.value = nextClamped;
  isFallback.value = nextFallback;

  if (changed) {
    // Layout and visible DOM are already final; this tick exposes status changes
    // after Vue commits any render-mode transition.
    await nextTick();
  }
}

async function resetClamp(): Promise<void> {
  if (visibleIsPatched) {
    const prepared = preparedHtml.value;
    if (prepared) {
      // Reset through the structural patcher so existing visible descendants
      // are restored consistently with normal clamp commits.
      patchVisible(prepared, { kind: "full" });
    } else {
      resetStates();
    }
  } else {
    resetStates();
  }

  await applyStatus(false, false);
}

async function applySourceFallback(prepared: PreparedRich): Promise<void> {
  if (visibleIsPatched) {
    // Slot-only changes can make an already-clamped tree unsafe to clone. HTML
    // changes clear visibleIsPatched after Vue restores innerHTML, so avoiding a
    // redundant patch also avoids reconnecting custom elements.
    patchVisible(prepared, { kind: "full" });
  }

  resetStates();
  clearProbe();
  await applyStatus(false, true);
}

function probeAffixSignature(elements: ProbeElements): string {
  return `${elements.affixes.before.signature ?? ""}|${elements.affixes.after.signature ?? ""}`;
}

function prepareProbe(rootWidth?: number): PreparedProbe | null {
  const rootElement = rootRef.value;
  const probeRoot = probeRef.value;
  if (!rootElement || !probeRoot) {
    return null;
  }

  const elements = (probeElements ??= createProbe());
  const normalizedMaxHeight = cssLength(maxHeight);
  const width = rootWidth ?? borderBoxWidth(rootElement);

  probeRoot.style.width = `${width}px`;
  probeRoot.style.maxHeight = normalizedMaxHeight ?? "";
  probeRoot.style.overflow = normalizedMaxHeight === undefined ? "visible" : "hidden";

  const beforeElement = beforeRef.value;
  const afterElement = afterRef.value;

  syncProbeContent(elements, beforeElement, afterElement);
  ensureProbeRoot(probeRoot, elements.content);

  return {
    affixSignature: probeAffixSignature(elements),
    probe: {
      body: elements.body,
      content: elements.content,
      root: probeRoot,
      width,
    },
  };
}

function renderAffixSlot(
  part: "before" | "after",
  nativeMode: NativeClampMode | null,
): VNodeChild | null {
  const slot = part === "before" ? slots.before : slots.after;
  if (!slot) {
    return null;
  }

  return renderMultilineAffixSlot({
    part,
    render: slot,
    setRef: part === "before" ? setBeforeElement : setAfterElement,
    slotProps: affixSlotProps(),
    slotStyle: nativeMode === "single-line" ? multilineNativeSlotStyle : multilineSlotStyle,
  });
}

function render(): VNodeChild {
  const lineLimit = normalizeLineLimit(maxLines);
  const nativeMode = getNativeMode(lineLimit);
  const collapsedMaxHeight =
    !expanded.value && !isFallback.value ? cssLength(maxHeight) : undefined;
  const rootStyle =
    collapsedMaxHeight === undefined
      ? undefined
      : {
          maxHeight: collapsedMaxHeight,
          overflow: "hidden",
        };
  const children: VNodeChild[] = [];
  const beforeSlot = renderAffixSlot("before", nativeMode);
  if (beforeSlot) {
    children.push(beforeSlot);
  }

  children.push(
    h("span", {
      "data-part": "body",
      innerHTML: html,
      ref: bodyRef,
      style: nativeMode === "single-line" ? nativeRichBodyStyle : undefined,
    }),
  );

  const afterSlot = renderAffixSlot("after", nativeMode);
  if (afterSlot) {
    children.push(afterSlot);
  }

  const rootChildren: VNodeChild[] = [
    h(
      "span",
      {
        "data-part": "content",
        ref: contentRef,
        style: getNativeContentStyle(nativeMode, lineLimit),
      },
      children,
    ),
  ];

  if (!nativeMode) {
    rootChildren.push(
      h("span", {
        "aria-hidden": "true",
        inert: true,
        ref: probeRef,
        style: richProbeStyle,
      }),
    );
  }

  return h(
    rootTag,
    mergeProps(attrs, {
      "data-part": "root",
      ref: rootRef,
      style: rootStyle,
    }),
    rootChildren,
  );
}

defineRender(render);

watch(
  [() => html, () => maxLines, () => maxHeight, () => ellipsis, () => boundary],
  ([nextHtml], [previousHtml]) => {
    // HTML and clamp semantics change the structural state space, so both
    // visible and probe patch cursors must restart.
    if (nextHtml !== previousHtml) {
      // Vue has restored changed `innerHTML` before this post-flush watcher.
      visibleIsPatched = false;
    }
    probeCloneBlocked = false;
    resetStates();
    isFallback.value = false;
    requestRecompute();
  },
  { flush: "post" },
);

defineExpose({
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
</script>
