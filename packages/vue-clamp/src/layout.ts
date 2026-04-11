export function normalizeLineLimit(maxLines: number | undefined): number | undefined {
  if (maxLines === undefined || !Number.isFinite(maxLines) || maxLines <= 0) {
    return undefined;
  }

  return Math.max(1, Math.floor(maxLines));
}

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

export function sizeSignature(element: HTMLElement | null): string {
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

export function fitsContent(
  rootElement: HTMLElement,
  contentElement: HTMLElement,
  lineLimit: number | undefined,
  maxHeight: number | string | undefined,
): boolean {
  const rects = Array.from(contentElement.getClientRects()).filter((rect) => rect.height > 0);

  if (maxHeight !== undefined && rects.length > 0) {
    const currentRootRect = rootElement.getBoundingClientRect();
    const visibleTop = currentRootRect.top + rootElement.clientTop;
    const visibleBottom = visibleTop + rootElement.clientHeight;

    if (rects.some((rect) => rect.top < visibleTop - 0.5 || rect.bottom > visibleBottom + 0.5)) {
      return false;
    }
  }

  if (lineLimit !== undefined) {
    const lines = new Set<string>();

    for (const rect of rects) {
      lines.add(`${rect.top}/${rect.bottom}`);
    }

    if (lines.size > lineLimit) {
      return false;
    }
  }

  return true;
}
