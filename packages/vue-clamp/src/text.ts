import { fitsContent } from "./layout.ts";
import { defaultWarmExpansionLimit, searchFittingIndex } from "./search.ts";

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
  readonly ratio?: number | undefined;
  readonly clampedMaxWidth?: number;
  readonly rootWidth?: number;
  readonly spacing?: TextClampSpacing | undefined;
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

const wordWarmExpansionLimit = defaultWarmExpansionLimit + 1;

export type TextClampFitInput = {
  readonly anchor?: number | undefined;
  // A verdict from this same layout pass, taken before the full-source probe.
  readonly anchorFits?: boolean | undefined;
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

const unsafeUnit = /[^\x20-\u02ff\t\n]/u;

function unitBoundaryOffsets(text: string, firstUnsafe: number): number[] | null {
  if (firstUnsafe >= 0) return null;

  const offsets = Array<number>(text.length + 1);
  offsets[0] = 0;

  for (let index = 0; index < text.length; index += 1) {
    offsets[index + 1] = index + 1;
  }

  return offsets;
}

function isUnitSafe(code: number): boolean {
  return (code >= 0x20 && code <= 0x2ff) || code === 9 || code === 10;
}

function* iterateGraphemeBoundaryOffsets(text: string): Generator<number> {
  let start = 0;
  for (let index = 0; index < text.length;) {
    if (!isUnitSafe(text.charCodeAt(index))) {
      index += 1;
      continue;
    }
    const runStart = index;
    do index += 1;
    while (index < text.length && isUnitSafe(text.charCodeAt(index)));
    if (index - runStart < 64) continue;

    // Only split between two admitted units. Keep one unit at each side of
    // uncertain text so combining, prepend, pictograph and CR/LF context stays native.
    const end = index === text.length ? index : index - 1;
    let offset = runStart + 1;
    if (runStart > start) {
      for (const part of graphemeSegmenter.segment(text.slice(start, offset))) {
        yield start + part.index + part.segment.length;
      }
      offset += 1;
    }
    for (; offset <= end; offset += 1) yield offset;
    start = end;
  }
  if (start < text.length) {
    for (const part of graphemeSegmenter.segment(text.slice(start))) {
      yield start + part.index + part.segment.length;
    }
  }
}

function graphemeBoundaryOffsets(text: string, firstUnsafe: number): number[] {
  if (firstUnsafe >= 64) return [0, ...iterateGraphemeBoundaryOffsets(text)];

  // Sources without a long safe prefix keep the original native iteration path.
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
  unitSafe: boolean,
): number[] {
  const boundaryOffsets = [0];
  let fallbackIndex = 0;

  for (const part of wordSegmenter.segment(text)) {
    const offset = part.index + part.segment.length;
    while (!unitSafe && (fallbackBoundaryOffsets[fallbackIndex] ?? Infinity) < offset) {
      fallbackIndex += 1;
    }

    // Only keep word boundaries that are also grapheme boundaries. This prevents
    // a word-level cut from landing inside a composed character.
    const isGraphemeBoundary = unitSafe || fallbackBoundaryOffsets[fallbackIndex] === offset;
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
  // U+0020–U+02FF plus tab/LF have one UTF-16 unit per grapheme when the whole
  // source is admitted. Combining marks start at U+0300; CR stays excluded.
  const firstUnsafe = text.search(unsafeUnit);
  const unitSafe = firstUnsafe < 0;
  const fallbackBoundaryOffsets =
    unitBoundaryOffsets(text, firstUnsafe) ?? graphemeBoundaryOffsets(text, firstUnsafe);

  if (boundary === "grapheme") {
    return {
      text,
      boundary,
      boundaryOffsets: fallbackBoundaryOffsets,
      hasCursiveText: !unitSafe && hasCursiveText(text),
    };
  }

  // Word mode still keeps grapheme fallback metadata because very long words
  // need a last-resort way to fit inside narrow containers.
  return {
    text,
    boundary,
    boundaryOffsets: wordBoundaryOffsets(text, fallbackBoundaryOffsets, unitSafe),
    fallbackBoundaryOffsets,
    hasCursiveText: !unitSafe && hasCursiveText(text),
  };
}

function prepareWordText(text: string): PreparedText {
  const firstUnsafe = text.search(unsafeUnit);
  const unitSafe = firstUnsafe < 0;
  const boundaryOffsets = [0];
  if (firstUnsafe >= 64) {
    const graphemes = iterateGraphemeBoundaryOffsets(text);
    let graphemeEnd = 0;
    for (const part of wordSegmenter.segment(text)) {
      const end = part.index + part.segment.length;
      // Walk the same grapheme sequence as eager preparation without retaining its
      // offsets. Some engines disagree between containing() and iteration at the
      // leading surrogate of an emoji, so endpoint queries are not interchangeable.
      while (graphemeEnd < end) {
        const next = graphemes.next();
        if (next.done) break;
        graphemeEnd = next.value;
      }
      if (graphemeEnd === end) {
        boundaryOffsets.push(end);
      }
    }
  } else {
    const graphemes = unitSafe ? null : graphemeSegmenter.segment(text)[Symbol.iterator]();
    let graphemeEnd = 0;
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
      if (unitSafe || graphemeEnd === end) {
        boundaryOffsets.push(end);
      }
    }
  }
  if (boundaryOffsets.at(-1) !== text.length) boundaryOffsets.push(text.length);
  let fallback: readonly number[] | undefined;
  return {
    text,
    boundary: "word",
    boundaryOffsets,
    hasCursiveText: !unitSafe && hasCursiveText(text),
    get fallbackBoundaryOffsets() {
      return (fallback ??=
        unitBoundaryOffsets(text, firstUnsafe) ?? graphemeBoundaryOffsets(text, firstUnsafe));
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

// Share at most four pure preparations with an 8,192-unit combined source budget.
// DOM and search hints stay with each component; oversized sources clear the pool.
const sharedTextPreparations: PreparedText[] = [];
let sharedTextLength = 0;
export function prepareSharedText(
  text: string,
  boundary: ClampBoundary = "grapheme",
): PreparedText {
  if (text.length > 8192) {
    sharedTextPreparations.length = 0;
    sharedTextLength = 0;
    return new DeferredText(text, boundary);
  }
  const index = sharedTextPreparations.findIndex(
    (prepared) => prepared.text === text && prepared.boundary === boundary,
  );
  if (index !== -1) {
    const prepared = sharedTextPreparations[index]!;
    if (index > 0) {
      sharedTextPreparations.splice(index, 1);
      sharedTextPreparations.unshift(prepared);
    }
    return prepared;
  }
  const prepared = new DeferredText(text, boundary);
  while (sharedTextPreparations.length >= 4 || sharedTextLength + text.length > 8192)
    sharedTextLength -= sharedTextPreparations.pop()!.text.length;
  sharedTextPreparations.unshift(prepared);
  sharedTextLength += text.length;
  return prepared;
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

export function estimateTextRankFromFull({
  prepared,
  offsets,
  ratio,
  fitRatio,
}: {
  prepared: PreparedText;
  offsets: readonly number[];
  ratio: number;
  fitRatio: number;
}): number {
  const count = offsets.length - 1;
  const max = Math.max(0, count - 1);
  if (
    prepared.boundary !== "word" ||
    offsets !== prepared.boundaryOffsets ||
    !Number.isFinite(ratio)
  )
    return Math.max(0, Math.min(max, Math.floor(count * fitRatio)));

  // Word ranks have unequal lengths. Convert the paid full-width ratio into a
  // source-length budget before choosing a legal prefix/suffix cut. This is a
  // one-line hint, not a glyph-width model or a multiline packing estimate.
  const expected = prepared.text.length * fitRatio;
  let low = 0;
  let high = max;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const prefix = Math.floor(middle * ratio);
    const suffix = middle - prefix;
    const length = offsets[prefix]! + prepared.text.length - offsets[count - suffix]!;
    if (length <= expected) low = middle;
    else high = middle - 1;
  }
  return low;
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
      : hint.boundaryOffsets === prepared.boundaryOffsets ||
        hint.boundaryOffsets === prepared.fallbackBoundaryOffsets
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
    lineCapacity: context.lineCapacity,
    ratio,
    rootWidth,
    spacing: context.spacing,
  };
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
    hint?.boundaryOffsets !== prepared.boundaryOffsets ||
    hint?.rootWidth === undefined ||
    rootWidth === hint.rootWidth ||
    hint.kept >= hint.boundaryOffsets.length - 1
  ) {
    return false;
  }

  // Under stable inline geometry and width-monotonic fit, a compatible overflow
  // observation can omit the initial full-source read at a changed width.
  // Same-width updates still inspect current DOM; endpoint recovery is separate.
  return rootWidth <= (hint.clampedMaxWidth ?? hint.rootWidth);
}

export function shouldRecheckFullTextFit(
  hint: TextClampHint | null,
  result: TextClampHint,
  rootWidth: number,
): boolean {
  if (!hint || hint.boundaryOffsets !== result.boundaryOffsets) return false;

  // The old included-full search always visited full source after the largest
  // marked cut fit. More kept text after shrinking also contradicts the width
  // observation that allowed this pass to omit its initial full-source read.
  return (
    result.kept === result.boundaryOffsets.length - 2 ||
    (hint.rootWidth !== undefined && rootWidth < hint.rootWidth && result.kept > hint.kept)
  );
}

export function fallbackSearchPrepared(
  prepared: PreparedText,
  hint: TextClampHint | null,
): PreparedText {
  if (
    prepared.boundary !== "word" ||
    !hint ||
    hint.fullPrepared ||
    hint.boundaryOffsets === prepared.boundaryOffsets ||
    !prepared.fallbackBoundaryOffsets ||
    hint.boundaryOffsets !== prepared.fallbackBoundaryOffsets ||
    prepared.boundaryOffsets.length !== 2
  ) {
    return prepared;
  }

  // A single word has no positive marked word cut at any current layout.
  // Multiple words still enter their primary search before falling back.
  return {
    text: prepared.text,
    boundary: "grapheme",
    boundaryOffsets: prepared.fallbackBoundaryOffsets,
    hasCursiveText: prepared.hasCursiveText ?? hasCursiveText(prepared.text),
  };
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
  anchor,
  anchorFits: knownAnchorFits,
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
  if (boundaryCount === 1 && !includeFullCandidate && prepared.fallbackBoundaryOffsets) {
    // A single word has no positive marked word candidate. Either verdict for
    // rank zero enters grapheme fallback, so that probe carries no information.
    return yield* searchTextCandidates({
      ellipsis,
      expansionLimit,
      hint: hint ?? null,
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
  const searchCount = Math.max(1, boundaryCount + (includeFullCandidate ? 1 : 0));
  const context: TextFitContext = {
    ellipsis,
    ratio,
    spacing,
  };
  const textHint = hint ?? null;
  let checkedFullCandidate = false;
  // Adjacent word cuts can produce identical text after trimming. Keep both
  // verdicts for this solve so revisiting one after another candidate is free.
  let fittingText: string | undefined;
  let failingText: string | undefined;

  function* fitsKeptCount(kept: number): Generator<string, boolean, boolean> {
    if (includeFullCandidate && kept >= boundaryCount) {
      checkedFullCandidate = true;
    }

    const candidate = displayTextForKeptCount(prepared, ratio, ellipsis, kept, spacing);
    if (kept < boundaryCount) {
      if (candidate === fittingText) return true;
      if (candidate === failingText) return false;
    }
    const fits = yield candidate;
    // Keep bare full-source verification independent of marked-rank reuse,
    // including coincidentally identical strings.
    if (kept < boundaryCount) {
      if (fits) fittingText = candidate;
      else failingText = candidate;
    }
    return fits;
  }

  // The search helper works over indexes. For text, the index is the number of
  // boundary units kept, with at least the zero-kept ellipsis candidate present.
  const matchingHint =
    textHint?.boundaryOffsets === prepared.boundaryOffsets && sameTextFitContext(textHint, context);
  const hintKept = matchingHint ? textHint.kept : null;
  const monotonic =
    !(prepared.hasCursiveText ?? hasCursiveText(prepared.text)) && !hasCursiveText(ellipsis);
  let checkedAnchor: number | undefined;
  let anchorFits = false;
  if (matchingHint && anchor !== undefined && Number.isFinite(anchor) && monotonic) {
    const start = Math.max(0, Math.min(searchCount - 1, Math.floor(anchor)));
    if (start < boundaryCount) {
      checkedAnchor = start;
      anchorFits = knownAnchorFits ?? (yield* fitsKeptCount(start));
    }
  }
  const search = searchFittingIndex(searchCount, hintKept, expansionLimit, monotonic);
  let step = search.next();
  while (!step.done) {
    const kept = step.value;
    // Preserve the density tree and remove only queries implied by the fresh
    // anchor. The unmarked full source always retains its own measurement.
    const implied =
      checkedAnchor !== undefined &&
      kept < boundaryCount &&
      (anchorFits ? kept <= checkedAnchor : kept >= checkedAnchor);
    step = search.next(implied ? anchorFits : yield* fitsKeptCount(kept));
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
  const textHint = matchingTextClampHint(prepared, hint ?? null, context);
  const searchPrepared = fallbackSearchPrepared(prepared, textHint);

  if (reuseFullFitOnGrow && textHint?.rootWidth !== undefined && rootWidth > textHint.rootWidth) {
    if (textHint.fullPrepared) {
      return fullTextClampResult(prepared, rootWidth, context);
    }
    if (textHint.kept >= textHint.boundaryOffsets.length - 1) {
      return withTextClampMetrics(
        {
          boundaryOffsets: prepared.boundaryOffsets,
          kept: prepared.boundaryOffsets.length - 1,
          text,
        },
        textHint,
        rootWidth,
        context,
      );
    }
  }

  const expansionLimit =
    prepared.boundary === "word" ? wordWarmExpansionLimit : defaultWarmExpansionLimit;
  const skipFullFit = canSkipFullTextFit(prepared, textHint, rootWidth, context);
  let searchHint = textHint;
  const visibleBoundsCache: VisibleBoundsCache | undefined =
    maxHeight === undefined ? undefined : {};
  let currentText = target.textContent ?? "";
  let fullFitSample: ContentFitSample | undefined;
  let searchAnchor: number | undefined;
  let searchAnchorFits: boolean | undefined;

  function applyText(nextText: string): void {
    if (nextText !== currentText) {
      setElementText(target, nextText);
      currentText = nextText;
    }
  }

  if (!skipFullFit) {
    if (
      textHint &&
      !textHint.fullPrepared &&
      textHint.boundaryOffsets === searchPrepared.boundaryOffsets &&
      textHint.kept < searchPrepared.boundaryOffsets.length - 1 &&
      currentText === displayTextForKeptCount(searchPrepared, ratio, ellipsis, textHint.kept) &&
      !(prepared.hasCursiveText ?? hasCursiveText(prepared.text)) &&
      !hasCursiveText(ellipsis)
    ) {
      // Read the displayed candidate before writing full source. Its fresh
      // verdict can remove later marked probes without another DOM mutation.
      searchAnchor = textHint.kept;
      searchAnchorFits = yield () =>
        fitsContent(root, content, lineLimit, maxHeight, true, visibleBoundsCache, simpleLineFit);
    }
    applyText(text);
    if (!reuseRootPosition && visibleBoundsCache) visibleBoundsCache.top = undefined;
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
        rootWidth,
        context,
      );
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

  if (
    textHint &&
    searchHint?.rootWidth !== undefined &&
    !textHint.fullPrepared &&
    textHint.rootWidth !== undefined &&
    textHint.rootWidth > 0 &&
    textHint.rootWidth !== rootWidth
  ) {
    searchHint = {
      ...textHint,
      kept: Math.max(
        0,
        Math.min(
          textHint.boundaryOffsets.length - 2,
          Math.round((textHint.kept * rootWidth) / textHint.rootWidth),
        ),
      ),
    };
    if (
      skipFullFit &&
      textHint.boundaryOffsets === searchPrepared.boundaryOffsets &&
      textHint.kept < searchPrepared.boundaryOffsets.length - 1 &&
      textHint.kept !== searchHint.kept &&
      currentText === displayTextForKeptCount(searchPrepared, ratio, ellipsis, textHint.kept)
    ) {
      searchAnchor = textHint.kept;
    }
  }

  const search = searchTextCandidates({
    anchor: searchAnchor,
    anchorFits: searchAnchorFits,
    ellipsis,
    expansionLimit,
    hint: searchHint,
    prepared: searchPrepared,
    ratio,
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
  let metricHint = textHint;
  if (skipFullFit && shouldRecheckFullTextFit(textHint, result, rootWidth)) {
    applyText(text);
    if (!reuseRootPosition && visibleBoundsCache) visibleBoundsCache.top = undefined;
    if (
      yield () =>
        fitsContent(root, content, lineLimit, maxHeight, true, visibleBoundsCache, simpleLineFit)
    ) {
      return fullTextClampResult(prepared, rootWidth, context);
    }
    // Keep only this pass's measured overflow width after a recovery check.
    metricHint = null;
  }
  applyText(result.text);

  return withTextClampMetrics(result, metricHint, rootWidth, context);
}
