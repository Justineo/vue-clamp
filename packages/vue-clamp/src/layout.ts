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

export function cssLength(value: number | string | undefined): string | number | undefined {
  return typeof value === "number" ? `${value}px` : value;
}

// Layout signatures are intentionally coarse. They are used only to avoid
// redundant reclamps, while the actual clamp result still comes from DOM reads.
function sizeSignature(element: HTMLElement | null): string {
  return element ? `${element.offsetWidth}x${element.offsetHeight}` : "0x0";
}

export function combinedSizeSignature(...elements: (HTMLElement | null)[]): string {
  return elements.map(sizeSignature).join("|");
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
  maxHeight: number | string | undefined,
): boolean {
  if (lineLimit === undefined && maxHeight === undefined) {
    // No visual limit means every candidate fits; avoid layout reads entirely.
    return true;
  }

  const rects = contentElement.getClientRects();
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
        const currentRootRect = rootElement.getBoundingClientRect();
        visibleTop = currentRootRect.top + rootElement.clientTop;
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
