import type { ClampLength } from "./types.ts";

export const borderBoxObserverOptions: ResizeObserverOptions = { box: "border-box" };

type BorderBoxResizeListener = (entries: readonly ResizeObserverEntry[]) => void;

export function observeBorderBoxSizes(
  elements: readonly Element[],
  listener: BorderBoxResizeListener,
): () => void {
  // Paths without cooperative work can keep independent delivery and avoid
  // shared-observer dispatch bookkeeping.
  const observer = new ResizeObserver(listener);
  for (const element of elements) {
    observer.observe(element, borderBoxObserverOptions);
  }

  return () => {
    observer.disconnect();
  };
}

let measuredObserver: ResizeObserver | undefined;
let measuredClamps = 0;
let observedClamps = 0;

export function hasMeasuredPeers(): boolean {
  return measuredClamps > 1;
}
const measuredListeners = new Map<Element, Set<BorderBoxResizeListener>>();

// Measured searches yield between writes and reads. Delivering their resize
// requests in one callback lets them share that work before the next paint.
// Vue-driven participants can share delivery without advertising candidate work.
export function observeMeasuredBorderBoxSizes(
  elements: readonly Element[],
  listener: BorderBoxResizeListener,
  batchCandidates = true,
): () => void {
  observedClamps += 1;
  if (batchCandidates) measuredClamps += 1;
  measuredObserver ??= new ResizeObserver((entries) => {
    if (observedClamps === 1) {
      measuredListeners.values().next().value?.values().next().value?.(entries);
      return;
    }
    const deliveries = new Map<BorderBoxResizeListener, ResizeObserverEntry[]>();
    for (const entry of entries) {
      for (const callback of measuredListeners.get(entry.target) ?? []) {
        const delivery = deliveries.get(callback);
        if (delivery) delivery.push(entry);
        else deliveries.set(callback, [entry]);
      }
    }
    for (const [callback, delivery] of deliveries) callback(delivery);
  });
  for (const element of new Set(elements)) {
    let listeners = measuredListeners.get(element);
    if (!listeners) {
      listeners = new Set();
      measuredListeners.set(element, listeners);
      measuredObserver.observe(element, borderBoxObserverOptions);
    }
    listeners.add(listener);
  }
  return () => {
    observedClamps -= 1;
    if (batchCandidates) measuredClamps -= 1;
    for (const element of elements) {
      const listeners = measuredListeners.get(element);
      if (!listeners) continue;
      listeners.delete(listener);
      if (listeners.size === 0) {
        measuredObserver?.unobserve(element);
        measuredListeners.delete(element);
      }
    }
    if (measuredListeners.size === 0) {
      measuredObserver?.disconnect();
      measuredObserver = undefined;
    }
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
// Tracks computed typography and line breaking, not complete stylesheet identity.
export function textLayoutMetricKey(style: CSSStyleDeclaration): string {
  const font = style.font ?? "";
  // A serializable font shorthand represents the six base longhands exactly.
  // Empty/unsupported serialization and opaque system-font keywords fall back.
  const base = font.includes(" ")
    ? `font\n${font}`
    : `longhands\n${font}\n${style.fontFamily ?? ""}\n${style.fontSize ?? ""}\n${style.fontStretch ?? ""}\n${style.fontStyle ?? ""}\n${style.fontWeight ?? ""}\n${style.lineHeight ?? ""}`;
  return `${base}\n${style.fontFeatureSettings ?? ""}\n${style.fontKerning ?? ""}\n${style.fontOpticalSizing ?? ""}\n${style.fontSizeAdjust ?? ""}\n${style.fontSynthesis ?? ""}\n${style.fontVariant ?? ""}\n${style.fontVariationSettings ?? ""}\n${style.letterSpacing ?? ""}\n${style.textTransform ?? ""}\n${style.wordSpacing ?? ""}\n${style.fontLanguageOverride ?? ""}\n${style.textIndent ?? ""}\n${style.tabSize ?? ""}\n${style.whiteSpace ?? ""}\n${style.lineBreak ?? ""}\n${style.textWrapStyle ?? ""}\n${style.textAutospace ?? ""}\n${style.wordBreak ?? ""}\n${style.overflowWrap ?? ""}\n${style.hyphens ?? ""}\n${style.direction ?? ""}\n${style.unicodeBidi ?? ""}\n${style.writingMode ?? ""}\n${style.textOrientation ?? ""}\n${style.verticalAlign ?? ""}`;
}

export function hasUnresolvedStyleReference(value: string): boolean {
  return unresolvedStyleReference.test(value);
}

export function isContentIndependentWidth(value: string): boolean {
  return value !== "" && !hasUnresolvedStyleReference(value) && contentIndependentWidth.test(value);
}

function pixelLength(value: string | undefined): number | undefined {
  const match = /^([0-9]+(?:\.[0-9]+)?)px$/.exec(value ?? "");

  return match ? Number(match[1]) : undefined;
}

export function estimateLineCapacity(
  element: HTMLElement,
  maxHeight: ClampLength | undefined,
  lineLimit: number | undefined,
  measuredLineHeight?: string,
): number | undefined {
  if (lineLimit !== undefined) {
    return lineLimit;
  }

  const maxHeightPx = pixelLength(cssLength(maxHeight));
  if (maxHeightPx === undefined) {
    return undefined;
  }

  const lineHeight = Number.parseFloat(measuredLineHeight ?? getComputedStyle(element).lineHeight);
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

  const style = getComputedStyle(element);
  const { writingMode } = style;
  let needed = writingMode.startsWith("vertical") || writingMode.startsWith("sideways");
  let current: Element | null = element;

  while (!needed && current) {
    const { perspective, transform } = current === element ? style : getComputedStyle(current);
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
  useVisualFallback = true,
): BorderBoxSizeSnapshot | null {
  const snapshot = entrySizeSnapshot(entry);
  if (!snapshot || snapshot.signature === previousSignature) {
    return snapshot;
  }

  return useVisualFallback &&
    entry.target instanceof HTMLElement &&
    needsVisualBorderBoxFallback(entry.target)
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

type FontReadiness = {
  promise: Promise<FontFaceSet>;
  callbacks: Set<() => void> | null;
};
type FontLoadGroup = {
  callbacks: Set<() => void>;
  notify: () => void;
  readiness?: FontReadiness;
};
const fontLoadGroups = new WeakMap<FontFaceSet, FontLoadGroup>();

function notifyFontListeners(callbacks: Iterable<() => void>): void {
  for (const callback of callbacks) {
    try {
      callback();
    } catch (error) {
      reportError(error);
    }
  }
}

export function listenForFontLoads(onLoad: () => void, notifySettledReady = false): () => void {
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

  let group = fontLoadGroups.get(fontFaceSet);
  if (!group) {
    const callbacks = new Set<() => void>();
    group = {
      callbacks,
      notify: () => {
        // New subscriptions wait for a later event or pending readiness, not
        // the event being delivered. Removed subscribers guard their activity.
        notifyFontListeners([...callbacks]);
      },
    };
    fontLoadGroups.set(fontFaceSet, group);
    fontFaceSet.addEventListener("loadingdone", group.notify);
  }
  group.callbacks.add(notify);

  const promise = fontFaceSet.ready;
  let readyCallbacks: Set<() => void> | null = null;
  if (notifySettledReady) {
    // Predictors can retain shared font metrics while no instance is active.
    // Reactivation must invalidate those metrics even for a fulfilled promise.
    void promise.then(notify);
  } else {
    if (group.readiness?.promise !== promise) {
      const readiness: FontReadiness = { promise, callbacks: new Set() };
      group.readiness = readiness;
      let wasPending = false;
      void promise.then(() => {
        const callbacks = readiness.callbacks;
        readiness.callbacks = null;
        if (wasPending && callbacks) notifyFontListeners(callbacks);
        callbacks?.clear();
      });
      // A fulfilled promise reacts before this sentinel. Only a pending ready
      // promise reports new font/layout work; an old fulfilled one would repeat
      // the initial clamp. Share this distinction across the subscription group.
      queueMicrotask(() => {
        wasPending = true;
      });
    }
    readyCallbacks = group.readiness.callbacks;
    readyCallbacks?.add(notify);
  }

  return () => {
    if (!active) return;
    active = false;
    readyCallbacks?.delete(notify);
    group.callbacks.delete(notify);
    if (group.callbacks.size === 0) {
      fontFaceSet.removeEventListener("loadingdone", group.notify);
      fontLoadGroups.delete(fontFaceSet);
    }
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
  top?: number | undefined;
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

function collectLineBoxes(rects: DOMRectList): { lines: LineBox[]; maxHeight: number } {
  const lines: LineBox[] = [];
  let maxHeight = 0;
  let maxTop = -Infinity;
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index]!;
    if (rect.height <= 0) continue;
    maxHeight = Math.max(maxHeight, rect.height);
    const previous = lines[lines.length - 1];
    if (previous && sameLineBox(previous, rect)) continue;
    // Ordinary inline fragments arrive in line order. A box below every stored
    // representative cannot match one; unusual ordering keeps the exact scan.
    if (rect.top <= maxTop + 0.5 && lines.some((line) => sameLineBox(line, rect))) continue;
    lines.push({ bottom: rect.bottom, top: rect.top });
    maxTop = Math.max(maxTop, rect.top);
  }
  return { lines, maxHeight };
}

export function countLineBoxes(rects: DOMRectList): number {
  return collectLineBoxes(rects).lines.length;
}

function cacheSimpleLineBoxHeight(
  simpleLineFit: SimpleLineFit | undefined,
  rects: DOMRectList,
): void {
  if (!simpleLineFit) return;
  const { lines, maxHeight: maxLineBoxHeight } = collectLineBoxes(rects);

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
  let maxTop = -Infinity;
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
      const previous = lines[lines.length - 1];
      // Ordered fragments repeat the latest representative or start below all
      // of them. Unordered and overlapping fragments retain the original scan.
      if (
        !(previous && sameLineBox(previous, rect)) &&
        (rect.top > maxTop + 0.5 || !lines.some((line) => sameLineBox(line, rect)))
      ) {
        // Browser rects are the source of truth for wrapped lines; grouping by
        // vertical bounds handles inline content that splits into many boxes.
        lines.push({
          bottom: rect.bottom,
          top: rect.top,
        });
        maxTop = Math.max(maxTop, rect.top);
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
