import type { ClampLength } from "./types.ts";

export const borderBoxObserverOptions: ResizeObserverOptions = { box: "border-box" };

type BorderBoxResizeListener = (entries: readonly ResizeObserverEntry[]) => void;

export function observeBorderBoxSizes(
  elements: readonly Element[],
  listener: BorderBoxResizeListener,
): () => void {
  // Keep delivery independent per clamp. A shared hub reduced callback objects
  // but not measured active work, while coupling otherwise unrelated instances.
  const observer = new ResizeObserver(listener);
  for (const element of elements) {
    observer.observe(element, borderBoxObserverOptions);
  }

  return () => {
    observer.disconnect();
  };
}

export function normalizeLineLimit(maxLines: number | undefined): number | undefined {
  if (maxLines === undefined || !Number.isFinite(maxLines) || maxLines <= 0) {
    return undefined;
  }

  return Math.max(1, Math.floor(maxLines));
}

// ResizeObserver, Vue updates, and font events can arrive in bursts. This runner
// keeps recomputes serialized while making sure a request that happens during a
// running clamp pass is not dropped.
export function createCoalescingRunner(task: () => Promise<void>): () => void {
  let scheduled = false;
  let running = false;

  async function flush(): Promise<void> {
    running = true;

    try {
      while (scheduled) {
        scheduled = false;
        await task();
      }
    } finally {
      running = false;

      if (scheduled) {
        void flush();
      }
    }
  }

  return () => {
    scheduled = true;

    if (!running) {
      void flush();
    }
  };
}

export function cssLength(value: ClampLength | undefined): string | undefined {
  return typeof value === "number" ? `${value}px` : value;
}

const contentIndependentWidth = /^(?:-?(?:\d|\.\d)|calc\(|clamp\(|max\(|min\()/u;
const unresolvedStyleReference = /(?:%|var\()/iu;
const lineHeight = /^(?:normal|-?(?:\d+|\d*\.\d+)(?:px)?)$/iu;
const pxLength = /^-?(?:\d+|\d*\.\d+)px$/iu;
export const inlineTextWidthProperties = [
  "font",
  "font-family",
  "font-feature-settings",
  "font-kerning",
  "font-optical-sizing",
  "font-size",
  "font-size-adjust",
  "font-stretch",
  "font-style",
  "font-synthesis",
  "font-variant",
  "font-variation-settings",
  "font-weight",
  "letter-spacing",
  "text-transform",
  "word-spacing",
] as const;

export function hasUnresolvedStyleReference(value: string): boolean {
  return unresolvedStyleReference.test(value);
}

export function isContentIndependentWidth(value: string): boolean {
  return value !== "" && !hasUnresolvedStyleReference(value) && contentIndependentWidth.test(value);
}

function hasResolvedInlineStyleValue(value: string | undefined): boolean {
  return value !== undefined && value !== "" && !hasUnresolvedStyleReference(value);
}

export function hasInlineFontMetrics(style: CSSStyleDeclaration): boolean {
  return (
    hasResolvedInlineStyleValue(style.fontFamily) && pxLength.test((style.fontSize ?? "").trim())
  );
}

export function hasInlineLineMetrics(style: CSSStyleDeclaration): boolean {
  const value = style.lineHeight?.trim();

  return hasResolvedInlineStyleValue(value) && lineHeight.test(value);
}

export function hasUnresolvedInlineTextWidthStyle(style: CSSStyleDeclaration): boolean {
  return inlineTextWidthProperties.some((property) =>
    hasUnresolvedStyleReference(style.getPropertyValue(property)),
  );
}

function pixelLength(value: string | undefined): number | undefined {
  const match = /^([0-9]+(?:\.[0-9]+)?)px$/.exec(value ?? "");

  return match ? Number(match[1]) : undefined;
}

export function estimateLineCapacity(
  element: HTMLElement,
  maxHeight: ClampLength | undefined,
  lineLimit: number | undefined,
): number | undefined {
  if (lineLimit !== undefined) {
    return lineLimit;
  }

  const maxHeightPx = pixelLength(cssLength(maxHeight));
  if (maxHeightPx === undefined) {
    return undefined;
  }

  const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
    return undefined;
  }

  return Math.max(1, Math.floor(maxHeightPx / lineHeight));
}

export function simpleLineFitFromStyle(style: CSSStyleDeclaration): SimpleLineFit | undefined {
  const lineHeight = Number.parseFloat(style.lineHeight);
  const fontSize = Number.parseFloat(style.fontSize);
  if (!Number.isFinite(lineHeight) || !Number.isFinite(fontSize) || lineHeight <= 0) {
    return undefined;
  }

  return {
    lineHeight,
  };
}

export function visibleRootTop(element: HTMLElement, clientTop = element.clientTop): number {
  return element.getBoundingClientRect().top + clientTop;
}

function subpixelSizeKey(value: number): number {
  // Preserve fractional layout changes without formatting float strings.
  return Math.round(value * 1000);
}

function borderBoxSignature(width: number, height: number): string {
  return `${subpixelSizeKey(width)}x${subpixelSizeKey(height)}`;
}

export const emptyBorderBoxSignature = "0x0";

export function hasBorderBoxSize(signature: string): boolean {
  return signature !== emptyBorderBoxSignature;
}

export function borderBoxWidth(element: HTMLElement): number {
  return element.getBoundingClientRect().width;
}

export type BorderBoxSizeSnapshot = {
  readonly signature: string;
  readonly width: number;
};

export function borderBoxSizeSnapshot(element: HTMLElement | null): BorderBoxSizeSnapshot {
  if (!element) {
    return {
      signature: emptyBorderBoxSignature,
      width: 0,
    };
  }

  const { height, width } = element.getBoundingClientRect();

  return {
    signature: borderBoxSignature(width, height),
    width,
  };
}

export function borderBoxSizeSignature(element: HTMLElement | null): string {
  if (!element) {
    return emptyBorderBoxSignature;
  }

  const { height, width } = element.getBoundingClientRect();
  return borderBoxSignature(width, height);
}

function borderBoxEntrySize(entry: ResizeObserverEntry): ResizeObserverSize | undefined {
  const borderBox = entry.borderBoxSize as
    | ResizeObserverSize
    | readonly ResizeObserverSize[]
    | undefined;

  if (!borderBox) {
    return undefined;
  }

  return "inlineSize" in borderBox ? borderBox : borderBox[0];
}

const visualBorderBoxFallbackElements = new WeakSet<Element>();

function needsVisualBorderBoxFallback(element: Element): boolean {
  if (visualBorderBoxFallbackElements.has(element)) {
    return true;
  }

  const { writingMode } = getComputedStyle(element);
  let needed = writingMode.startsWith("vertical") || writingMode.startsWith("sideways");
  let current: Element | null = element;

  while (!needed && current) {
    const { perspective, transform } = getComputedStyle(current);
    needed = transform !== "none" || perspective !== "none";
    current = current.parentElement;
  }

  if (needed) {
    visualBorderBoxFallbackElements.add(element);
  }

  return needed;
}

function entrySizeSnapshot(entry: ResizeObserverEntry): BorderBoxSizeSnapshot | null {
  const borderBox = borderBoxEntrySize(entry);

  if (!borderBox) {
    return null;
  }

  return {
    signature: borderBoxSignature(borderBox.inlineSize, borderBox.blockSize),
    width: borderBox.inlineSize,
  };
}

// ResizeObserver entry sizes are cheap and exact for ordinary horizontal layout.
// Visual snapshots are needed only when transforms or logical axes make entry
// inline/block sizes incomparable with getBoundingClientRect() signatures.
export function observedBorderBoxSizeSnapshot(
  entry: ResizeObserverEntry,
  previousSignature: string,
): BorderBoxSizeSnapshot | null {
  const snapshot = entrySizeSnapshot(entry);
  if (!snapshot || snapshot.signature === previousSignature) {
    return snapshot;
  }

  return entry.target instanceof HTMLElement && needsVisualBorderBoxFallback(entry.target)
    ? borderBoxSizeSnapshot(entry.target)
    : snapshot;
}

function entrySizeSignature(entry: ResizeObserverEntry): string | null {
  const borderBox = borderBoxEntrySize(entry);

  return borderBox ? borderBoxSignature(borderBox.inlineSize, borderBox.blockSize) : null;
}

export function hasBorderBoxEntrySignatureChange(
  entries: readonly ResizeObserverEntry[],
  previousSignatureFor: (element: Element) => string | null,
): boolean {
  for (const entry of entries) {
    const previousSignature = previousSignatureFor(entry.target);
    if (previousSignature === null) {
      continue;
    }

    const nextSignature = entrySizeSignature(entry);
    if (nextSignature === null) {
      return true;
    }

    if (previousSignature === nextSignature) {
      continue;
    }

    if (
      entry.target instanceof HTMLElement &&
      needsVisualBorderBoxFallback(entry.target) &&
      previousSignature === borderBoxSizeSignature(entry.target)
    ) {
      continue;
    }

    return true;
  }

  return false;
}

export function listenForFontLoads(onLoad: () => void): () => void {
  const fontFaceSet = document.fonts;
  if (!fontFaceSet) {
    return () => {};
  }

  let active = true;
  const notify = () => {
    if (active) {
      onLoad();
    }
  };

  void fontFaceSet.ready.then(() => notify());
  fontFaceSet.addEventListener("loadingdone", notify);

  return () => {
    active = false;
    fontFaceSet.removeEventListener("loadingdone", notify);
  };
}

type LineBox = {
  bottom: number;
  top: number;
};

export type VisibleBoundsCache = {
  bottom?: number;
  clientTop?: number;
  height?: number;
  top?: number;
};

export type SimpleLineFit = {
  lineHeight: number;
  lineStep?: number;
  maxLineBoxHeight?: number;
  minOverflowHeight?: number;
  overflowLineLimit?: number;
  verifyOverflow?: boolean;
};

export type ContentFitSample =
  | {
      readonly bounds: DOMRect;
      readonly rects?: undefined;
    }
  | {
      readonly bounds?: undefined;
      readonly rects: DOMRectList;
    };

export type ContentFitObserver = (sample: ContentFitSample) => void;

function sameLineBox(line: LineBox, rect: DOMRect): boolean {
  return Math.abs(line.top - rect.top) <= 0.5 && Math.abs(line.bottom - rect.bottom) <= 0.5;
}

export function countLineBoxes(rects: DOMRectList): number {
  const lines: LineBox[] = [];

  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index]!;
    if (rect.height > 0 && !lines.some((line) => sameLineBox(line, rect))) {
      lines.push({ bottom: rect.bottom, top: rect.top });
    }
  }

  return lines.length;
}

function cacheSimpleLineBoxHeight(
  simpleLineFit: SimpleLineFit | undefined,
  rects: DOMRectList,
): void {
  if (!simpleLineFit) {
    return;
  }

  let maxLineBoxHeight = 0;
  const lines: LineBox[] = [];
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index]!;
    if (rect.height <= 0) {
      continue;
    }

    maxLineBoxHeight = Math.max(maxLineBoxHeight, rect.height);
    if (!lines.some((line) => sameLineBox(line, rect))) {
      lines.push({
        bottom: rect.bottom,
        top: rect.top,
      });
    }
  }

  let maxLineStep = 0;
  for (let index = 1; index < lines.length; index += 1) {
    maxLineStep = Math.max(maxLineStep, lines[index]!.top - lines[index - 1]!.top);
  }

  const previousHeight = simpleLineFit.maxLineBoxHeight ?? 0;
  const previousStep = simpleLineFit.lineStep ?? simpleLineFit.lineHeight;
  const nextHeight = Math.max(previousHeight, maxLineBoxHeight);
  const nextStep = Math.max(previousStep, maxLineStep);

  if (nextHeight > previousHeight || nextStep > previousStep) {
    if (nextHeight > 0) {
      simpleLineFit.maxLineBoxHeight = nextHeight;
    }

    if (nextStep > simpleLineFit.lineHeight) {
      simpleLineFit.lineStep = nextStep;
    }

    delete simpleLineFit.minOverflowHeight;
    delete simpleLineFit.overflowLineLimit;
  }
}

function cachedOverflowRejects(
  simpleLineFit: SimpleLineFit,
  lineLimit: number,
  height: number,
): boolean {
  return (
    simpleLineFit.overflowLineLimit === lineLimit &&
    simpleLineFit.minOverflowHeight !== undefined &&
    height >= simpleLineFit.minOverflowHeight
  );
}

function cacheSimpleOverflowHeight(
  simpleLineFit: SimpleLineFit | undefined,
  lineLimit: number,
  height: number | undefined,
): void {
  if (!simpleLineFit?.verifyOverflow || height === undefined) {
    return;
  }

  if (simpleLineFit.overflowLineLimit !== lineLimit) {
    simpleLineFit.overflowLineLimit = lineLimit;
    simpleLineFit.minOverflowHeight = height;
    return;
  }

  simpleLineFit.minOverflowHeight =
    simpleLineFit.minOverflowHeight === undefined
      ? height
      : Math.min(simpleLineFit.minOverflowHeight, height);
}

// All DOM clamp implementations use this fit predicate so line counting and
// max-height clipping agree. It short-circuits as soon as a candidate is known
// not to fit because this runs inside search loops.
export function fitsContent(
  rootElement: HTMLElement,
  contentElement: HTMLElement,
  lineLimit: number | undefined,
  maxHeight: ClampLength | undefined,
  allowRectCountFit = false,
  visibleBoundsCache?: VisibleBoundsCache,
  simpleLineFit?: SimpleLineFit,
  onContentFit?: ContentFitObserver,
): boolean {
  if (lineLimit === undefined && maxHeight === undefined) {
    // No visual limit means every candidate fits; avoid layout reads entirely.
    return true;
  }

  if (lineLimit === undefined && maxHeight !== undefined) {
    const height = rootElement.clientHeight;
    const [visibleTop, visibleBottom] = visibleBoundsFor(rootElement, height, visibleBoundsCache);
    const rect = contentElement.getBoundingClientRect();
    onContentFit?.({ bounds: rect });

    return rect.top >= visibleTop - 0.5 && rect.bottom <= visibleBottom + 0.5;
  }

  let heightVerifyHeight: number | undefined;

  if (
    maxHeight === undefined &&
    lineLimit !== undefined &&
    simpleLineFit?.maxLineBoxHeight !== undefined &&
    simpleLineFit.lineHeight > 0
  ) {
    const rect = contentElement.getBoundingClientRect();
    onContentFit?.({ bounds: rect });
    const { height } = rect;
    heightVerifyHeight = height;
    const lineStep = simpleLineFit.lineStep ?? simpleLineFit.lineHeight;
    const fitLimit = simpleLineFit.maxLineBoxHeight + (lineLimit - 1) * lineStep + 0.5;
    if (height <= fitLimit) {
      return true;
    }

    if (simpleLineFit.verifyOverflow && cachedOverflowRejects(simpleLineFit, lineLimit, height)) {
      return false;
    }

    const clearOverflowLimit = simpleLineFit.maxLineBoxHeight + lineLimit * lineStep + 0.5;
    if (!simpleLineFit.verifyOverflow || height > clearOverflowLimit) {
      return false;
    }
  }

  const rects = contentElement.getClientRects();
  onContentFit?.({ rects });
  if (
    allowRectCountFit &&
    maxHeight === undefined &&
    lineLimit !== undefined &&
    rects.length <= lineLimit
  ) {
    cacheSimpleLineBoxHeight(simpleLineFit, rects);
    return true;
  }

  const lines: LineBox[] = [];
  let visibleTop = 0;
  let visibleBottom = 0;
  let measuredVisibleBounds = false;

  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index]!;
    if (rect.height <= 0) {
      continue;
    }

    if (maxHeight !== undefined) {
      if (!measuredVisibleBounds) {
        // Height bounds are only needed if a visible rect exists, which keeps
        // empty or display-none content from forcing extra root measurements.
        const height = rootElement.clientHeight;
        [visibleTop, visibleBottom] = visibleBoundsFor(rootElement, height, visibleBoundsCache);
        measuredVisibleBounds = true;
      }

      if (rect.top < visibleTop - 0.5 || rect.bottom > visibleBottom + 0.5) {
        return false;
      }
    }

    if (lineLimit !== undefined) {
      if (!lines.some((line) => sameLineBox(line, rect))) {
        // Browser rects are the source of truth for wrapped lines; grouping by
        // vertical bounds handles inline content that splits into many boxes.
        lines.push({
          bottom: rect.bottom,
          top: rect.top,
        });
        if (lines.length > lineLimit) {
          cacheSimpleLineBoxHeight(simpleLineFit, rects);
          cacheSimpleOverflowHeight(simpleLineFit, lineLimit, heightVerifyHeight);

          return false;
        }
      }
    }
  }

  if (lineLimit !== undefined) {
    cacheSimpleLineBoxHeight(simpleLineFit, rects);
  }

  return true;
}

function visibleBoundsFor(
  rootElement: HTMLElement,
  height: number,
  visibleBoundsCache?: VisibleBoundsCache,
): readonly [number, number] {
  if (
    visibleBoundsCache?.height === height &&
    visibleBoundsCache.top !== undefined &&
    visibleBoundsCache.bottom !== undefined
  ) {
    return [visibleBoundsCache.top, visibleBoundsCache.bottom];
  }

  const clientTop = visibleBoundsCache?.clientTop ?? rootElement.clientTop;
  const top = visibleRootTop(rootElement, clientTop);
  const bottom = top + height;
  if (visibleBoundsCache) {
    visibleBoundsCache.clientTop = clientTop;
    visibleBoundsCache.height = height;
    visibleBoundsCache.top = top;
    visibleBoundsCache.bottom = bottom;
  }

  return [top, bottom];
}
