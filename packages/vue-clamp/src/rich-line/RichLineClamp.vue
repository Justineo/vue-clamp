<script setup lang="ts">
import { computed, h, mergeProps, nextTick, shallowRef, useAttrs, watch } from "vue";
import { borderBoxWidth, cssLength, normalizeLineLimit } from "../layout.ts";
import { useMultilineClamp } from "../multiline.ts";
import { renderMultilineAffixSlot } from "../multiline-render.ts";
import { multilineSlotStyle } from "../multiline-styles.ts";
import { clampRich, patchRich, prepareRich } from "../rich.ts";
import {
  binarySearchProbeCount,
  warmSearchLocalCoverage,
  warmSearchProbeCount,
  warmSearchRankMoveBudget,
} from "../search.ts";
import { richProbeStyle } from "./styles.ts";

import type { VNodeChild } from "vue";
import type { ClampEmits } from "../types.ts";
import type { PreparedRich, RichClampProbe, RichClampResult, RichState } from "../rich.ts";
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

type RichRankHint = {
  rank: number;
  rankCount: number;
  rankMoveError: number;
  rankPerPx: number;
  width: number;
};

const richWarmSearchExpansionLimit = 3;
const richRankPerPxEmaWeight = 0.35;

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

// The visible tree and hidden probe advance independently: visibleState patches
// user-facing DOM, while probeState keeps measurement patches cheap across
// repeated reclamps.
let visibleState: RichState | null = null;
let probeState: RichState | null = null;
let probeElements: ProbeElements | null = null;
let probeStateAffixSignature: string | null = null;
let probeStateWidth: number | null = null;
let probeRankHint: RichRankHint | null = null;

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
    const searchHint = canUseRichSearchHint(probe.width) ? probeState : null;
    const preferHintedTextRun =
      searchHint?.kind === "clamped" &&
      probeStateWidth !== null &&
      affixSignature === probeStateAffixSignature;
    // Search hints help nearby resizes but can cost more on large jumps. The
    // current probe state is still passed separately so patching remains correct
    // even when the search starts cold.
    const result = clampRich({
      ellipsis,
      from: probeState,
      hint: searchHint,
      lineLimit,
      maxHeight,
      prepared,
      preferHintedTextRun,
      probe,
      skipFullFit: canSkipFullRichFit(probe.width),
    });
    probeState = result.state;
    probeStateAffixSignature = affixSignature;
    probeStateWidth = probe.width;
    updateProbeRankHint(result, probe.width);

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
  probeState = null;
  probeStateAffixSignature = null;
  probeStateWidth = null;
  probeRankHint = null;
}

function canSkipFullRichFit(width: number): boolean {
  const state = probeState;
  const rankHint = probeRankHint;

  if (state?.kind !== "clamped" || !rankHint) {
    return false;
  }

  const deltaWidth = width - rankHint.width;
  if (deltaWidth <= 0) {
    return true;
  }

  const hiddenRank = rankHint.rankCount - rankHint.rank;
  const searchCount = richSearchCount(rankHint, true);
  const estimatedGain = deltaWidth * rankHint.rankPerPx;

  if (rankHint.rank + Math.ceil(estimatedGain) >= rankHint.rankCount) {
    return false;
  }

  return (
    deltaWidth <= richFullFitSkipWidthBudget(rankHint.width, searchCount) &&
    estimatedGain < hiddenRank &&
    estimatedBestRichSearchProbeCount(width, true) <=
      1 + estimatedBestRichSearchProbeCount(width, false)
  );
}

function canUseRichSearchHint(width: number): boolean {
  const rankHint = probeRankHint;

  if (!probeState || !rankHint) {
    return false;
  }

  const searchCount = richSearchCount(rankHint, true);
  const estimatedRankMove = Math.abs(width - rankHint.width) * rankHint.rankPerPx;
  const localCoverage = warmSearchLocalCoverage(richWarmSearchExpansionLimit);
  // Local expansion already absorbs small layout quantization errors; only
  // prediction misses beyond that local window should make a hint cold.
  const excessPredictionError =
    estimatedRankMove <= localCoverage ? 0 : Math.max(0, rankHint.rankMoveError - localCoverage);
  const rankMoveBudget = richWarmSearchRankBudget(searchCount);

  return estimatedRankMove + excessPredictionError <= rankMoveBudget;
}

function richSearchCount(rankHint: RichRankHint, includeFullCandidate: boolean): number {
  return rankHint.rankCount + (includeFullCandidate ? 1 : 0);
}

function richWarmSearchRankBudget(searchCount: number): number {
  return warmSearchRankMoveBudget(searchCount, richWarmSearchExpansionLimit);
}

function richFullFitSkipWidthBudget(width: number, searchCount: number): number {
  return width / binarySearchProbeCount(searchCount);
}

function estimatedRichTargetRank(width: number, includeFullCandidate: boolean): number {
  const rankHint = probeRankHint;
  if (!rankHint) {
    return 0;
  }

  const maxRank = richSearchCount(rankHint, includeFullCandidate) - 1;
  const deltaWidth = width - rankHint.width;
  const rankMove = Math.abs(deltaWidth) * rankHint.rankPerPx + Math.max(0, rankHint.rankMoveError);
  const target =
    Math.max(0, Math.min(maxRank, rankHint.rank)) + Math.sign(deltaWidth) * Math.ceil(rankMove);

  return Math.max(0, Math.min(maxRank, target));
}

function estimatedBestRichSearchProbeCount(width: number, includeFullCandidate: boolean): number {
  const rankHint = probeRankHint;
  if (!rankHint) {
    return 0;
  }

  const searchCount = richSearchCount(rankHint, includeFullCandidate);
  const target = estimatedRichTargetRank(width, includeFullCandidate);

  return Math.min(
    warmSearchProbeCount(searchCount, rankHint.rank, target, richWarmSearchExpansionLimit),
    binarySearchProbeCount(searchCount),
  );
}

function initialRichRankPerPx(rank: number, width: number): number {
  return Math.max(1 / width, rank / width);
}

function nextRichRankPerPx(result: RichClampResult, width: number): number {
  const rank = result.rank ?? 0;
  const previous = probeRankHint;
  if (!previous || previous.rankCount !== result.rankCount) {
    return initialRichRankPerPx(rank, width);
  }

  const deltaWidth = Math.abs(width - previous.width);
  if (deltaWidth === 0) {
    return previous.rankPerPx;
  }

  const observed = Math.abs(rank - previous.rank) / deltaWidth;
  if (!Number.isFinite(observed) || observed <= 0) {
    return previous.rankPerPx;
  }

  return previous.rankPerPx * (1 - richRankPerPxEmaWeight) + observed * richRankPerPxEmaWeight;
}

function nextRichRankMoveError(result: RichClampResult, width: number): number {
  const rank = result.rank ?? 0;
  const previous = probeRankHint;
  if (!previous || previous.rankCount !== result.rankCount) {
    return 0;
  }

  const deltaWidth = Math.abs(width - previous.width);
  if (deltaWidth === 0) {
    return previous.rankMoveError;
  }

  const observed = Math.abs(rank - previous.rank);
  const predicted = deltaWidth * previous.rankPerPx;
  const error = Math.abs(observed - predicted);

  return Math.max(error, previous.rankMoveError * (1 - richRankPerPxEmaWeight));
}

function updateProbeRankHint(result: RichClampResult, width: number): void {
  if (result.rank === undefined || result.rankCount === undefined || result.rankCount <= 0) {
    probeRankHint = null;
    return;
  }

  probeRankHint = {
    rank: result.rank,
    rankCount: result.rankCount,
    rankMoveError: nextRichRankMoveError(result, width),
    rankPerPx: nextRichRankPerPx(result, width),
    width,
  };
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
