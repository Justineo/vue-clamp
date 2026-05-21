import type { ClampLimits, SequenceMeasurement, Size } from "./types.ts";

type StaticFlowEstimate = {
  fitCount: number;
  status: "fit" | "overflow" | "unknown";
};

type StaticFlowEstimateOptions = {
  afterWidth?: number;
  beforeWidth?: number;
  containerWidth: number;
  itemCount: number;
  itemWidth: (index: number) => number | null;
  lineLimit: number;
};

// DOMRect reads can differ by sub-pixel fractions across layout passes. Half a
// CSS pixel keeps those harmless differences from becoming clamp churn.
export const layoutTolerance = 0.5;

function isPositiveFiniteSize(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function simulateStaticFlow({
  afterWidth = 0,
  beforeWidth = 0,
  containerWidth,
  itemCount,
  itemWidth,
  lineLimit,
}: StaticFlowEstimateOptions): StaticFlowEstimate {
  let currentLineWidth = Math.max(0, beforeWidth);
  let lineCount = 1;
  let fitCount = 0;

  for (let index = 0; index < itemCount; index += 1) {
    const width = itemWidth(index);
    if (!isPositiveFiniteSize(width)) {
      return {
        fitCount,
        status: "unknown",
      };
    }

    if (currentLineWidth > 0 && currentLineWidth + width > containerWidth + layoutTolerance) {
      lineCount += 1;
      currentLineWidth = 0;

      if (lineCount > lineLimit) {
        return {
          fitCount,
          status: "overflow",
        };
      }
    }

    currentLineWidth += width;
    fitCount = index + 1;
  }

  if (afterWidth > 0) {
    if (currentLineWidth > 0 && currentLineWidth + afterWidth > containerWidth + layoutTolerance) {
      lineCount += 1;
      currentLineWidth = 0;

      if (lineCount > lineLimit) {
        return {
          fitCount,
          status: "overflow",
        };
      }
    }

    if (currentLineWidth + afterWidth > containerWidth + layoutTolerance) {
      return {
        fitCount,
        status: "overflow",
      };
    }
  }

  return {
    fitCount,
    status: "fit",
  };
}

export function measureElementSize(element: HTMLElement | null): Size | null {
  if (!element) {
    return null;
  }

  const { height, width } = element.getBoundingClientRect();
  if (!isPositiveFiniteSize(width) || !isPositiveFiniteSize(height)) {
    return null;
  }

  return {
    height,
    width,
  };
}

export function isSameSize(current: Size | null, next: Size | null): boolean {
  if (current === null || next === null) {
    return current === next;
  }

  return (
    Math.abs(current.width - next.width) <= layoutTolerance &&
    Math.abs(current.height - next.height) <= layoutTolerance
  );
}

function isSameMeasuredLine(rect: DOMRectReadOnly, lineTop: number, lineBottom: number): boolean {
  const verticalOverlap = Math.min(rect.bottom, lineBottom) - Math.max(rect.top, lineTop);
  const smallerHeight = Math.min(rect.height, lineBottom - lineTop);
  return verticalOverlap > Math.min(layoutTolerance, smallerHeight / 2);
}

export function measureSequence(
  rootElement: HTMLElement,
  contentElement: HTMLElement | null,
  limits: ClampLimits,
  options: { recordItemWidth?: (index: number, width: number) => void } = {},
): SequenceMeasurement {
  const { clipToRootHeight, lineLimit } = limits;

  if (!contentElement) {
    // Missing content is a lifecycle state, not evidence that items are hidden.
    return {
      allFit: true,
      visibleItems: 0,
    };
  }

  let visibleTop = 0;
  let visibleBottom = 0;

  if (clipToRootHeight) {
    // maxHeight clipping depends on the root's visible box, while line counting
    // depends on each child box below.
    const rootRect = rootElement.getBoundingClientRect();
    visibleTop = rootRect.top + rootElement.clientTop;
    visibleBottom = visibleTop + rootElement.clientHeight;
  }

  let lineCount = 0;
  let lineTop = 0;
  let lineBottom = 0;
  let visibleItems = 0;

  for (const child of contentElement.children) {
    if (!(child instanceof HTMLElement)) {
      continue;
    }

    const part = child.dataset.part;
    if (part !== "before" && part !== "item" && part !== "after") {
      // Only component-owned atomic boxes should affect the clamp decision.
      continue;
    }

    const rect = child.getBoundingClientRect();
    if (!isPositiveFiniteSize(rect.width) || !isPositiveFiniteSize(rect.height)) {
      continue;
    }

    if (lineCount === 0) {
      lineCount = 1;
      lineTop = rect.top;
      lineBottom = rect.bottom;
    } else {
      // Mixed-height flex items can have different top coordinates under
      // center, end, or baseline alignment. Same-line boxes still overlap in
      // the vertical axis in the supported horizontal flex-flow model.
      if (!isSameMeasuredLine(rect, lineTop, lineBottom)) {
        lineCount += 1;
        lineTop = rect.top;
        lineBottom = rect.bottom;
      } else {
        lineTop = Math.min(lineTop, rect.top);
        lineBottom = Math.max(lineBottom, rect.bottom);
      }
    }

    if (lineLimit !== undefined && lineCount > lineLimit) {
      // Early return keeps measurement proportional to the first overflow, not
      // the full item count.
      return {
        allFit: false,
        visibleItems,
      };
    }

    if (
      clipToRootHeight &&
      (rect.top < visibleTop - layoutTolerance || rect.bottom > visibleBottom + layoutTolerance)
    ) {
      // maxHeight can reject a sequence even when the line count is acceptable.
      return {
        allFit: false,
        visibleItems,
      };
    }

    if (part === "item") {
      options.recordItemWidth?.(visibleItems, rect.width);
      visibleItems += 1;
    }
  }

  return {
    allFit: true,
    visibleItems,
  };
}

export function findItemElements(contentElement: HTMLElement | null): HTMLElement[] {
  if (!contentElement) {
    return [];
  }

  const elements: HTMLElement[] = [];
  for (const child of contentElement.children) {
    if (child instanceof HTMLElement && child.dataset.part === "item") {
      elements.push(child);
    }
  }

  return elements;
}

export function showItemCandidate(
  itemElements: readonly HTMLElement[],
  currentCount: number,
  nextCount: number,
): number {
  const start = Math.min(currentCount, nextCount);
  const end = Math.max(currentCount, nextCount);

  for (let index = start; index < end; index += 1) {
    const element = itemElements[index];
    if (element) {
      element.style.display = index < nextCount ? "inline-flex" : "none";
    }
  }

  return nextCount;
}

export function measureVisibleAtomicHeight(contentElement: HTMLElement | null): number | null {
  if (!contentElement) {
    return null;
  }

  let height = 0;
  for (const child of contentElement.children) {
    if (!(child instanceof HTMLElement)) {
      continue;
    }

    const part = child.dataset.part;
    if (part !== "before" && part !== "item") {
      continue;
    }

    const rect = child.getBoundingClientRect();
    if (!isPositiveFiniteSize(rect.width) || !isPositiveFiniteSize(rect.height)) {
      continue;
    }

    height = Math.max(height, rect.height);
    if (part === "item") {
      break;
    }
  }

  return height > 0 ? height : null;
}

export function averageItemWidth(itemWidths: readonly number[]): number | null {
  let widthSum = 0;
  let widthCount = 0;

  for (const itemWidth of itemWidths) {
    if (isPositiveFiniteSize(itemWidth)) {
      widthSum += itemWidth;
      widthCount += 1;
    }
  }

  return widthCount > 0 ? widthSum / widthCount : null;
}

export function itemWidthAt(
  itemWidths: readonly number[],
  index: number,
  fallbackWidth: number,
): number {
  const measuredWidth = itemWidths[index];
  return isPositiveFiniteSize(measuredWidth) ? measuredWidth : fallbackWidth;
}
