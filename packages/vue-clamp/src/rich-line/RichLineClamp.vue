<script setup lang="ts">
import { computed, h, mergeProps, nextTick, shallowRef, useAttrs, watch } from "vue";
import {
  exactResultCacheEntryLimit,
  rememberCacheEntry,
  touchCacheEntry,
  tupleCacheKey,
} from "../cache.ts";
import {
  borderBoxWidth,
  cssLength,
  hasInlineFontMetrics,
  hasUnresolvedStyleReference,
  isContentIndependentWidth,
  normalizeLineLimit,
} from "../layout.ts";
import { useMultilineClamp } from "../multiline.ts";
import { renderMultilineAffixSlot } from "../multiline-render.ts";
import { multilineSlotStyle } from "../multiline-styles.ts";
import { clampRich, patchRich, prepareRich } from "../rich.ts";
import {
  estimateColdSearchMaxProbeCount,
  estimateWarmSearchProbeCount,
  richWarmExpansionLimit,
  warmSearchLocalCoverage,
} from "../search.ts";
import { richProbeStyle } from "./styles.ts";

import type { VNodeChild } from "vue";
import type { ClampEmits } from "../types.ts";
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

type CachedResult = RichClampResult & {
  readonly fallback: false;
  readonly state: RichState;
};

// Bootstrap locality before a measured word-rank slope exists. This is a pixel
// window, separate from the rank-space expansion budget used inside searches.
const warmBootstrapWidthDelta = 32;

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

const preparedHtml = computed(() => prepareRich(html, boundary));

// The visible tree and hidden probe advance independently. measuredState is the
// latest measured result used for warm hints; probeDomState is the actual hidden
// body state used as the next patch origin.
let visibleState: RichState | null = null;
let probeDomState: RichState | null = null;
let measuredState: RichState | null = null;
let probeElements: ProbeElements | null = null;
let probeSearchIndex: RichSearchIndex | null = null;
let measuredAffixSignature: string | null = null;
let measuredWidth: number | null = null;
let rankHint: RankHint | null = null;
let clampedMaxWidth: number | null = null;
const resultCache = new Map<string, CachedResult>();

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
  expanded,
  onClampedChange: (value) => {
    emit("clampchange", value);
  },
  onFontLoad: () => {
    resultCache.clear();
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

    const prepared = preparedHtml.value;

    if (!bodyRef.value || !prepared) {
      // DOMParser can be unavailable in non-browser environments, and refs can
      // be absent during mount/teardown; both cases use the safe source.
      await resetClamp();
      return;
    }

    const preparedProbe = prepareProbe(rootWidthSnapshot);
    if (!preparedProbe) {
      await resetClamp();
      return;
    }

    const { affixSignature, probe } = preparedProbe;
    const hasWidthSnapshot = rootWidthSnapshot !== undefined;
    const sameAffix = affixSignature === measuredAffixSignature;
    const skipFullFit = canSkipFullFit(probe.width, sameAffix);
    const searchHint = canUseSearchHint(probe.width, sameAffix, lineLimit) ? measuredState : null;
    const preferHintedTextRun =
      searchHint?.kind === "clamped" && measuredWidth !== null && sameAffix;
    const cacheKey = resultCacheKey(prepared, hasWidthSnapshot, probe.width, affixSignature);
    const cachedResult = cacheKey ? (touchCacheEntry(resultCache, cacheKey) ?? null) : null;
    const result =
      cachedResult ??
      clampRich({
        ellipsis,
        from: probeDomState,
        hint: searchHint,
        lineLimit,
        maxHeight,
        prepared,
        preferHintedTextRun,
        probe,
        reuseSimpleLineFit: hasWidthSnapshot,
        searchIndex: probeSearchIndex,
        skipFullFit,
        verifyFullCandidate: shouldVerifyFullCandidate(probe.width),
      });
    if (!cachedResult) {
      probeDomState = result.state;
    }
    measuredState = result.state;
    probeSearchIndex = result.searchIndex ?? null;
    measuredAffixSignature = affixSignature;
    measuredWidth = probe.width;
    updateRankHint(result, probe.width, sameAffix);
    updateClampedMaxWidth(result, probe.width, sameAffix);
    if (!cachedResult && isCacheableResult(result)) {
      rememberCacheEntry(resultCache, cacheKey, result, exactResultCacheEntryLimit);
    }

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
  visibleState = null;
  probeDomState = null;
  measuredState = null;
  probeSearchIndex = null;
  measuredAffixSignature = null;
  measuredWidth = null;
  rankHint = null;
  clampedMaxWidth = null;
  resultCache.clear();
}

function canCacheRoot(element: HTMLElement, searchIndex: RichSearchIndex): boolean {
  if (
    searchIndex.hasStyleDependentDisplay ||
    searchIndex.hasStyleDependentLineMetrics ||
    (element.getAttribute("class") ?? "").trim() !== ""
  ) {
    return false;
  }

  const styleText = element.getAttribute("style") ?? "";
  if (styleText === "" || hasUnresolvedStyleReference(styleText)) {
    return false;
  }

  return (
    isContentIndependentWidth(element.style.width.trim()) && hasInlineFontMetrics(element.style)
  );
}

function styleSheetCacheKey(): string | null {
  const signature = [document.styleSheets.length.toString()];

  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (!(rule instanceof CSSStyleRule)) {
          return null;
        }

        const cssText = rule.cssText;
        if (cssText.toLowerCase().includes("var(")) {
          return null;
        }

        signature.push(cssText);
      }
    } catch {
      return null;
    }
  }

  return tupleCacheKey(signature);
}

function ancestorStyleContextKey(element: HTMLElement): string | null {
  const parts: string[] = [];
  let current: HTMLElement | null = element;

  while (current) {
    const style = current.getAttribute("style") ?? "";
    if (hasUnresolvedStyleReference(style)) {
      return null;
    }

    parts.push(current.id, current.getAttribute("class") ?? "", style);
    current = current.parentElement;
  }

  return tupleCacheKey(parts);
}

function hasUnresolvedInlineStyles(root: Element): boolean {
  const style = root.getAttribute("style") ?? "";
  if (hasUnresolvedStyleReference(style)) {
    return true;
  }

  for (const child of root.querySelectorAll("[style]")) {
    if (hasUnresolvedStyleReference(child.getAttribute("style") ?? "")) {
      return true;
    }
  }

  return false;
}

function resultCacheKey(
  prepared: PreparedRich,
  hasWidthSnapshot: boolean,
  width: number,
  affixSignature: string,
): string | undefined {
  const rootElement = rootRef.value;
  const searchIndex = probeSearchIndex;
  if (
    !hasWidthSnapshot ||
    !rootElement ||
    !searchIndex ||
    !canCacheRoot(rootElement, searchIndex) ||
    hasUnresolvedInlineStyles(prepared.root)
  ) {
    return undefined;
  }

  const ancestorKey = ancestorStyleContextKey(rootElement);
  if (ancestorKey === null) {
    return undefined;
  }

  const styleSheetKey = styleSheetCacheKey();
  if (styleSheetKey === null) {
    return undefined;
  }

  return tupleCacheKey([
    width,
    affixSignature,
    searchIndex.atomicPathSignature,
    searchIndex.simpleLineStyleKey ?? "",
    ancestorKey,
    styleSheetKey,
  ]);
}

function isCacheableResult(result: RichClampResult): result is CachedResult {
  return !result.fallback && !!result.state;
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

  if (Math.abs(width - stateWidth) <= warmBootstrapWidthDelta) {
    return true;
  }

  const hint = rankHint;
  if (canUseSearchRank(hint)) {
    return warmSearchCanBeatCold(hint, width, lineLimit);
  }

  return false;
}

function canUseObservedRankSlope(hint: RankHint | null): hint is RankHint {
  return boundary === "word" && !!hint?.hasObservedRankSlope;
}

function canUseSearchRank(hint: RankHint | null): hint is RankHint {
  return canUseObservedRankSlope(hint) && hint.textRankSafe;
}

function clampRank(rank: number, rankCount: number): number {
  return Math.max(0, Math.min(rankCount - 1, rank));
}

function warmSearchCanBeatCold(
  hint: RankHint,
  width: number,
  lineLimit: number | undefined,
): boolean {
  const searchCount = hint.rankCount;
  const start = clampRank(hint.rank, searchCount);
  const target = estimatedTargetRank(hint, width);
  const coldProbes = estimateColdSearchMaxProbeCount(searchCount);
  const warmProbes = estimateWarmSearchProbeCount(
    searchCount,
    start,
    target,
    richWarmExpansionLimit,
  );
  const rankMove = Math.abs(target - start);

  return (
    warmProbes < coldProbes ||
    (warmRiskBudgetApplies(rankMove, lineLimit) && warmProbes <= coldProbes + 1)
  );
}

function warmRiskBudgetApplies(rankMove: number, lineLimit: number | undefined): boolean {
  if (rankMove <= warmSearchLocalCoverage(richWarmExpansionLimit)) {
    return true;
  }

  return lineLimit !== 1;
}

function estimatedTargetRank(hint: RankHint, width: number): number {
  const deltaWidth = width - hint.width;
  const rankMove = Math.abs(deltaWidth) * hint.rankPerPx;
  const target = clampRank(hint.rank, hint.rankCount) + Math.sign(deltaWidth) * Math.ceil(rankMove);

  return clampRank(target, hint.rankCount);
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

function nextRankSlopeObserved(
  previous: RankHint | null,
  width: number,
  sameAffix: boolean,
): boolean {
  // Same-width font or slot invalidations should not discard a slope learned
  // from an earlier resize.
  return sameAffix && !!previous && (previous.hasObservedRankSlope || previous.width !== width);
}

function updateRankHint(result: RichClampResult, width: number, sameAffix: boolean): void {
  if (result.rank === undefined || result.rankCount === undefined || result.rankCount <= 0) {
    rankHint = null;
    return;
  }

  const previous = rankHint;
  rankHint = {
    hasObservedRankSlope: nextRankSlopeObserved(previous, width, sameAffix),
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

function shouldVerifyFullCandidate(width: number): boolean {
  if (measuredWidth === null || width === measuredWidth) {
    return true;
  }

  if (width < measuredWidth) {
    return false;
  }

  return clampedMaxWidth === null || width > clampedMaxWidth;
}

function canSkipFullFit(width: number, sameAffix: boolean): boolean {
  const state = measuredState;
  const stateWidth = measuredWidth;
  if (state?.kind !== "clamped" || stateWidth === null || !sameAffix) {
    return false;
  }

  if (width <= stateWidth + warmBootstrapWidthDelta) {
    return true;
  }

  const hint = rankHint;
  if (!canUseObservedRankSlope(hint)) {
    return false;
  }

  return estimatedTargetRank(hint, width) < hint.rankCount - 1;
}

function patchVisible(prepared: PreparedRich, state: RichState): void {
  const bodyElement = bodyRef.value;
  if (!bodyElement) {
    // If Vue has not mounted the target body, discard states rather than
    // applying future patches against an unknown DOM state.
    resetStates();
    return;
  }

  visibleState = patchRich(prepared, bodyElement, visibleState, state, ellipsis);
}

async function applyStatus(nextClamped: boolean, nextFallback: boolean): Promise<void> {
  const changed = isClamped.value !== nextClamped || isFallback.value !== nextFallback;

  isClamped.value = nextClamped;
  isFallback.value = nextFallback;

  if (changed) {
    // The measured rich DOM is already final; this tick exposes clamped state
    // changes after Vue commits the visible patch.
    await nextTick();
  }
}

async function resetClamp(): Promise<void> {
  const prepared = preparedHtml.value;

  if (prepared) {
    // Reset through the structural patcher so existing visible descendants are
    // restored consistently with normal clamp commits.
    patchVisible(prepared, { kind: "full" });
  } else {
    resetStates();
  }

  await applyStatus(false, false);
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

function renderAffixSlot(part: "before" | "after"): VNodeChild | null {
  const slot = part === "before" ? slots.before : slots.after;
  if (!slot) {
    return null;
  }

  return renderMultilineAffixSlot({
    part,
    render: slot,
    setRef: part === "before" ? setBeforeElement : setAfterElement,
    slotProps: affixSlotProps(),
    slotStyle: multilineSlotStyle,
  });
}

function render(): VNodeChild {
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
  const beforeSlot = renderAffixSlot("before");
  if (beforeSlot) {
    children.push(beforeSlot);
  }

  children.push(
    h("span", {
      "data-part": "body",
      innerHTML: html,
      ref: bodyRef,
    }),
  );

  const afterSlot = renderAffixSlot("after");
  if (afterSlot) {
    children.push(afterSlot);
  }

  return h(
    rootTag,
    mergeProps(attrs, {
      "data-part": "root",
      ref: rootRef,
      style: rootStyle,
    }),
    [
      h(
        "span",
        {
          "data-part": "content",
          ref: contentRef,
        },
        children,
      ),
      h("span", {
        "aria-hidden": "true",
        ref: probeRef,
        style: richProbeStyle,
      }),
    ],
  );
}

defineRender(render);

watch(
  [() => html, () => maxLines, () => maxHeight, () => ellipsis, () => boundary],
  () => {
    // HTML and clamp semantics change the structural state space, so both
    // visible and probe patch cursors must restart.
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
