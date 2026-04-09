export function normalizeLineLimit(maxLines: number | undefined): number | undefined {
  if (maxLines === undefined || !Number.isFinite(maxLines) || maxLines <= 0) {
    return undefined;
  }

  return Math.max(1, Math.floor(maxLines));
}

export function createQueuedTask(task: () => Promise<void>): () => void {
  let pending = false;
  let running = false;

  function run(): void {
    pending = true;
    if (running) {
      return;
    }

    running = true;
    void (async () => {
      try {
        while (pending) {
          pending = false;
          await task();
        }
      } finally {
        running = false;

        if (pending) {
          run();
        }
      }
    })();
  }

  return run;
}

export function sizeSignature(element: HTMLElement | null): string {
  return element ? `${element.offsetWidth}x${element.offsetHeight}` : "0x0";
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
