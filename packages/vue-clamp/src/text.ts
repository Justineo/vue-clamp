import { fitsContent } from "./layout.ts";
import {
  defaultWarmExpansionLimit,
  estimateColdSearchMaxProbeCount,
  searchFittingIndex,
  shouldVerifyFullCandidate,
  warmSearchLocalCoverage,
  warmTargetBeatsCold,
} from "./search.ts";

import type { ContentFitSample, SimpleLineFit, VisibleBoundsCache } from "./layout.ts";
import type { ClampBoundary, ClampLength, LineClampLocation } from "./types.ts";

// Text preparation is separated from DOM measurement so width-only reclamps can
// reuse the same boundary list instead of segmenting the source text again.
const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

const wordSegmenter = new Intl.Segmenter(undefined, {
  granularity: "word",
});

export interface PreparedText {
  readonly text: string;
  readonly boundary: ClampBoundary;
  readonly boundaryOffsets: readonly number[];
  readonly fallbackBoundaryOffsets?: readonly number[] | undefined;
  readonly hasCursiveText?: boolean;
}

function hasCursiveText(text: string): boolean {
  // Joining forms in Arabic and Syriac can make a longer candidate narrower.
  // Cache this source property during preparation, independently of resize hints.
  return /[\p{Script_Extensions=Arabic}\p{Script_Extensions=Syriac}]/u.test(text);
}

export interface TextClampHint {
  // Full-fit results identify their source without forcing a boundary rank.
  readonly fullPrepared?: PreparedText;
  readonly boundaryOffsets: readonly number[];
  readonly ellipsis?: string | undefined;
  readonly hasAffixes?: boolean | undefined;
  readonly kept: number;
  readonly lineCapacity?: number | undefined;
  readonly layoutKey?: string | undefined;
  readonly lineLimit?: number | undefined;
  readonly maxHeight?: ClampLength | undefined;
  readonly rankPerPx?: number;
  readonly rankPerPxWidth?: number;
  readonly ratio?: number | undefined;
  readonly clampedMaxWidth?: number;
  readonly rootWidth?: number;
  readonly spacing?: TextClampSpacing | undefined;
  readonly wordFallbackMaxWidth?: number;
}

export interface TextClampResult extends TextClampHint {
  readonly text: string;
}

export function setElementText(element: HTMLElement, text: string): void {
  const child = element.firstChild;

  if (child instanceof Text && child.nextSibling === null) {
    child.data = text;
    return;
  }

  element.textContent = text;
}

type RankSlope = {
  rankPerPx?: number;
  rankPerPxWidth?: number;
};
type WarmSearchInput = {
  readonly boundary: ClampBoundary;
  readonly candidateCount: number;
  readonly hasAffixes: boolean;
  readonly hintKept: number;
  readonly includeFullCandidate: boolean;
  readonly lineCapacity: number | undefined;
  readonly rankPerPx: number;
  readonly referenceWidth: number;
  readonly rootWidth: number;
};
export type TextClampSpacing = "trim" | "preserve-outer";

type TextFitContext = {
  readonly ellipsis: string;
  readonly ratio: number;
  readonly spacing: TextClampSpacing;
};

export type TextClampContext = TextFitContext & {
  readonly hasAffixes: boolean;
  readonly lineCapacity: number | undefined;
  readonly layoutKey?: string | undefined;
  readonly lineLimit: number | undefined;
  readonly maxHeight: ClampLength | undefined;
};

const maxComparableWidthRatio = 2;
const wordWarmExpansionLimit = defaultWarmExpansionLimit + 1;

export type TextClampFitInput = {
  readonly ellipsis: string;
  readonly expansionLimit?: number;
  readonly fits: (text: string) => boolean;
  readonly hint?: TextClampHint | null;
  readonly includeFullCandidate?: boolean;
  readonly prepared: PreparedText;
  readonly ratio: number;
  readonly spacing?: TextClampSpacing;
  readonly verifyFullCandidate?: boolean;
};

export type TextClampLayoutInput = {
  readonly content: HTMLElement;
  readonly ellipsis: string;
  readonly hasAffixes?: boolean;
  readonly hint?: TextClampHint | null;
  readonly lineCapacity?: number | undefined;
  readonly layoutKey?: string | undefined;
  readonly lineLimit: number | undefined;
  readonly maxHeight: ClampLength | undefined;
  readonly prepared: PreparedText;
  readonly ratio: number;
  readonly root: HTMLElement;
  readonly rootWidth: number;
  readonly reuseFullFitOnGrow?: boolean;
  readonly simpleLineFit?: SimpleLineFit;
  readonly target: HTMLElement;
};

function asciiBoundaryOffsets(text: string): number[] | null {
  const offsets = Array<number>(text.length + 1);
  offsets[0] = 0;

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if ((code < 0x20 || code > 0x7e) && code !== 0x09 && code !== 0x0a) {
      return null;
    }

    offsets[index + 1] = index + 1;
  }

  return offsets;
}

function graphemeBoundaryOffsets(text: string): number[] {
  const boundaryOffsets = [0];
  let offset = 0;

  for (const part of graphemeSegmenter.segment(text)) {
    offset += part.segment.length;
    boundaryOffsets.push(offset);
  }

  return boundaryOffsets;
}

function wordBoundaryOffsets(
  text: string,
  fallbackBoundaryOffsets: readonly number[],
  asciiSafe: boolean,
): number[] {
  const boundaryOffsets = [0];
  let fallbackIndex = 0;

  for (const part of wordSegmenter.segment(text)) {
    const offset = part.index + part.segment.length;
    while (!asciiSafe && (fallbackBoundaryOffsets[fallbackIndex] ?? Infinity) < offset) {
      fallbackIndex += 1;
    }

    // Only keep word boundaries that are also grapheme boundaries. This prevents
    // a word-level cut from landing inside a composed character.
    const isGraphemeBoundary = asciiSafe || fallbackBoundaryOffsets[fallbackIndex] === offset;
    if (isGraphemeBoundary && boundaryOffsets[boundaryOffsets.length - 1] !== offset) {
      boundaryOffsets.push(offset);
    }
  }

  if (boundaryOffsets[boundaryOffsets.length - 1] !== text.length) {
    boundaryOffsets.push(text.length);
  }

  return boundaryOffsets;
}

export function prepareText(text: string, boundary: ClampBoundary = "grapheme"): PreparedText {
  // ASCII has one UTF-16 code unit per grapheme in the accepted range, so the
  // common path builds its boundaries while checking safety in a single pass.
  const asciiOffsets = asciiBoundaryOffsets(text);
  const asciiSafe = asciiOffsets !== null;
  const fallbackBoundaryOffsets = asciiOffsets ?? graphemeBoundaryOffsets(text);

  if (boundary === "grapheme") {
    return {
      text,
      boundary,
      boundaryOffsets: fallbackBoundaryOffsets,
      hasCursiveText: !asciiSafe && hasCursiveText(text),
    };
  }

  // Word mode still keeps grapheme fallback metadata because very long words
  // need a last-resort way to fit inside narrow containers.
  return {
    text,
    boundary,
    boundaryOffsets: wordBoundaryOffsets(text, fallbackBoundaryOffsets, asciiSafe),
    fallbackBoundaryOffsets,
    hasCursiveText: !asciiSafe && hasCursiveText(text),
  };
}

function prepareWordText(text: string): PreparedText {
  const asciiSafe = /^[\x20-\x7e\t\n]*$/u.test(text);
  const graphemes = asciiSafe ? null : graphemeSegmenter.segment(text)[Symbol.iterator]();
  let graphemeEnd = 0;
  const boundaryOffsets = [0];
  for (const part of wordSegmenter.segment(text)) {
    const end = part.index + part.segment.length;
    // Walk the same grapheme sequence as eager preparation without retaining its
    // offsets. Some engines disagree between containing() and iteration at the
    // leading surrogate of an emoji, so endpoint queries are not interchangeable.
    while (graphemes && graphemeEnd < end) {
      const next = graphemes.next();
      if (next.done) break;
      graphemeEnd += next.value.segment.length;
    }
    if (asciiSafe || graphemeEnd === end) {
      boundaryOffsets.push(end);
    }
  }
  if (boundaryOffsets.at(-1) !== text.length) boundaryOffsets.push(text.length);
  let fallback: readonly number[] | undefined;
  return {
    text,
    boundary: "word",
    boundaryOffsets,
    hasCursiveText: !asciiSafe && hasCursiveText(text),
    get fallbackBoundaryOffsets() {
      return (fallback ??= asciiBoundaryOffsets(text) ?? graphemeBoundaryOffsets(text));
    },
  };
}

// Prototype accessors keep deferred preparation from allocating new getter
// closures for every short source and full-fit result.
class DeferredText implements PreparedText {
  #prepared: PreparedText | undefined;

  constructor(
    readonly text: string,
    readonly boundary: ClampBoundary,
  ) {}

  private resolve(): PreparedText {
    return (this.#prepared ??=
      this.boundary === "word"
        ? prepareWordText(this.text)
        : prepareText(this.text, this.boundary));
  }

  get boundaryOffsets(): readonly number[] {
    return this.resolve().boundaryOffsets;
  }
  get fallbackBoundaryOffsets(): readonly number[] | undefined {
    return this.resolve().fallbackBoundaryOffsets;
  }
  get hasCursiveText(): boolean {
    return this.resolve().hasCursiveText ?? false;
  }
}

class FullTextResult {
  constructor(
    readonly fullPrepared: PreparedText,
    readonly rootWidth: number,
  ) {}
  get text(): string {
    return this.fullPrepared.text;
  }
  get boundaryOffsets(): readonly number[] {
    return this.fullPrepared.boundaryOffsets;
  }
  get kept(): number {
    return this.fullPrepared.boundaryOffsets.length - 1;
  }
}

// Preserve the internal ranked result interface, resolving its rank only when
// a later overflow search consumes it. Full-fit rechecks still read current DOM.
export function fullTextClampResult(
  prepared: PreparedText,
  rootWidth: number,
  context: TextClampContext,
): TextClampResult {
  return Object.assign(new FullTextResult(prepared, rootWidth), context);
}

// Keep only one bounded, layout-independent preparation. DOM and search hints
// stay with each component; large sources evict the entry instead of being retained.
let sharedTextPreparation: PreparedText | null = null;
export function prepareSharedText(
  text: string,
  boundary: ClampBoundary = "grapheme",
): PreparedText {
  if (text.length > 8192) {
    sharedTextPreparation = null;
    return new DeferredText(text, boundary);
  }
  if (sharedTextPreparation?.text === text && sharedTextPreparation.boundary === boundary) {
    return sharedTextPreparation;
  }
  return (sharedTextPreparation = new DeferredText(text, boundary));
}

export function displayTextForKeptCount(
  prepared: PreparedText,
  ratio: number,
  ellipsis: string,
  kept: number,
  spacing: TextClampSpacing = "trim",
): string {
  const { boundaryOffsets, text } = prepared;
  const boundaryCount = boundaryOffsets.length - 1;

  if (kept >= boundaryCount) {
    // Full text candidates must not receive an ellipsis; callers use this branch
    // to detect unclamped output.
    return text;
  }

  // `kept` is split around the normalized location so start/middle/end clamping
  // share the same search over a single candidate count.
  const prefix = Math.floor(kept * ratio);
  const suffix = kept - prefix;

  if (prefix <= 0) {
    const suffixText = text.slice(boundaryOffsets[boundaryCount - suffix]);
    const trimSuffix = spacing === "preserve-outer" ? suffixText.trimStart() : suffixText.trim();

    return `${ellipsis}${trimSuffix}`;
  }

  const prefixText = text.slice(0, boundaryOffsets[prefix]);
  const trimPrefix = spacing === "preserve-outer" ? prefixText.trimEnd() : prefixText.trim();

  if (suffix <= 0) {
    return `${trimPrefix}${ellipsis}`;
  }

  const suffixText = text.slice(boundaryOffsets[boundaryCount - suffix]);
  const trimSuffix = spacing === "preserve-outer" ? suffixText.trimStart() : suffixText.trim();

  return `${trimPrefix}${ellipsis}${trimSuffix}`;
}

export function normalizeLocationRatio(location: LineClampLocation): number {
  if (location === "start") {
    return 0;
  }

  if (location === "middle") {
    return 0.5;
  }

  if (location === "end") {
    return 1;
  }

  return Math.max(0, Math.min(1, location));
}

export function nextClampedMaxWidth(
  hint: TextClampHint | null,
  kept: number,
  rootWidth: number,
  boundaryCount: number,
): Pick<TextClampHint, "clampedMaxWidth"> {
  if (kept >= boundaryCount) {
    return {};
  }

  return {
    clampedMaxWidth: Math.max(rootWidth, hint?.clampedMaxWidth ?? rootWidth),
  };
}

function nextWordFallbackMaxWidth(
  prepared: PreparedText,
  result: TextClampResult,
  hint: TextClampHint | null,
  rootWidth: number,
): Pick<TextClampHint, "wordFallbackMaxWidth"> {
  if (
    prepared.boundary !== "word" ||
    result.boundaryOffsets === prepared.boundaryOffsets ||
    prepared.fallbackBoundaryOffsets === undefined ||
    result.boundaryOffsets !== prepared.fallbackBoundaryOffsets
  ) {
    return {};
  }

  const previous =
    hint?.boundaryOffsets === prepared.fallbackBoundaryOffsets && hint.rootWidth !== rootWidth
      ? (hint.wordFallbackMaxWidth ?? hint.rootWidth)
      : undefined;

  return {
    wordFallbackMaxWidth: Math.max(rootWidth, previous ?? rootWidth),
  };
}

function observedRankSlope(hint: TextClampHint | null, kept: number, rootWidth: number): RankSlope {
  if (!hint?.rootWidth || hint.rootWidth <= 0) {
    return {};
  }

  const deltaWidth = Math.abs(rootWidth - hint.rootWidth);
  const rankDelta = Math.abs(kept - hint.kept);
  if (deltaWidth === 0 || rankDelta === 0) {
    return previousRankSlope(hint);
  }

  const rankPerPx = rankDelta / deltaWidth;
  if (!Number.isFinite(rankPerPx) || rankPerPx <= 0) {
    return previousRankSlope(hint);
  }

  return {
    rankPerPx,
    rankPerPxWidth: deltaWidth,
  };
}

function previousRankSlope(hint: TextClampHint): RankSlope {
  const result: RankSlope = {};
  if (hint.rankPerPx !== undefined) {
    result.rankPerPx = hint.rankPerPx;
  }

  if (hint.rankPerPxWidth !== undefined) {
    result.rankPerPxWidth = hint.rankPerPxWidth;
  }

  return result;
}

function sameTextClampContext(
  hint: TextClampHint | null,
  context: TextClampContext,
): hint is TextClampHint {
  return (
    !!hint &&
    hint.ellipsis === context.ellipsis &&
    (hint.hasAffixes ?? false) === context.hasAffixes &&
    hint.lineCapacity === context.lineCapacity &&
    hint.layoutKey === context.layoutKey &&
    hint.lineLimit === context.lineLimit &&
    hint.maxHeight === context.maxHeight &&
    hint.ratio === context.ratio &&
    hint.spacing === context.spacing
  );
}

export function matchingTextClampHint(
  prepared: PreparedText,
  hint: TextClampHint | null,
  context: TextClampContext,
): TextClampHint | null {
  if (!hint || !sameTextClampContext(hint, context)) return null;
  return (
    hint.fullPrepared
      ? hint.fullPrepared === prepared
      : hint.boundaryOffsets === prepared.boundaryOffsets
  )
    ? hint
    : null;
}

function sameTextFitContext(
  hint: TextClampHint | null,
  context: TextFitContext,
): hint is TextClampHint {
  return (
    !!hint &&
    hint.ellipsis === context.ellipsis &&
    hint.ratio === context.ratio &&
    hint.spacing === context.spacing
  );
}

function withTextClampMetrics(
  result: TextClampResult,
  hint: TextClampHint | null,
  prepared: PreparedText,
  rootWidth: number,
  context: TextClampContext,
): TextClampResult {
  const { ellipsis, layoutKey, lineLimit, maxHeight, ratio } = context;
  const metricHint = hint?.boundaryOffsets === result.boundaryOffsets ? hint : null;

  return {
    ...result,
    ellipsis,
    hasAffixes: context.hasAffixes || undefined,
    layoutKey,
    lineLimit,
    maxHeight,
    ...nextClampedMaxWidth(metricHint, result.kept, rootWidth, result.boundaryOffsets.length - 1),
    ...nextWordFallbackMaxWidth(prepared, result, metricHint, rootWidth),
    ...observedRankSlope(metricHint, result.kept, rootWidth),
    lineCapacity: context.lineCapacity,
    ratio,
    rootWidth,
    spacing: context.spacing,
  };
}

function comparableWidthScale(width: number, referenceWidth: number): boolean {
  return (
    Math.min(width, referenceWidth) * maxComparableWidthRatio >= Math.max(width, referenceWidth)
  );
}

function warmSearchTarget(input: WarmSearchInput): number | null {
  const { candidateCount, hintKept, includeFullCandidate, rankPerPx, referenceWidth, rootWidth } =
    input;

  if (
    !Number.isFinite(rankPerPx) ||
    rankPerPx <= 0 ||
    referenceWidth <= 0 ||
    !comparableWidthScale(rootWidth, referenceWidth)
  ) {
    return null;
  }

  const count = Math.max(1, candidateCount + (includeFullCandidate ? 1 : 0));
  const widthDelta = rootWidth - referenceWidth;
  const target = Math.max(
    0,
    Math.min(
      count - 1,
      hintKept + Math.sign(widthDelta) * Math.ceil(Math.abs(widthDelta) * rankPerPx),
    ),
  );
  const rankMove = Math.abs(target - hintKept);
  const coldProbes = estimateColdSearchMaxProbeCount(count);
  let allowPatchTieBreak: boolean;

  if (rankMove <= warmSearchLocalCoverage()) {
    allowPatchTieBreak = true;
  } else if (input.lineCapacity === 1) {
    allowPatchTieBreak = false;
  } else {
    allowPatchTieBreak =
      input.boundary === "word" ||
      (includeFullCandidate &&
        input.lineCapacity !== undefined &&
        input.lineCapacity >= 2 &&
        input.hasAffixes);
  }

  const coldCost = includeFullCandidate
    ? 1 + estimateColdSearchMaxProbeCount(count - 1)
    : coldProbes;

  return rankMove <= coldProbes &&
    warmTargetBeatsCold({
      allowPatchTieBreak,
      coldCost,
      count,
      hint: hintKept,
      target,
    })
    ? target
    : null;
}

function canUseTextLayoutHint(
  hint: TextClampHint | null,
  boundary: ClampBoundary,
  rootWidth: number,
  context: TextClampContext,
  includeFullCandidate = false,
): boolean {
  if (!hint) {
    return false;
  }

  if (hint.rootWidth === undefined || rootWidth === hint.rootWidth) {
    return true;
  }

  const input = {
    boundary,
    candidateCount: hint.boundaryOffsets.length - 1,
    hasAffixes: context.hasAffixes,
    hintKept: hint.kept,
    includeFullCandidate,
    lineCapacity: context.lineCapacity,
    rootWidth,
  };
  const { rankPerPx, rankPerPxWidth, rootWidth: hintWidth } = hint;

  return (
    (rankPerPx !== undefined &&
      rankPerPxWidth !== undefined &&
      hintWidth !== undefined &&
      rankPerPx > 0 &&
      rankPerPxWidth > 0 &&
      Math.abs(rootWidth - hintWidth) <= rankPerPxWidth &&
      warmSearchTarget({ ...input, rankPerPx, referenceWidth: hintWidth }) !== null) ||
    (hintWidth !== undefined &&
      hintWidth > 0 &&
      hint.kept > 0 &&
      warmSearchTarget({
        ...input,
        rankPerPx: hint.kept / hintWidth,
        referenceWidth: hintWidth,
      }) !== null)
  );
}

export function canSkipFullTextFit(
  prepared: PreparedText,
  hint: TextClampHint | null,
  rootWidth: number,
  context: TextClampContext,
): boolean {
  if (
    hint?.fullPrepared ||
    matchingTextClampHint(prepared, hint, context) === null ||
    hint?.rootWidth === undefined
  ) {
    return false;
  }

  const candidateCount = prepared.boundaryOffsets.length - 1;
  if (hint.kept >= candidateCount) {
    return false;
  }

  if (rootWidth <= hint.rootWidth) {
    return true;
  }

  const warmSearchInput = {
    boundary: prepared.boundary,
    candidateCount,
    hasAffixes: context.hasAffixes,
    hintKept: hint.kept,
    includeFullCandidate: true,
    lineCapacity: context.lineCapacity,
    rankPerPx: hint.kept / hint.rootWidth,
    referenceWidth: hint.rootWidth,
    rootWidth,
  };
  const target = warmSearchTarget(warmSearchInput);

  return target !== null && target < candidateCount;
}

function fallbackSearchPrepared(
  prepared: PreparedText,
  hint: TextClampHint | null,
  rootWidth: number,
): PreparedText {
  if (
    prepared.boundary !== "word" ||
    !hint ||
    hint.boundaryOffsets === prepared.boundaryOffsets ||
    !prepared.fallbackBoundaryOffsets ||
    hint.boundaryOffsets !== prepared.fallbackBoundaryOffsets ||
    hint.rootWidth === undefined ||
    rootWidth === hint.rootWidth
  ) {
    return prepared;
  }

  const fallbackMaxWidth = hint.wordFallbackMaxWidth ?? hint.rootWidth;
  if (rootWidth > fallbackMaxWidth) {
    return prepared;
  }

  return {
    text: prepared.text,
    boundary: "grapheme",
    boundaryOffsets: prepared.fallbackBoundaryOffsets,
  };
}

function canReuseFullFitOnGrow(
  hint: TextClampHint | null,
  rootWidth: number,
  boundaryCount: number,
): hint is TextClampHint {
  return (
    !!hint &&
    hint.rootWidth !== undefined &&
    rootWidth > hint.rootWidth &&
    hint.kept >= boundaryCount
  );
}

export function clampTextToFit(input: TextClampFitInput): TextClampResult {
  const search = searchTextCandidates(input);
  let step = search.next();
  while (!step.done) {
    step = search.next(input.fits(step.value));
  }
  return step.value;
}

export function* searchTextCandidates({
  ellipsis,
  expansionLimit = defaultWarmExpansionLimit,
  hint,
  includeFullCandidate = false,
  prepared,
  ratio,
  spacing = "trim",
  verifyFullCandidate = true,
}: Omit<TextClampFitInput, "fits">): Generator<string, TextClampResult, boolean> {
  const boundaryCount = prepared.boundaryOffsets.length - 1;
  const searchCount = Math.max(1, boundaryCount + (includeFullCandidate ? 1 : 0));
  const context: TextFitContext = {
    ellipsis,
    ratio,
    spacing,
  };
  const textHint = hint ?? null;
  let checkedFullCandidate = false;

  function* fitsKeptCount(kept: number): Generator<string, boolean, boolean> {
    if (includeFullCandidate && kept >= boundaryCount) {
      checkedFullCandidate = true;
    }

    return yield displayTextForKeptCount(prepared, ratio, ellipsis, kept, spacing);
  }

  // The search helper works over indexes. For text, the index is the number of
  // boundary units kept, with at least the zero-kept ellipsis candidate present.
  const search = searchFittingIndex(
    searchCount,
    textHint?.boundaryOffsets === prepared.boundaryOffsets && sameTextFitContext(textHint, context)
      ? textHint.kept
      : null,
    expansionLimit,
    !(prepared.hasCursiveText ?? hasCursiveText(prepared.text)) && !hasCursiveText(ellipsis),
  );
  let step = search.next();
  while (!step.done) {
    step = search.next(yield* fitsKeptCount(step.value));
  }
  let best = Math.max(0, step.value);

  if (
    includeFullCandidate &&
    verifyFullCandidate &&
    best < boundaryCount &&
    !checkedFullCandidate
  ) {
    // The full-text candidate omits the ellipsis, so it is not guaranteed to be
    // monotonic with the truncated candidates that precede it.
    checkedFullCandidate = true;
    if (yield* fitsKeptCount(boundaryCount)) {
      best = boundaryCount;
    }
  }

  if (best === 0 && prepared.fallbackBoundaryOffsets) {
    // Whole-word truncation should never fail completely just because a single
    // word is wider than the container; retry at grapheme granularity.
    return yield* searchTextCandidates({
      ellipsis,
      expansionLimit,
      hint: textHint,
      includeFullCandidate,
      prepared: {
        text: prepared.text,
        boundary: "grapheme",
        boundaryOffsets: prepared.fallbackBoundaryOffsets,
        hasCursiveText: prepared.hasCursiveText ?? hasCursiveText(prepared.text),
      },
      ratio,
      spacing,
      verifyFullCandidate,
    });
  }

  const text = displayTextForKeptCount(prepared, ratio, ellipsis, best, spacing);

  return {
    boundaryOffsets: prepared.boundaryOffsets,
    ellipsis,
    kept: best,
    ratio,
    spacing,
    text,
  };
}

export function clampTextToLayout(input: TextClampLayoutInput): TextClampResult | null {
  const search = searchTextLayout(input);
  let step = search.next();
  while (!step.done) {
    step = search.next(step.value());
  }
  return step.value;
}

export function* searchTextLayout(
  {
    content,
    ellipsis,
    hasAffixes = false,
    hint,
    lineCapacity,
    layoutKey,
    lineLimit,
    maxHeight,
    prepared,
    ratio,
    root,
    rootWidth,
    reuseFullFitOnGrow = false,
    simpleLineFit,
    target,
  }: TextClampLayoutInput,
  reuseRootPosition = true,
): Generator<() => boolean, TextClampResult | null, boolean> {
  if (rootWidth <= 0) {
    // Measuring against an unlaid-out root would only cache a bogus clamp.
    return null;
  }

  const { text } = prepared;
  const context: TextClampContext = {
    ellipsis,
    hasAffixes,
    lineCapacity,
    layoutKey,
    lineLimit,
    maxHeight,
    ratio,
    spacing: "trim",
  };
  const currentHint = hint ?? null;
  const textHint = matchingTextClampHint(prepared, currentHint, context);

  if (
    reuseFullFitOnGrow &&
    textHint?.fullPrepared &&
    textHint.rootWidth !== undefined &&
    rootWidth > textHint.rootWidth
  ) {
    return fullTextClampResult(prepared, rootWidth, context);
  }
  if (
    !textHint?.fullPrepared &&
    reuseFullFitOnGrow &&
    textHint &&
    canReuseFullFitOnGrow(textHint, rootWidth, prepared.boundaryOffsets.length - 1)
  ) {
    return withTextClampMetrics(
      {
        boundaryOffsets: prepared.boundaryOffsets,
        kept: prepared.boundaryOffsets.length - 1,
        text,
      },
      textHint,
      prepared,
      rootWidth,
      context,
    );
  }

  const skipFullFit = canSkipFullTextFit(prepared, textHint, rootWidth, context);
  let searchHint =
    textHint?.fullPrepared ||
    canUseTextLayoutHint(textHint, prepared.boundary, rootWidth, context, skipFullFit)
      ? textHint
      : null;
  const expansionLimit =
    prepared.boundary === "word" ? wordWarmExpansionLimit : defaultWarmExpansionLimit;
  const visibleBoundsCache: VisibleBoundsCache | undefined =
    maxHeight === undefined ? undefined : {};
  let currentText = target.textContent ?? "";
  let fullFitSample: ContentFitSample | undefined;

  function applyText(nextText: string): void {
    if (nextText !== currentText) {
      setElementText(target, nextText);
      currentText = nextText;
    }
  }

  if (!skipFullFit) {
    applyText(text);
    if (
      yield () =>
        fitsContent(
          root,
          content,
          lineLimit,
          maxHeight,
          true,
          visibleBoundsCache,
          simpleLineFit,
          (sample) => {
            fullFitSample = sample;
          },
        )
    ) {
      // The full source is the cheapest and most correct answer when it fits.
      // Store it as a warm-start hint so later shrink passes begin from full text.
      if (!textHint || textHint.fullPrepared)
        return fullTextClampResult(prepared, rootWidth, context);
      return withTextClampMetrics(
        {
          boundaryOffsets: prepared.boundaryOffsets,
          kept: prepared.boundaryOffsets.length - 1,
          text,
        },
        textHint,
        prepared,
        rootWidth,
        context,
      );
    }

    if (
      textHint?.fullPrepared &&
      !canUseTextLayoutHint(textHint, prepared.boundary, rootWidth, context, skipFullFit)
    ) {
      searchHint = null;
    }
    const fullLineCount = fullFitSample?.rects?.length;
    const fullSize = fullLineCount ?? fullFitSample?.bounds?.height;
    const capacity = fullLineCount === undefined ? visibleBoundsCache?.height : lineCapacity;
    const boundaryCount = prepared.boundaryOffsets.length - 1;
    const coldBoundaryOffsets =
      boundaryCount <= 16 && prepared.fallbackBoundaryOffsets
        ? prepared.fallbackBoundaryOffsets
        : prepared.boundaryOffsets;
    const coldBoundaryCount = coldBoundaryOffsets.length - 1;
    if (
      searchHint === null &&
      capacity !== undefined &&
      capacity > 0 &&
      fullSize !== undefined &&
      fullSize >= capacity * 3 &&
      coldBoundaryCount > 16
    ) {
      // The exact full-text rect read is already paid for. Its line-count ratio
      // gives cold search a first rank without becoming a layout proof.
      searchHint = {
        boundaryOffsets: coldBoundaryOffsets,
        ellipsis,
        kept: Math.min(
          coldBoundaryCount - 1,
          Math.max(0, Math.floor((coldBoundaryCount * capacity) / fullSize)),
        ),
        ratio,
        spacing: "trim",
      };
    }
  }

  const search = searchTextCandidates({
    ellipsis,
    expansionLimit,
    hint: searchHint,
    includeFullCandidate: skipFullFit,
    prepared: fallbackSearchPrepared(prepared, textHint, rootWidth),
    ratio,
    verifyFullCandidate: shouldVerifyFullCandidate(
      skipFullFit,
      rootWidth,
      searchHint?.rootWidth,
      (searchHint?.kept ?? 0) >= prepared.boundaryOffsets.length - 1,
      searchHint?.clampedMaxWidth,
    ),
  });
  let step = search.next();
  while (!step.done) {
    applyText(step.value);
    // Other searches can change preceding sibling heights between rounds.
    // Keep border/height reuse, but reacquire the viewport position for this read.
    if (!reuseRootPosition && visibleBoundsCache) visibleBoundsCache.top = undefined;
    const fits = yield () =>
      fitsContent(root, content, lineLimit, maxHeight, true, visibleBoundsCache, simpleLineFit);
    step = search.next(fits);
  }
  const result = step.value;
  applyText(result.text);

  return withTextClampMetrics(result, textHint, prepared, rootWidth, context);
}
