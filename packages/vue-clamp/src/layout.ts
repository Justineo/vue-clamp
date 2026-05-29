import type { ClampLength } from "./types.ts";

export const borderBoxObserverOptions: ResizeObserverOptions = { box: "border-box" };

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

export function visibleRootTop(element: HTMLElement): number {
  return element.getBoundingClientRect().top + element.clientTop;
}

function subpixelSizeKey(value: number): number {
  // Preserve fractional layout changes without formatting float strings.
  return Math.round(value * 1000);
}

function borderBoxSignature(width: number, height: number): string {
  return `${subpixelSizeKey(width)}x${subpixelSizeKey(height)}`;
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
      signature: "0x0",
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
    return "0x0";
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

export function borderBoxEntrySizeSnapshot(
  entry: ResizeObserverEntry,
): BorderBoxSizeSnapshot | null {
  const borderBox = borderBoxEntrySize(entry);

  if (!borderBox) {
    return null;
  }

  return {
    signature: borderBoxSignature(borderBox.inlineSize, borderBox.blockSize),
    width: borderBox.inlineSize,
  };
}

export function borderBoxEntrySizeSignature(entry: ResizeObserverEntry): string | null {
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

    const nextSignature = borderBoxEntrySizeSignature(entry);
    if (nextSignature === null || previousSignature !== nextSignature) {
      return true;
    }
  }

  return false;
}

export function listenForFontLoads(onLoad: () => void): () => void {
  const fontFaceSet = document.fonts;
  if (!fontFaceSet) {
    return () => {};
  }

  void fontFaceSet.ready.then(onLoad);
  fontFaceSet.addEventListener("loadingdone", onLoad);

  return () => {
    fontFaceSet.removeEventListener("loadingdone", onLoad);
  };
}

type LineBox = {
  bottom: number;
  top: number;
};

function sameLineBox(line: LineBox, rect: DOMRect): boolean {
  return Math.abs(line.top - rect.top) <= 0.5 && Math.abs(line.bottom - rect.bottom) <= 0.5;
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
  cachedVisibleTop?: number,
): boolean {
  if (lineLimit === undefined && maxHeight === undefined) {
    // No visual limit means every candidate fits; avoid layout reads entirely.
    return true;
  }

  const rects = contentElement.getClientRects();
  if (
    allowRectCountFit &&
    maxHeight === undefined &&
    lineLimit !== undefined &&
    rects.length <= lineLimit
  ) {
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
        visibleTop = cachedVisibleTop ?? visibleRootTop(rootElement);
        visibleBottom = visibleTop + rootElement.clientHeight;
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
          return false;
        }
      }
    }
  }

  return true;
}
