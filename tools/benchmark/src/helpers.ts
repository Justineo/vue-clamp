import { nextTick } from "vue";

export type BenchmarkMetrics = {
  addedNodes: number;
  attributeMutationRecords: number;
  boundingRectReads: number;
  characterDataMutationRecords: number;
  childListMutationRecords: number;
  clientHeightReads: number;
  clientRectEntries: number;
  clientRectReads: number;
  clientTopReads: number;
  clientWidthReads: number;
  hiddenAddedNodes: number;
  hiddenChildListMutationRecords: number;
  hiddenMutationRecords: number;
  hiddenRemovedNodes: number;
  cloneNodeCalls: number;
  imageCloneCalls: number;
  mutationCallbacks: number;
  mutationRecords: number;
  offsetHeightReads: number;
  offsetWidthReads: number;
  replaceChildrenCalls: number;
  resizeObserverCallbacks: number;
  removedNodes: number;
  scrollWidthReads: number;
  styleReads: number;
};

export type StepDiagnostics = {
  activeMs: number;
  droppedFrames: number;
  frameCount: number;
  frameIntervalMedianMs: number;
  frameIntervalP95Ms: number;
  framesToActive: number;
  framesToSettle: number;
  idleBudgetMs: number;
  idleCallbackCount: number;
  longAnimationFrameCount: number;
  longAnimationFrameMs: number;
  longTaskCount: number;
  longTaskMs: number;
  quietMs: number;
  settleWaitMs: number;
  settledMs: number;
  updateMs: number;
};

export type BenchmarkRun = BenchmarkMetrics & {
  steps: number;
} & Record<string, number>;

export type BenchmarkSummary = {
  sampleCount: number;
  runs: BenchmarkRun[];
  steps: number;
} & Record<string, number | BenchmarkRun[]>;

type GetterMetric =
  | "clientHeightReads"
  | "clientTopReads"
  | "clientWidthReads"
  | "offsetHeightReads"
  | "offsetWidthReads"
  | "scrollWidthReads";

type GetterPatch = {
  descriptor: PropertyDescriptor;
  owner: object;
  property: string;
};

type BenchmarkSpyOptions = {
  counters?: boolean;
};

type ActivityRecord = {
  mark: (time?: number) => void;
  root: HTMLElement;
};

export type ActivityTracker = {
  disconnect: () => void;
  mark: (time?: number) => void;
  waitForStable: (options?: StableWaitOptions) => Promise<StableWaitResult>;
};

export type PerformanceTracker = {
  disconnect: () => void;
  measure: (start: number, end: number) => PerformanceWindowMetrics;
};

type StableWaitOptions = {
  maxFrames?: number;
  since?: number;
  stableFrames?: number;
};

type StableWaitResult = {
  activeMs: number;
  framesToActive: number;
  framesToSettle: number;
};

type PerformanceWindowMetrics = {
  droppedFrames: number;
  frameCount: number;
  frameIntervalMedianMs: number;
  frameIntervalP95Ms: number;
  idleBudgetMs: number;
  idleCallbackCount: number;
  longAnimationFrameCount: number;
  longAnimationFrameMs: number;
  longTaskCount: number;
  longTaskMs: number;
};

type IdleRecord = {
  budget: number;
  time: number;
};

const trackedRoots: HTMLElement[] = [];
const activityRecords: ActivityRecord[] = [];
let trackedMetrics: BenchmarkMetrics | null = null;
let installed = false;
let countersInstalled = false;
let originalGetBoundingClientRectDescriptor: PropertyDescriptor | undefined;
let originalGetClientRectsDescriptor: PropertyDescriptor | undefined;
let originalReplaceChildrenDescriptor: PropertyDescriptor | undefined;
let originalCloneNodeDescriptor: PropertyDescriptor | undefined;
let originalGetComputedStyle: typeof getComputedStyle | undefined;
let originalResizeObserver: typeof ResizeObserver | undefined;
let getterPatches: GetterPatch[] = [];

function emptyMetrics(): BenchmarkMetrics {
  return {
    addedNodes: 0,
    attributeMutationRecords: 0,
    boundingRectReads: 0,
    characterDataMutationRecords: 0,
    childListMutationRecords: 0,
    clientHeightReads: 0,
    clientRectEntries: 0,
    clientRectReads: 0,
    clientTopReads: 0,
    clientWidthReads: 0,
    hiddenAddedNodes: 0,
    hiddenChildListMutationRecords: 0,
    hiddenMutationRecords: 0,
    hiddenRemovedNodes: 0,
    cloneNodeCalls: 0,
    imageCloneCalls: 0,
    mutationCallbacks: 0,
    mutationRecords: 0,
    offsetHeightReads: 0,
    offsetWidthReads: 0,
    replaceChildrenCalls: 0,
    resizeObserverCallbacks: 0,
    removedNodes: 0,
    scrollWidthReads: 0,
    styleReads: 0,
  };
}

function descriptorInPrototypeChain(start: object, property: string): GetterPatch | null {
  let current: object | null = start;

  while (current) {
    const descriptor = Object.getOwnPropertyDescriptor(current, property);
    if (descriptor) {
      return {
        descriptor,
        owner: current,
        property,
      };
    }

    current = Object.getPrototypeOf(current) as object | null;
  }

  return null;
}

function isTrackedElement(element: Element): boolean {
  return trackedRoots.some((root) => element === root || root.contains(element));
}

function isHiddenMutationTarget(target: Node): boolean {
  const element = target instanceof Element ? target : target.parentElement;

  return element?.closest('[aria-hidden="true"]') !== null;
}

function countTrackedElement(element: unknown, metric: keyof BenchmarkMetrics): void {
  if (trackedMetrics && element instanceof Element && isTrackedElement(element)) {
    trackedMetrics[metric] += 1;
  }
}

function markActivityForElement(element: Element): void {
  for (const record of activityRecords) {
    if (element === record.root || record.root.contains(element)) {
      record.mark();
    }
  }
}

function patchElementMethod(
  property: "getBoundingClientRect" | "getClientRects",
  metric: "boundingRectReads" | "clientRectReads",
): void {
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, property);
  const original = descriptor?.value as ((this: Element) => unknown) | undefined;

  if (!descriptor || !original) {
    throw new Error(`Missing Element.prototype.${property} for benchmark metrics.`);
  }

  if (property === "getBoundingClientRect") {
    originalGetBoundingClientRectDescriptor = descriptor;
  } else {
    originalGetClientRectsDescriptor = descriptor;
  }

  Object.defineProperty(Element.prototype, property, {
    ...descriptor,
    value(this: Element): unknown {
      const result = original.call(this);

      if (trackedMetrics && isTrackedElement(this)) {
        trackedMetrics[metric] += 1;

        if (property === "getClientRects") {
          trackedMetrics.clientRectEntries += (result as DOMRectList).length;
        }
      }

      return result;
    },
  });
}

function patchGetter(property: string, metric: GetterMetric): void {
  const patch = descriptorInPrototypeChain(HTMLElement.prototype, property);
  const originalGetter = Reflect.get(patch?.descriptor ?? {}, "get") as
    | ((this: HTMLElement) => unknown)
    | undefined;

  if (!patch || !originalGetter) {
    return;
  }

  getterPatches.push(patch);
  Object.defineProperty(patch.owner, property, {
    ...patch.descriptor,
    get(this: HTMLElement): unknown {
      countTrackedElement(this, metric);
      return Reflect.apply(originalGetter, this, []);
    },
  });
}

function patchGetComputedStyle(): void {
  const original = globalThis.getComputedStyle;
  originalGetComputedStyle = original;

  globalThis.getComputedStyle = ((element: Element, pseudoElt?: string | null) => {
    countTrackedElement(element, "styleReads");
    return original.call(globalThis, element, pseudoElt);
  }) as typeof getComputedStyle;
}

function patchReplaceChildren(): void {
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "replaceChildren");
  const original = descriptor?.value as
    | ((this: Element, ...nodes: (Node | string)[]) => void)
    | undefined;

  if (!descriptor || !original) {
    throw new Error("Missing Element.prototype.replaceChildren for benchmark metrics.");
  }

  originalReplaceChildrenDescriptor = descriptor;
  Object.defineProperty(Element.prototype, "replaceChildren", {
    ...descriptor,
    value(this: Element, ...nodes: (Node | string)[]): void {
      countTrackedElement(this, "replaceChildrenCalls");
      original.apply(this, nodes);
    },
  });
}

function patchCloneNode(): void {
  const descriptor = Object.getOwnPropertyDescriptor(Node.prototype, "cloneNode");
  const original = descriptor?.value as ((this: Node, deep?: boolean) => Node) | undefined;

  if (!descriptor || !original) {
    throw new Error("Missing Node.prototype.cloneNode for benchmark metrics.");
  }

  originalCloneNodeDescriptor = descriptor;
  Object.defineProperty(Node.prototype, "cloneNode", {
    ...descriptor,
    value(this: Node, deep?: boolean): Node {
      if (trackedMetrics && this instanceof Element && isTrackedElement(this)) {
        trackedMetrics.cloneNodeCalls += 1;

        if (this instanceof HTMLImageElement) {
          trackedMetrics.imageCloneCalls += 1;
        }
      }

      return original.call(this, deep);
    },
  });
}

function patchResizeObserver(): void {
  originalResizeObserver = globalThis.ResizeObserver;

  if (!originalResizeObserver) {
    throw new Error("Missing ResizeObserver for benchmark metrics.");
  }

  const OriginalResizeObserver = originalResizeObserver;

  globalThis.ResizeObserver = class BenchmarkResizeObserver {
    private readonly observer: ResizeObserver;

    constructor(callback: ResizeObserverCallback) {
      const publicObserver = this as unknown as ResizeObserver;
      this.observer = new OriginalResizeObserver((entries) => {
        const trackedCallback = entries.some((entry) => isTrackedElement(entry.target));

        if (trackedMetrics && trackedCallback) {
          trackedMetrics.resizeObserverCallbacks += 1;
        }

        for (const entry of entries) {
          markActivityForElement(entry.target);
        }

        callback.call(publicObserver, entries, publicObserver);
      });
    }

    disconnect(): void {
      this.observer.disconnect();
    }

    observe(target: Element, options?: ResizeObserverOptions): void {
      this.observer.observe(target, options);
    }

    unobserve(target: Element): void {
      this.observer.unobserve(target);
    }
  } as unknown as typeof ResizeObserver;
}

export function installBenchmarkSpies(options: BenchmarkSpyOptions = {}): void {
  if (installed) {
    return;
  }

  installed = true;
  countersInstalled = options.counters ?? true;

  if (countersInstalled) {
    patchElementMethod("getBoundingClientRect", "boundingRectReads");
    patchElementMethod("getClientRects", "clientRectReads");
    patchGetter("clientHeight", "clientHeightReads");
    patchGetter("clientTop", "clientTopReads");
    patchGetter("clientWidth", "clientWidthReads");
    patchGetter("offsetHeight", "offsetHeightReads");
    patchGetter("offsetWidth", "offsetWidthReads");
    patchGetter("scrollWidth", "scrollWidthReads");
    patchGetComputedStyle();
    patchReplaceChildren();
    patchCloneNode();
  }

  patchResizeObserver();
}

export function restoreBenchmarkSpies(): void {
  if (!installed) {
    return;
  }

  installed = false;
  countersInstalled = false;
  trackedRoots.length = 0;
  trackedMetrics = null;

  if (originalGetBoundingClientRectDescriptor) {
    Object.defineProperty(
      Element.prototype,
      "getBoundingClientRect",
      originalGetBoundingClientRectDescriptor,
    );
  }

  if (originalGetClientRectsDescriptor) {
    Object.defineProperty(Element.prototype, "getClientRects", originalGetClientRectsDescriptor);
  }

  if (originalReplaceChildrenDescriptor) {
    Object.defineProperty(Element.prototype, "replaceChildren", originalReplaceChildrenDescriptor);
  }

  if (originalCloneNodeDescriptor) {
    Object.defineProperty(Node.prototype, "cloneNode", originalCloneNodeDescriptor);
  }

  if (originalGetComputedStyle) {
    globalThis.getComputedStyle = originalGetComputedStyle;
  }

  for (const patch of getterPatches) {
    Object.defineProperty(patch.owner, patch.property, patch.descriptor);
  }

  getterPatches = [];

  if (originalResizeObserver) {
    globalThis.ResizeObserver = originalResizeObserver;
  }
}

export function beginTracking(...roots: HTMLElement[]): void {
  trackedRoots.length = 0;
  trackedRoots.push(...roots);
  trackedMetrics = countersInstalled ? emptyMetrics() : null;
}

export function endTracking(): BenchmarkMetrics {
  const metrics = trackedMetrics ?? emptyMetrics();
  trackedRoots.length = 0;
  trackedMetrics = null;
  return metrics;
}

export function resetBenchmarkDom(): void {
  trackedRoots.length = 0;
  trackedMetrics = null;
  document.body.innerHTML = "";
}

export function frame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export async function flushVueUpdates(): Promise<void> {
  await nextTick();
  await nextTick();
}

export function createActivityTracker(root: HTMLElement): ActivityTracker {
  let activityVersion = 0;
  let firstActivityAt: number | null = null;
  let lastActivityAt: number | null = null;
  let frameIndex = 0;
  let lastActivityFrame = 0;
  const mark = (time = performance.now()) => {
    activityVersion += 1;
    firstActivityAt ??= time;
    lastActivityAt = time;
    lastActivityFrame = frameIndex;
  };
  const record: ActivityRecord = { mark, root };
  const observer = new MutationObserver((records) => {
    if (trackedMetrics) {
      trackedMetrics.mutationCallbacks += 1;
      trackedMetrics.mutationRecords += records.length;

      for (const record of records) {
        const hidden = isHiddenMutationTarget(record.target);
        if (hidden) {
          trackedMetrics.hiddenMutationRecords += 1;
        }

        if (record.type === "childList") {
          trackedMetrics.childListMutationRecords += 1;
          trackedMetrics.addedNodes += record.addedNodes.length;
          trackedMetrics.removedNodes += record.removedNodes.length;
          if (hidden) {
            trackedMetrics.hiddenChildListMutationRecords += 1;
            trackedMetrics.hiddenAddedNodes += record.addedNodes.length;
            trackedMetrics.hiddenRemovedNodes += record.removedNodes.length;
          }
        } else if (record.type === "characterData") {
          trackedMetrics.characterDataMutationRecords += 1;
        } else if (record.type === "attributes") {
          trackedMetrics.attributeMutationRecords += 1;
        }
      }
    }

    mark();
  });
  let connected = true;

  activityRecords.push(record);
  observer.observe(root, {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
  });

  return {
    disconnect: () => {
      if (!connected) {
        return;
      }

      connected = false;
      observer.disconnect();

      const index = activityRecords.indexOf(record);
      if (index >= 0) {
        activityRecords.splice(index, 1);
      }
    },
    mark,
    waitForStable: async (options = {}) => {
      const maxFrames = options.maxFrames ?? 30;
      const since = options.since ?? performance.now();
      const stableFrames = options.stableFrames ?? 2;
      const startFrameIndex = frameIndex;
      let frames = 0;
      let stableFrameCount = 0;
      let lastActivityVersion = activityVersion;

      while (frames < maxFrames) {
        await frame();
        await nextTick();
        frames += 1;
        frameIndex += 1;

        if (activityVersion === lastActivityVersion) {
          stableFrameCount += 1;
          if (stableFrameCount >= stableFrames) {
            const activeAt = lastActivityAt && lastActivityAt >= since ? lastActivityAt : since;

            return {
              activeMs: activeAt - since,
              framesToActive:
                lastActivityAt && lastActivityAt >= since
                  ? Math.max(0, lastActivityFrame - startFrameIndex)
                  : 0,
              framesToSettle: frames,
            };
          }
        } else {
          stableFrameCount = 0;
          lastActivityVersion = activityVersion;
        }
      }

      return {
        activeMs: Math.max(0, (lastActivityAt ?? performance.now()) - since),
        framesToActive: Math.max(0, lastActivityFrame - startFrameIndex),
        framesToSettle: frames,
      };
    },
  };
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? 0;
}

function overlapDuration(
  entryStart: number,
  entryDuration: number,
  start: number,
  end: number,
): number {
  const entryEnd = entryStart + entryDuration;
  return Math.max(0, Math.min(entryEnd, end) - Math.max(entryStart, start));
}

export function createPerformanceTracker(): PerformanceTracker {
  const longTaskEntries: PerformanceEntry[] = [];
  const longAnimationFrameEntries: PerformanceEntry[] = [];
  const frameTimes: number[] = [];
  const idleRecords: IdleRecord[] = [];
  const observers: PerformanceObserver[] = [];
  let frameRequest = 0;
  let idleRequest = 0;
  let disconnected = false;

  const supportedEntryTypes = new Set(PerformanceObserver.supportedEntryTypes ?? []);
  const observeType = (type: string, entries: PerformanceEntry[]) => {
    if (!supportedEntryTypes.has(type)) {
      return;
    }

    const observer = new PerformanceObserver((list) => {
      entries.push(...list.getEntries());
    });

    observer.observe({ buffered: true, type } as PerformanceObserverInit);
    observers.push(observer);
  };

  observeType("longtask", longTaskEntries);
  observeType("long-animation-frame", longAnimationFrameEntries);

  const sampleFrame = (time: number) => {
    if (disconnected) {
      return;
    }

    frameTimes.push(time);
    frameRequest = requestAnimationFrame(sampleFrame);
  };
  frameRequest = requestAnimationFrame(sampleFrame);

  const requestIdle = globalThis.requestIdleCallback;
  const cancelIdle = globalThis.cancelIdleCallback;
  const sampleIdle: IdleRequestCallback = (deadline) => {
    if (disconnected) {
      return;
    }

    idleRecords.push({
      budget: deadline.timeRemaining(),
      time: performance.now(),
    });
    idleRequest = requestIdle(sampleIdle);
  };

  if (requestIdle) {
    idleRequest = requestIdle(sampleIdle);
  }

  return {
    disconnect: () => {
      disconnected = true;
      cancelAnimationFrame(frameRequest);

      if (cancelIdle && idleRequest) {
        cancelIdle(idleRequest);
      }

      for (const observer of observers) {
        observer.disconnect();
      }
    },
    measure: (start, end) => {
      const frameIntervals: number[] = [];

      for (let index = 1; index < frameTimes.length; index += 1) {
        const previous = frameTimes[index - 1];
        const current = frameTimes[index];

        if (previous === undefined || current === undefined || current < start || previous > end) {
          continue;
        }

        frameIntervals.push(current - previous);
      }

      const frameIntervalMedianMs = percentile(frameIntervals, 0.5);
      const frameIntervalP95Ms = percentile(frameIntervals, 0.95);
      const droppedFrames =
        frameIntervalMedianMs > 0
          ? frameIntervals.filter((interval) => interval > frameIntervalMedianMs * 1.5).length
          : 0;
      const idleWindowRecords = idleRecords.filter(
        (record) => record.time >= start && record.time <= end,
      );
      const longTaskOverlaps = longTaskEntries
        .map((entry) => overlapDuration(entry.startTime, entry.duration, start, end))
        .filter((duration) => duration > 0);
      const longAnimationFrameOverlaps = longAnimationFrameEntries
        .map((entry) => overlapDuration(entry.startTime, entry.duration, start, end))
        .filter((duration) => duration > 0);

      return {
        droppedFrames,
        frameCount: frameIntervals.length,
        frameIntervalMedianMs,
        frameIntervalP95Ms,
        idleBudgetMs: idleWindowRecords.reduce((total, record) => total + record.budget, 0),
        idleCallbackCount: idleWindowRecords.length,
        longAnimationFrameCount: longAnimationFrameOverlaps.length,
        longAnimationFrameMs: longAnimationFrameOverlaps.reduce(
          (total, duration) => total + duration,
          0,
        ),
        longTaskCount: longTaskOverlaps.length,
        longTaskMs: longTaskOverlaps.reduce((total, duration) => total + duration, 0),
      };
    },
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function sampleStandardDeviation(values: number[], average: number): number {
  if (values.length < 2) {
    return 0;
  }

  const variance =
    values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1);

  return Math.sqrt(variance);
}

function tCritical95(sampleCount: number): number {
  const values = [
    12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16,
    2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052,
    2.048, 2.045, 2.042,
  ];
  const degreesOfFreedom = sampleCount - 1;

  if (degreesOfFreedom < 1) {
    return Number.POSITIVE_INFINITY;
  }

  return values[degreesOfFreedom - 1] ?? 1.96;
}

function medianKey(key: string): string {
  return `median${key[0]?.toUpperCase() ?? ""}${key.slice(1)}`;
}

function sampleKey(prefix: string, key: string): string {
  return `${prefix}${key[0]?.toUpperCase() ?? ""}${key.slice(1)}`;
}

export function summarizeRuns(runs: BenchmarkRun[]): BenchmarkSummary {
  const summary: BenchmarkSummary = {
    sampleCount: runs.length,
    runs,
    steps: runs[0]?.steps ?? 0,
  };
  const keys = new Set<string>();

  for (const run of runs) {
    for (const [key, value] of Object.entries(run)) {
      if (typeof value === "number" && key !== "steps") {
        keys.add(key);
      }
    }
  }

  for (const key of keys) {
    const values = runs.map((run) => run[key] ?? 0);
    const average = mean(values);
    const standardDeviation = sampleStandardDeviation(values, average);
    const standardError = standardDeviation / Math.sqrt(values.length);
    const marginOfError95 = tCritical95(values.length) * standardError;
    const medianValue = median(values);
    const medianAbsoluteDeviation = median(values.map((value) => Math.abs(value - medianValue)));

    summary[medianKey(key)] = medianValue;
    summary[sampleKey("sampleMean", key)] = average;
    summary[sampleKey("sampleStdDev", key)] = standardDeviation;
    summary[sampleKey("sampleSem", key)] = standardError;
    summary[sampleKey("sampleMoe95", key)] = marginOfError95;
    summary[sampleKey("sampleRme95", key)] =
      average === 0 ? 0 : (Math.abs(marginOfError95) / Math.abs(average)) * 100;
    summary[sampleKey("sampleCv", key)] =
      average === 0 ? 0 : (Math.abs(standardDeviation) / Math.abs(average)) * 100;
    summary[sampleKey("sampleMad", key)] = medianAbsoluteDeviation;
  }

  return summary;
}
