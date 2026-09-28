import { findLargestFittingCount, searchFittingIndex } from "../search.ts";
import { displayTextForKeptCount, searchTextCandidates } from "../text.ts";

import type {
  PreparedText,
  TextCandidateSearch,
  TextClampResult,
  TextFitCandidate,
} from "../text.ts";

type SearchInput = Parameters<TextCandidateSearch>[0];
type EndResult = TextClampResult & { readonly characterBoundKept?: number };
type EndSearchContext = {
  readonly content: HTMLElement;
  readonly target: HTMLElement;
  readonly lineLimit: number;
  readonly rootWidth: number;
  readonly style: CSSStyleDeclaration;
};
type EndPreparation = {
  readonly words: readonly number[];
  readonly cursive: boolean;
  readonly dictionary: boolean;
  readonly thai: boolean;
  readonly breakControls: boolean;
  readonly longAsciiToken: boolean;
};

const preparations = new WeakMap<PreparedText, EndPreparation>();
const cursive = /[\p{Script_Extensions=Arabic}\p{Script_Extensions=Syriac}]/u;
const dictionary =
  /[\p{Script_Extensions=Thai}\p{Script_Extensions=Lao}\p{Script_Extensions=Khmer}\p{Script_Extensions=Myanmar}]/u;

function prepareEnd(prepared: PreparedText): EndPreparation {
  let result = preparations.get(prepared);
  if (result) return result;
  const words: number[] = [];
  let longAsciiToken = false;
  for (const match of prepared.text.matchAll(/[^ \t\n\r\f]+/gu)) {
    words.push(match.index, match.index + match[0].length);
    longAsciiToken ||= match[0].length > 64 && !/^[A-Za-z0-9]+$/u.test(match[0]);
  }
  result = {
    words,
    cursive: prepared.hasCursiveText ?? cursive.test(prepared.text),
    dictionary: dictionary.test(prepared.text),
    thai: /^[\p{Script_Extensions=Thai} \t\n\r\f]+$/u.test(prepared.text),
    breakControls: /[-\u00ad\u200b]/u.test(prepared.text),
    longAsciiToken: longAsciiToken && /^[\p{ASCII}\u00ad\u200b]+$/u.test(prepared.text),
  };
  preparations.set(prepared, result);
  return result;
}

function rankAtOffset(offsets: readonly number[], offset: number): number {
  return findLargestFittingCount(0, offsets.length - 1, (rank) => offsets[rank]! <= offset);
}

function resultFor(input: SearchInput, kept: number): TextClampResult {
  return {
    boundaryOffsets: input.prepared.boundaryOffsets,
    ellipsis: input.ellipsis,
    kept,
    ratio: 1,
    spacing: "trim",
    text: displayTextForKeptCount(input.prepared, 1, input.ellipsis, kept),
  };
}

function* descend(input: SearchInput, upper: number): Generator<string, TextClampResult, boolean> {
  let previous: string | undefined;
  for (let kept = upper; kept >= 0; kept--) {
    const result = resultFor(input, kept);
    if (result.text === previous) continue;
    previous = result.text;
    if (yield result.text) return result;
  }
  return resultFor(input, 0);
}

function stableFlow(style: CSSStyleDeclaration): boolean {
  return (
    style.writingMode === "horizontal-tb" &&
    style.direction === "ltr" &&
    (!style.textWrapStyle || style.textWrapStyle === "auto") &&
    ["normal", "pre-wrap", "pre-line", "break-spaces"].includes(style.whiteSpace)
  );
}

function* searchWords(
  input: SearchInput,
  data: EndPreparation,
  context: EndSearchContext,
): Generator<TextFitCandidate, TextClampResult, boolean> {
  const { prepared, ellipsis } = input;
  const { words } = data;
  const count = prepared.boundaryOffsets.length - 1;
  const hint = input.hint?.kept;
  let wordHint: number | undefined;
  if (hint !== undefined) {
    const offset = prepared.boundaryOffsets[Math.min(count, Math.max(0, hint))]!;
    wordHint = findLargestFittingCount(
      0,
      words.length / 2 - 1,
      (word) => words[word * 2]! <= offset,
    );
  }

  // Keep the separating whitespace: the marker must not enlarge the preceding
  // completed word. This lower candidate bounds a whole word, independently of
  // the non-monotonic marked cuts around its start.
  const coarse = searchFittingIndex(words.length / 2, wordHint);
  let step = coarse.next();
  while (!step.done) {
    step = coarse.next(yield prepared.text.slice(0, words[step.value * 2]).trimStart() + ellipsis);
  }
  for (let word = step.value; word >= 0; word--) {
    const start = words[word * 2]!;
    const end = words[word * 2 + 1]!;
    const low = rankAtOffset(prepared.boundaryOffsets, start) + 1;
    const high = Math.min(count - 1, rankAtOffset(prepared.boundaryOffsets, end));
    // Hyphens, soft breaks and contextual scripts can introduce another fit
    // island inside a token. Keep those cuts out of the ordinary advance search.
    const simple =
      /^[A-Za-z0-9\p{Unified_Ideograph}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}。、，．！？：；]+$/u.test(
        prepared.text.slice(start, end),
      ) && context.style.hyphens !== "auto";
    const search = searchFittingIndex(
      high - low + 1,
      hint === undefined ? null : hint - low,
      2,
      simple,
    );
    let candidate = search.next();
    while (!candidate.done) {
      const rank = low + candidate.value;
      candidate = search.next(
        rank === input.anchor && input.anchorFits !== undefined
          ? input.anchorFits
          : yield resultFor(input, rank).text,
      );
    }
    if (candidate.value >= 0) return resultFor(input, low + candidate.value);
  }
  return resultFor(input, 0);
}

function* searchCharacterBound(
  input: SearchInput,
  context: EndSearchContext,
): Generator<string, EndResult, boolean> {
  const { prepared, hint } = input;
  const previous = (hint as EndResult | null | undefined)?.characterBoundKept;
  const kept =
    previous === undefined
      ? hint?.kept
      : Math.round((previous * context.rootWidth) / (hint?.rootWidth || context.rootWidth));
  const style = context.target.getAttribute("style");
  let upper: TextClampResult;
  // Relax breaks around punctuation as well as letters. Keep the marker: bare
  // text can have a different break opportunity before an after affix. Every
  // result is subsequently checked under the original wrapping.
  context.target.setAttribute("style", `${style ?? ""};line-break:anywhere!important`);
  try {
    upper = yield* searchTextCandidates({
      prepared,
      ellipsis: input.ellipsis,
      ratio: 1,
      hint:
        kept === undefined
          ? null
          : {
              boundaryOffsets: prepared.boundaryOffsets,
              ellipsis: input.ellipsis,
              kept,
              ratio: 1,
              spacing: "trim",
            },
    });
  } finally {
    if (style === null) context.target.removeAttribute("style");
    else context.target.setAttribute("style", style);
  }
  const result = yield* descend(input, Math.min(prepared.boundaryOffsets.length - 2, upper.kept));
  return { ...result, characterBoundKept: upper.kept };
}

function untransformed(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) {
    const style = getComputedStyle(current);
    if (
      style.transform !== "none" ||
      (style.rotate && style.rotate !== "none") ||
      (style.scale && style.scale !== "none")
    )
      return false;
  }
  return true;
}

function* searchFromLineEnd(
  input: SearchInput,
  data: EndPreparation,
  context: EndSearchContext,
): Generator<TextFitCandidate, TextClampResult, boolean> {
  let upper = input.prepared.boundaryOffsets.length - 2;
  if (data.words.length > 2) {
    const source = input.prepared.text.trimStart();
    const trim = input.prepared.text.length - source.length;
    yield {
      text: source,
      read: () => {
        if (!(context.target.firstChild instanceof Text) || !untransformed(context.target))
          return false;
        const lines: DOMRect[] = [];
        for (const rect of context.content.getClientRects()) {
          if (
            rect.height <= 0 ||
            lines.some(
              (line) =>
                Math.abs(line.top - rect.top) <= 0.5 && Math.abs(line.bottom - rect.bottom) <= 0.5,
            )
          )
            continue;
          lines.push(rect);
        }
        lines.sort((a, b) => a.top - b.top);
        const ceiling = lines[context.lineLimit - 1]?.bottom;
        if (ceiling === undefined) return false;
        const range = document.createRange();
        range.setStart(context.target.firstChild, 0);
        let low = 0;
        let high = data.words.length / 2 - 1;
        while (low < high) {
          const middle = Math.floor((low + high) / 2);
          range.setEnd(context.target.firstChild, Math.max(0, data.words[middle * 2 + 1]! - trim));
          const rects = range.getClientRects();
          // A taller fallback glyph can extend below its own line's font box.
          // Its top must be beyond the allowed line before excluding later words.
          if (rects.length > 0 && rects[rects.length - 1]!.top > ceiling + 0.5) high = middle;
          else low = middle + 1;
        }
        upper = Math.min(
          upper,
          rankAtOffset(input.prepared.boundaryOffsets, data.words[low * 2 + 1]!),
        );
        return false;
      },
    };
  }
  return yield* descend(input, upper);
}

export function* searchLineEndCandidates(
  input: SearchInput,
  context: EndSearchContext,
): Generator<TextFitCandidate, TextClampResult, boolean> {
  const data = prepareEnd(input.prepared);
  if (data.cursive || cursive.test(input.ellipsis)) return yield* searchTextCandidates(input);
  // Long ASCII punctuation runs retain the existing measured policy. Forcing
  // their wrapping can exclude prefixes whose authored CSS allows horizontal
  // overflow, while full-token descent adds a large cost to URLs and identifiers.
  if (data.longAsciiToken) return yield* searchTextCandidates(input);
  if (!stableFlow(context.style))
    return yield* searchTextCandidates({ ...input, monotonic: false });
  if (
    Number.parseFloat(context.style.letterSpacing) < 0 ||
    Number.parseFloat(context.style.wordSpacing) < 0 ||
    context.style.textTransform !== "none" ||
    /^[\p{Mark}\p{Join_Control}]/u.test(input.ellipsis) ||
    dictionary.test(input.ellipsis)
  )
    return yield* searchFromLineEnd(input, data, context);
  if (data.thai) {
    // Line limits alone do not forbid horizontal overflow. A character-wrap
    // bound is valid only when the original CSS already breaks oversized words.
    return yield* ["anywhere", "break-word"].includes(context.style.overflowWrap)
      ? searchCharacterBound(input, context)
      : searchTextCandidates(input);
  }
  if (data.words.length <= 2) {
    return yield* searchTextCandidates({
      ...input,
      monotonic: data.dictionary || data.breakControls ? false : input.monotonic,
    });
  }
  return yield* searchWords(input, data, context);
}
