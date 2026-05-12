import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { WrapClamp } from "../src/index.ts";
import { frame } from "./browser.ts";

import type { App, Component, Ref } from "vue";

type BenchmarkRun = {
  afterSlotCalls: number;
  beforeSlotCalls: number;
  itemSlotCalls: number;
  meanStepMs: number;
  rectReads: number;
  totalMs: number;
};
type BenchmarkSummary = {
  medianAfterSlotCalls: number;
  medianBeforeSlotCalls: number;
  medianItemSlotCalls: number;
  medianMeanStepMs: number;
  medianRectReads: number;
  medianTotalMs: number;
  runs: BenchmarkRun[];
};
type ClampSnapshot = {
  afterText: string;
  beforeText: string;
  contentHeight: number;
  contentWidth: number;
  itemCount: number;
  rootHeight: number;
  rootWidth: number;
};
type MountedBenchmark = {
  app: App;
  container: HTMLElement;
  width: Ref<number>;
};
type MountedVariant = {
  afterSlotCalls: () => number;
  beforeSlotCalls: () => number;
  itemSlotCalls: () => number;
  mountedBenchmark: MountedBenchmark;
};
type NoAffixGrowProfile = {
  hostWidth: number;
  itemCount: number;
  itemWidth: number;
  rowCount: number;
  widths: readonly number[];
};
type MaxHeightProfileOptions = {
  beforeWidth?: number;
  maxLines?: number;
};
type ScenarioObservation = {
  clamps: ClampSnapshot[];
  signature: string;
  width: number;
};
type ScenarioResult = {
  scenario: string;
  summary: BenchmarkSummary;
};
type StableObservation = {
  observation: ScenarioObservation;
  settledMs: number;
};

const mounted = new Set<MountedBenchmark>();
const originalGetBoundingClientRectDescriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "getBoundingClientRect",
);
const originalGetBoundingClientRect = originalGetBoundingClientRectDescriptor?.value as
  | ((this: Element) => DOMRect)
  | undefined;

let trackedRoot: HTMLElement | null = null;
let trackedRectReads = 0;

const singleLineWidths = [
  140, 160, 180, 200, 220, 240, 260, 280, 300, 280, 260, 240, 220, 200, 180, 160, 140,
];
const tableWidths = [180, 220, 260, 300, 340, 300, 260, 220, 180];
const tableWidthBursts = [
  [220, 260, 300, 340],
  [300, 260, 220, 180],
  [220, 260, 300, 340],
  [300, 260, 220, 180],
] as const;
const noAffixJumpGrowWidths = [340, 180, 340, 180, 340, 180, 340];
const noAffixShrinkWidths = [340, 220, 180, 150, 120];
const noAffixHiddenGrowWidths = [120, 520, 120, 520, 120, 520];
const noAffixLargeNWidths = [120, 520, 120, 520];
const noAffixNarrowItemGrowWidths = [120, 520, 120, 520];
const noAffixWideItemGrowWidths = [160, 520, 160, 520];
const noAffixWideContainerGrowWidths = [120, 760, 120, 760];
const noAffixTinyItemWideGrowWidths = [120, 960, 120, 960];
const noAffixMixedItemGrowWidths = [120, 680, 120, 680];
const noAffixHeavyItemGrowWidths = [120, 520, 120, 520, 120, 520];
const beforeAffixGrowWidths = [120, 520, 120, 520];
const beforeAffixShrinkWidths = [520, 360, 240, 160, 120];
const dynamicBeforeGrowWidths = [120, 520, 120, 520];
const dynamicBeforeShrinkWidths = [520, 360, 240, 160, 120];
const staticAfterGrowWidths = [120, 520, 120, 520];
const staticAfterShrinkWidths = [520, 360, 240, 160, 120];
const staticBeforeDynamicAfterGrowWidths = [120, 520, 120, 520];
const afterAffixShrinkWidths = [520, 360, 240, 160, 120];
const maxHeightGrowWidths = [120, 520, 120, 520];
const maxHeightShrinkWidths = [520, 360, 240, 160, 120];
const beforeMaxHeightGrowWidths = [120, 520, 120, 520];
const beforeMaxHeightShrinkWidths = [520, 360, 240, 160, 120];
const mixedLimitGrowWidths = [120, 520, 120, 520];
const mixedLimitShrinkWidths = [520, 360, 240, 160, 120];
const benchmarkWarmupRuns = 1;
const benchmarkMeasuredRuns = 5;

function fixedBadgeStyle(width: number): string {
  return [
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    `width:${width}px`,
    "height:24px",
    "border:1px solid currentColor",
    "border-radius:999px",
    "margin-inline-end:6px",
    "margin-block-end:6px",
    "white-space:nowrap",
  ].join(";");
}

function hostStyle(width: number, extra?: string): string {
  return [
    "display:block",
    `width:${width}px`,
    "font:16px Georgia, serif",
    "line-height:20px",
    extra,
  ]
    .filter(Boolean)
    .join(";");
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function summarize(runs: BenchmarkRun[]): BenchmarkSummary {
  return {
    medianAfterSlotCalls: median(runs.map((run) => run.afterSlotCalls)),
    medianBeforeSlotCalls: median(runs.map((run) => run.beforeSlotCalls)),
    medianItemSlotCalls: median(runs.map((run) => run.itemSlotCalls)),
    medianMeanStepMs: median(runs.map((run) => run.meanStepMs)),
    medianRectReads: median(runs.map((run) => run.rectReads)),
    medianTotalMs: median(runs.map((run) => run.totalMs)),
    runs,
  };
}

function beginRectTracking(root: HTMLElement): void {
  trackedRoot = root;
  trackedRectReads = 0;
}

function endRectTracking(): number {
  const rectReads = trackedRectReads;
  trackedRoot = null;
  trackedRectReads = 0;
  return rectReads;
}

function contentElement(root: HTMLElement): HTMLElement {
  const content = root.querySelector('[data-part="content"]');
  if (!(content instanceof HTMLElement)) {
    throw new Error("Expected WrapClamp content element in benchmark.");
  }

  return content;
}

function partText(root: HTMLElement, part: "before" | "after"): string {
  const element = root.querySelector(`[data-part="${part}"]`);
  return element instanceof HTMLElement ? (element.textContent ?? "").trim() : "";
}

function benchmarkRoots(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-part="root"]')).filter(
    (element): element is HTMLElement => element instanceof HTMLElement,
  );
}

function snapshotClamp(root: HTMLElement): ClampSnapshot {
  const content = contentElement(root);

  return {
    afterText: partText(root, "after"),
    beforeText: partText(root, "before"),
    contentHeight: content.offsetHeight,
    contentWidth: content.offsetWidth,
    itemCount: root.querySelectorAll('[data-part="item"]').length,
    rootHeight: root.offsetHeight,
    rootWidth: root.offsetWidth,
  };
}

function observeScenario(container: HTMLElement, width: number): ScenarioObservation {
  const clamps = benchmarkRoots(container).map(snapshotClamp);

  return {
    clamps,
    signature: JSON.stringify({
      clamps,
      width,
    }),
    width,
  };
}

async function waitForStableObservation(
  container: HTMLElement,
  width: number,
  previousSignature: string | null,
  startTime: number,
  maxFrames = 24,
  stableFrames = 3,
): Promise<StableObservation> {
  let stableCount = 0;
  let lastObservation: ScenarioObservation | null = null;
  let lastSettledMs = 0;

  for (let frameIndex = 0; frameIndex < maxFrames; frameIndex += 1) {
    await nextTick();
    await frame();

    lastObservation = observeScenario(container, width);
    if (lastObservation.signature === previousSignature) {
      stableCount += 1;
    } else {
      lastSettledMs = performance.now() - startTime;
      previousSignature = lastObservation.signature;
      stableCount = 1;
    }

    if (stableCount >= stableFrames) {
      return {
        observation: lastObservation,
        settledMs: lastSettledMs,
      };
    }
  }

  throw new Error(
    `Benchmark scenario did not settle for width ${width}px. Last observation: ${JSON.stringify(lastObservation)}`,
  );
}

function destroyMountedBenchmark(mountedBenchmark: MountedBenchmark): void {
  mountedBenchmark.app.unmount();
  mountedBenchmark.container.remove();
  mounted.delete(mountedBenchmark);
}

function mountSingleLineVariant(component: Component): MountedVariant {
  const width = ref(singleLineWidths[0] ?? 140);
  const container = document.createElement("div");
  document.body.append(container);

  let itemSlotCalls = 0;
  let beforeSlotCalls = 0;
  let afterSlotCalls = 0;

  const items = Array.from({ length: 24 }, (_, index) => `Item ${index + 1}`);

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          component,
          {
            items,
            maxLines: 1,
            style: hostStyle(width.value),
          },
          {
            before: ({
              clamped,
              hiddenItems,
            }: {
              clamped: boolean;
              hiddenItems: readonly string[];
            }) => {
              beforeSlotCalls += 1;
              const visibleCount = items.length - hiddenItems.length;
              return h(
                "span",
                {
                  style: fixedBadgeStyle(
                    clamped ? (visibleCount >= 10 ? 56 : 44) : visibleCount >= 20 ? 72 : 60,
                  ),
                },
                "Lead",
              );
            },
            item: ({ item }: { item: string }) => {
              itemSlotCalls += 1;
              return h("span", { style: fixedBadgeStyle(52) }, item);
            },
            after: ({
              clamped,
              hiddenItems,
            }: {
              clamped: boolean;
              hiddenItems: readonly string[];
            }) => {
              afterSlotCalls += 1;
              const hiddenCount = hiddenItems.length;
              return clamped
                ? h(
                    "span",
                    {
                      style: fixedBadgeStyle(hiddenCount >= 10 ? 68 : hiddenCount > 0 ? 32 : 0),
                    },
                    `+${hiddenCount}`,
                  )
                : null;
            },
          },
        );
    },
  });

  const app = createApp(Host);
  app.mount(container);

  const mountedBenchmark = {
    app,
    container,
    width,
  };
  mounted.add(mountedBenchmark);

  return {
    afterSlotCalls: () => afterSlotCalls,
    beforeSlotCalls: () => beforeSlotCalls,
    itemSlotCalls: () => itemSlotCalls,
    mountedBenchmark,
  };
}

function buildTableRows(): Array<{ id: string; labels: string[] }> {
  return Array.from({ length: 100 }, (_, index) => ({
    id: `R-${index + 1}`,
    labels: [
      "API",
      "Performance",
      "Needs QA",
      "Edge case",
      "Search",
      "Release note",
      `Batch ${index + 1}`,
    ],
  }));
}

function mountTableVariant(component: Component): MountedVariant {
  const width = ref(tableWidths[0] ?? 180);
  const container = document.createElement("div");
  document.body.append(container);

  let itemSlotCalls = 0;
  let beforeSlotCalls = 0;
  let afterSlotCalls = 0;
  const rows = buildTableRows();

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          "div",
          {
            style: hostStyle(360),
          },
          h("table", { style: "table-layout:auto;width:100%;border-collapse:collapse;" }, [
            h(
              "tbody",
              rows.map((row) =>
                h("tr", { key: row.id }, [
                  h("td", { style: "padding:4px 8px;white-space:nowrap;" }, row.id),
                  h("td", { style: "padding:4px 8px;white-space:nowrap;" }, "Owner"),
                  h(
                    "td",
                    { style: "padding:4px 8px;" },
                    h(
                      component,
                      {
                        items: row.labels,
                        maxLines: 2,
                        style: `width:${width.value}px;max-width:100%;`,
                      },
                      {
                        item: ({ item }: { item: string }) => {
                          itemSlotCalls += 1;
                          return h("span", { style: fixedBadgeStyle(68) }, item);
                        },
                        after: ({
                          clamped,
                          hiddenItems,
                        }: {
                          clamped: boolean;
                          hiddenItems: readonly string[];
                        }) => {
                          afterSlotCalls += 1;
                          const hiddenCount = hiddenItems.length;
                          return clamped
                            ? h("span", { style: fixedBadgeStyle(52) }, `+${hiddenCount}`)
                            : null;
                        },
                      },
                    ),
                  ),
                ]),
              ),
            ),
          ]),
        );
    },
  });

  const app = createApp(Host);
  app.mount(container);

  const mountedBenchmark = {
    app,
    container,
    width,
  };
  mounted.add(mountedBenchmark);

  return {
    afterSlotCalls: () => afterSlotCalls,
    beforeSlotCalls: () => beforeSlotCalls,
    itemSlotCalls: () => itemSlotCalls,
    mountedBenchmark,
  };
}

function mountNoAffixResizeVariant(component: Component): MountedVariant {
  const width = ref(noAffixJumpGrowWidths[0] ?? 340);
  const container = document.createElement("div");
  document.body.append(container);

  let itemSlotCalls = 0;
  let beforeSlotCalls = 0;
  let afterSlotCalls = 0;
  const rows = buildTableRows();

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          "div",
          {
            style: hostStyle(360),
          },
          h("table", { style: "table-layout:auto;width:100%;border-collapse:collapse;" }, [
            h(
              "tbody",
              rows.map((row) =>
                h("tr", { key: row.id }, [
                  h("td", { style: "padding:4px 8px;white-space:nowrap;" }, row.id),
                  h("td", { style: "padding:4px 8px;white-space:nowrap;" }, "Owner"),
                  h(
                    "td",
                    { style: "padding:4px 8px;" },
                    h(
                      component,
                      {
                        items: row.labels,
                        maxLines: 2,
                        style: `width:${width.value}px;max-width:100%;`,
                      },
                      {
                        item: ({ item }: { item: string }) => {
                          itemSlotCalls += 1;
                          return h("span", { style: fixedBadgeStyle(68) }, item);
                        },
                      },
                    ),
                  ),
                ]),
              ),
            ),
          ]),
        );
    },
  });

  const app = createApp(Host);
  app.mount(container);

  const mountedBenchmark = {
    app,
    container,
    width,
  };
  mounted.add(mountedBenchmark);

  return {
    afterSlotCalls: () => afterSlotCalls,
    beforeSlotCalls: () => beforeSlotCalls,
    itemSlotCalls: () => itemSlotCalls,
    mountedBenchmark,
  };
}

function mountNoAffixHiddenGrowVariant(component: Component): MountedVariant {
  const width = ref(noAffixHiddenGrowWidths[0] ?? 120);
  const container = document.createElement("div");
  document.body.append(container);

  let itemSlotCalls = 0;
  let beforeSlotCalls = 0;
  let afterSlotCalls = 0;
  const rows = Array.from({ length: 100 }, (_, rowIndex) => ({
    id: `R-${rowIndex + 1}`,
    labels: Array.from({ length: 24 }, (_, itemIndex) => `I${itemIndex + 1}`),
  }));

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          "div",
          {
            style: hostStyle(640),
          },
          h("table", { style: "table-layout:auto;width:100%;border-collapse:collapse;" }, [
            h(
              "tbody",
              rows.map((row) =>
                h("tr", { key: row.id }, [
                  h("td", { style: "padding:4px 8px;white-space:nowrap;" }, row.id),
                  h(
                    "td",
                    { style: "padding:4px 8px;" },
                    h(
                      component,
                      {
                        items: row.labels,
                        maxLines: 2,
                        style: `width:${width.value}px;max-width:100%;`,
                      },
                      {
                        item: ({ item }: { item: string }) => {
                          itemSlotCalls += 1;
                          return h("span", { style: fixedBadgeStyle(40) }, item);
                        },
                      },
                    ),
                  ),
                ]),
              ),
            ),
          ]),
        );
    },
  });

  const app = createApp(Host);
  app.mount(container);

  const mountedBenchmark = {
    app,
    container,
    width,
  };
  mounted.add(mountedBenchmark);

  return {
    afterSlotCalls: () => afterSlotCalls,
    beforeSlotCalls: () => beforeSlotCalls,
    itemSlotCalls: () => itemSlotCalls,
    mountedBenchmark,
  };
}

function mountNoAffixLargeNVariant(component: Component): MountedVariant {
  const width = ref(noAffixLargeNWidths[0] ?? 120);
  const container = document.createElement("div");
  document.body.append(container);

  let itemSlotCalls = 0;
  let beforeSlotCalls = 0;
  let afterSlotCalls = 0;
  const rows = Array.from({ length: 40 }, (_, rowIndex) => ({
    id: `R-${rowIndex + 1}`,
    labels: Array.from({ length: 200 }, (_, itemIndex) => `I${itemIndex + 1}`),
  }));

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          "div",
          {
            style: hostStyle(640),
          },
          h("table", { style: "table-layout:auto;width:100%;border-collapse:collapse;" }, [
            h(
              "tbody",
              rows.map((row) =>
                h("tr", { key: row.id }, [
                  h("td", { style: "padding:4px 8px;white-space:nowrap;" }, row.id),
                  h(
                    "td",
                    { style: "padding:4px 8px;" },
                    h(
                      component,
                      {
                        items: row.labels,
                        maxLines: 2,
                        style: `width:${width.value}px;max-width:100%;`,
                      },
                      {
                        item: ({ item }: { item: string }) => {
                          itemSlotCalls += 1;
                          return h("span", { style: fixedBadgeStyle(40) }, item);
                        },
                      },
                    ),
                  ),
                ]),
              ),
            ),
          ]),
        );
    },
  });

  const app = createApp(Host);
  app.mount(container);

  const mountedBenchmark = {
    app,
    container,
    width,
  };
  mounted.add(mountedBenchmark);

  return {
    afterSlotCalls: () => afterSlotCalls,
    beforeSlotCalls: () => beforeSlotCalls,
    itemSlotCalls: () => itemSlotCalls,
    mountedBenchmark,
  };
}

function mountNoAffixGrowProfileVariant(
  component: Component,
  profile: NoAffixGrowProfile,
): MountedVariant {
  const width = ref(profile.widths[0] ?? 120);
  const container = document.createElement("div");
  document.body.append(container);

  let itemSlotCalls = 0;
  let beforeSlotCalls = 0;
  let afterSlotCalls = 0;
  const rows = Array.from({ length: profile.rowCount }, (_, rowIndex) => ({
    id: `R-${rowIndex + 1}`,
    labels: Array.from({ length: profile.itemCount }, (_, itemIndex) => `I${itemIndex + 1}`),
  }));

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          "div",
          {
            style: hostStyle(profile.hostWidth),
          },
          h("table", { style: "table-layout:auto;width:100%;border-collapse:collapse;" }, [
            h(
              "tbody",
              rows.map((row) =>
                h("tr", { key: row.id }, [
                  h("td", { style: "padding:4px 8px;white-space:nowrap;" }, row.id),
                  h(
                    "td",
                    { style: "padding:4px 8px;" },
                    h(
                      component,
                      {
                        items: row.labels,
                        maxLines: 2,
                        style: `width:${width.value}px;max-width:100%;`,
                      },
                      {
                        item: ({ item }: { item: string }) => {
                          itemSlotCalls += 1;
                          return h("span", { style: fixedBadgeStyle(profile.itemWidth) }, item);
                        },
                      },
                    ),
                  ),
                ]),
              ),
            ),
          ]),
        );
    },
  });

  const app = createApp(Host);
  app.mount(container);

  const mountedBenchmark = {
    app,
    container,
    width,
  };
  mounted.add(mountedBenchmark);

  return {
    afterSlotCalls: () => afterSlotCalls,
    beforeSlotCalls: () => beforeSlotCalls,
    itemSlotCalls: () => itemSlotCalls,
    mountedBenchmark,
  };
}

function mountNoAffixNarrowItemGrowVariant(component: Component): MountedVariant {
  return mountNoAffixGrowProfileVariant(component, {
    hostWidth: 640,
    itemCount: 48,
    itemWidth: 28,
    rowCount: 60,
    widths: noAffixNarrowItemGrowWidths,
  });
}

function mountNoAffixWideItemGrowVariant(component: Component): MountedVariant {
  return mountNoAffixGrowProfileVariant(component, {
    hostWidth: 640,
    itemCount: 24,
    itemWidth: 72,
    rowCount: 60,
    widths: noAffixWideItemGrowWidths,
  });
}

function mountNoAffixWideContainerGrowVariant(component: Component): MountedVariant {
  return mountNoAffixGrowProfileVariant(component, {
    hostWidth: 880,
    itemCount: 64,
    itemWidth: 40,
    rowCount: 60,
    widths: noAffixWideContainerGrowWidths,
  });
}

function mountNoAffixTinyItemWideGrowVariant(component: Component): MountedVariant {
  return mountNoAffixGrowProfileVariant(component, {
    hostWidth: 1040,
    itemCount: 120,
    itemWidth: 16,
    rowCount: 40,
    widths: noAffixTinyItemWideGrowWidths,
  });
}

function mountNoAffixMixedItemGrowVariant(component: Component): MountedVariant {
  const width = ref(noAffixMixedItemGrowWidths[0] ?? 120);
  const container = document.createElement("div");
  document.body.append(container);

  let itemSlotCalls = 0;
  let beforeSlotCalls = 0;
  let afterSlotCalls = 0;
  const itemWidths = [24, 64, 36, 96, 48, 120, 28, 72];
  const rows = Array.from({ length: 60 }, (_, rowIndex) => ({
    id: `R-${rowIndex + 1}`,
    labels: Array.from({ length: 64 }, (_, itemIndex) => `I${itemIndex + 1}`),
  }));

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          "div",
          {
            style: hostStyle(760),
          },
          h("table", { style: "table-layout:auto;width:100%;border-collapse:collapse;" }, [
            h(
              "tbody",
              rows.map((row) =>
                h("tr", { key: row.id }, [
                  h("td", { style: "padding:4px 8px;white-space:nowrap;" }, row.id),
                  h(
                    "td",
                    { style: "padding:4px 8px;" },
                    h(
                      component,
                      {
                        items: row.labels,
                        maxLines: 2,
                        style: `width:${width.value}px;max-width:100%;`,
                      },
                      {
                        item: ({ index, item }: { index: number; item: string }) => {
                          itemSlotCalls += 1;
                          return h(
                            "span",
                            { style: fixedBadgeStyle(itemWidths[index % itemWidths.length] ?? 40) },
                            item,
                          );
                        },
                      },
                    ),
                  ),
                ]),
              ),
            ),
          ]),
        );
    },
  });

  const app = createApp(Host);
  app.mount(container);

  const mountedBenchmark = {
    app,
    container,
    width,
  };
  mounted.add(mountedBenchmark);

  return {
    afterSlotCalls: () => afterSlotCalls,
    beforeSlotCalls: () => beforeSlotCalls,
    itemSlotCalls: () => itemSlotCalls,
    mountedBenchmark,
  };
}

function mountNoAffixHeavyItemGrowVariant(component: Component): MountedVariant {
  const width = ref(noAffixHeavyItemGrowWidths[0] ?? 120);
  const container = document.createElement("div");
  document.body.append(container);

  let itemSlotCalls = 0;
  let beforeSlotCalls = 0;
  let afterSlotCalls = 0;
  const rows = Array.from({ length: 100 }, (_, rowIndex) => ({
    id: `R-${rowIndex + 1}`,
    labels: Array.from({ length: 24 }, (_, itemIndex) => `I${itemIndex + 1}`),
  }));

  function renderWork(seed: string): number {
    let hash = 0;
    for (let index = 0; index < 600; index += 1) {
      hash = (hash * 33 + seed.charCodeAt(index % seed.length)) % 100_000;
    }

    return hash;
  }

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          "div",
          {
            style: hostStyle(640),
          },
          h("table", { style: "table-layout:auto;width:100%;border-collapse:collapse;" }, [
            h(
              "tbody",
              rows.map((row) =>
                h("tr", { key: row.id }, [
                  h("td", { style: "padding:4px 8px;white-space:nowrap;" }, row.id),
                  h(
                    "td",
                    { style: "padding:4px 8px;" },
                    h(
                      component,
                      {
                        items: row.labels,
                        maxLines: 2,
                        style: `width:${width.value}px;max-width:100%;`,
                      },
                      {
                        item: ({ item }: { item: string }) => {
                          itemSlotCalls += 1;
                          return h(
                            "span",
                            {
                              "data-render-work": renderWork(item),
                              style: fixedBadgeStyle(40),
                            },
                            item,
                          );
                        },
                      },
                    ),
                  ),
                ]),
              ),
            ),
          ]),
        );
    },
  });

  const app = createApp(Host);
  app.mount(container);

  const mountedBenchmark = {
    app,
    container,
    width,
  };
  mounted.add(mountedBenchmark);

  return {
    afterSlotCalls: () => afterSlotCalls,
    beforeSlotCalls: () => beforeSlotCalls,
    itemSlotCalls: () => itemSlotCalls,
    mountedBenchmark,
  };
}

function mountBeforeAffixGrowVariant(component: Component): MountedVariant {
  return mountBeforeAffixProfileVariant(component, beforeAffixGrowWidths);
}

function mountBeforeAffixShrinkVariant(component: Component): MountedVariant {
  return mountBeforeAffixProfileVariant(component, beforeAffixShrinkWidths);
}

function mountDynamicBeforeGrowVariant(component: Component): MountedVariant {
  return mountDynamicBeforeProfileVariant(component, dynamicBeforeGrowWidths);
}

function mountDynamicBeforeShrinkVariant(component: Component): MountedVariant {
  return mountDynamicBeforeProfileVariant(component, dynamicBeforeShrinkWidths);
}

function mountDynamicBeforeProfileVariant(
  component: Component,
  widths: readonly number[],
): MountedVariant {
  const width = ref(widths[0] ?? 120);
  const container = document.createElement("div");
  document.body.append(container);

  let itemSlotCalls = 0;
  let beforeSlotCalls = 0;
  let afterSlotCalls = 0;
  const rows = Array.from({ length: 100 }, (_, rowIndex) => ({
    id: `R-${rowIndex + 1}`,
    labels: Array.from({ length: 24 }, (_, itemIndex) => `I${itemIndex + 1}`),
  }));

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          "div",
          {
            style: hostStyle(640),
          },
          h("table", { style: "table-layout:auto;width:100%;border-collapse:collapse;" }, [
            h(
              "tbody",
              rows.map((row) =>
                h("tr", { key: row.id }, [
                  h("td", { style: "padding:4px 8px;white-space:nowrap;" }, row.id),
                  h(
                    "td",
                    { style: "padding:4px 8px;" },
                    h(
                      component,
                      {
                        items: row.labels,
                        maxLines: 2,
                        style: `width:${width.value}px;max-width:100%;`,
                      },
                      {
                        before: ({ hiddenItems }: { hiddenItems: readonly string[] }) => {
                          beforeSlotCalls += 1;
                          return h(
                            "span",
                            { style: fixedBadgeStyle(hiddenItems.length >= 10 ? 160 : 40) },
                            "Lead",
                          );
                        },
                        item: ({ item }: { item: string }) => {
                          itemSlotCalls += 1;
                          return h("span", { style: fixedBadgeStyle(40) }, item);
                        },
                      },
                    ),
                  ),
                ]),
              ),
            ),
          ]),
        );
    },
  });

  const app = createApp(Host);
  app.mount(container);

  const mountedBenchmark = {
    app,
    container,
    width,
  };
  mounted.add(mountedBenchmark);

  return {
    afterSlotCalls: () => afterSlotCalls,
    beforeSlotCalls: () => beforeSlotCalls,
    itemSlotCalls: () => itemSlotCalls,
    mountedBenchmark,
  };
}

function mountAfterAffixShrinkVariant(component: Component): MountedVariant {
  const width = ref(afterAffixShrinkWidths[0] ?? 520);
  const container = document.createElement("div");
  document.body.append(container);

  let itemSlotCalls = 0;
  let beforeSlotCalls = 0;
  let afterSlotCalls = 0;
  const rows = Array.from({ length: 100 }, (_, rowIndex) => ({
    id: `R-${rowIndex + 1}`,
    labels: Array.from({ length: 24 }, (_, itemIndex) => `I${itemIndex + 1}`),
  }));

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          "div",
          {
            style: hostStyle(640),
          },
          h("table", { style: "table-layout:auto;width:100%;border-collapse:collapse;" }, [
            h(
              "tbody",
              rows.map((row) =>
                h("tr", { key: row.id }, [
                  h("td", { style: "padding:4px 8px;white-space:nowrap;" }, row.id),
                  h(
                    "td",
                    { style: "padding:4px 8px;" },
                    h(
                      component,
                      {
                        items: row.labels,
                        maxLines: 2,
                        style: `width:${width.value}px;max-width:100%;`,
                      },
                      {
                        item: ({ item }: { item: string }) => {
                          itemSlotCalls += 1;
                          return h("span", { style: fixedBadgeStyle(40) }, item);
                        },
                        after: ({
                          clamped,
                          hiddenItems,
                        }: {
                          clamped: boolean;
                          hiddenItems: readonly string[];
                        }) => {
                          afterSlotCalls += 1;
                          return clamped
                            ? h(
                                "span",
                                {
                                  style: fixedBadgeStyle(hiddenItems.length >= 10 ? 68 : 32),
                                },
                                `+${hiddenItems.length}`,
                              )
                            : null;
                        },
                      },
                    ),
                  ),
                ]),
              ),
            ),
          ]),
        );
    },
  });

  const app = createApp(Host);
  app.mount(container);

  const mountedBenchmark = {
    app,
    container,
    width,
  };
  mounted.add(mountedBenchmark);

  return {
    afterSlotCalls: () => afterSlotCalls,
    beforeSlotCalls: () => beforeSlotCalls,
    itemSlotCalls: () => itemSlotCalls,
    mountedBenchmark,
  };
}

function mountStaticAfterGrowVariant(component: Component): MountedVariant {
  return mountStaticAfterProfileVariant(component, staticAfterGrowWidths);
}

function mountStaticAfterShrinkVariant(component: Component): MountedVariant {
  return mountStaticAfterProfileVariant(component, staticAfterShrinkWidths);
}

function mountStaticAfterProfileVariant(
  component: Component,
  widths: readonly number[],
): MountedVariant {
  const width = ref(widths[0] ?? 120);
  const container = document.createElement("div");
  document.body.append(container);

  let itemSlotCalls = 0;
  let beforeSlotCalls = 0;
  let afterSlotCalls = 0;
  const rows = Array.from({ length: 100 }, (_, rowIndex) => ({
    id: `R-${rowIndex + 1}`,
    labels: Array.from({ length: 24 }, (_, itemIndex) => `I${itemIndex + 1}`),
  }));

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          "div",
          {
            style: hostStyle(640),
          },
          h("table", { style: "table-layout:auto;width:100%;border-collapse:collapse;" }, [
            h(
              "tbody",
              rows.map((row) =>
                h("tr", { key: row.id }, [
                  h("td", { style: "padding:4px 8px;white-space:nowrap;" }, row.id),
                  h(
                    "td",
                    { style: "padding:4px 8px;" },
                    h(
                      component,
                      {
                        items: row.labels,
                        maxLines: 2,
                        style: `width:${width.value}px;max-width:100%;`,
                      },
                      {
                        item: ({ item }: { item: string }) => {
                          itemSlotCalls += 1;
                          return h("span", { style: fixedBadgeStyle(40) }, item);
                        },
                        after: ({ clamped }: { clamped: boolean }) => {
                          afterSlotCalls += 1;
                          return clamped ? h("span", { style: fixedBadgeStyle(52) }, "More") : null;
                        },
                      },
                    ),
                  ),
                ]),
              ),
            ),
          ]),
        );
    },
  });

  const app = createApp(Host);
  app.mount(container);

  const mountedBenchmark = {
    app,
    container,
    width,
  };
  mounted.add(mountedBenchmark);

  return {
    afterSlotCalls: () => afterSlotCalls,
    beforeSlotCalls: () => beforeSlotCalls,
    itemSlotCalls: () => itemSlotCalls,
    mountedBenchmark,
  };
}

function mountStaticBeforeDynamicAfterGrowVariant(component: Component): MountedVariant {
  const width = ref(staticBeforeDynamicAfterGrowWidths[0] ?? 120);
  const container = document.createElement("div");
  document.body.append(container);

  let itemSlotCalls = 0;
  let beforeSlotCalls = 0;
  let afterSlotCalls = 0;
  const rows = Array.from({ length: 100 }, (_, rowIndex) => ({
    id: `R-${rowIndex + 1}`,
    labels: Array.from({ length: 24 }, (_, itemIndex) => `I${itemIndex + 1}`),
  }));

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          "div",
          {
            style: hostStyle(640),
          },
          h("table", { style: "table-layout:auto;width:100%;border-collapse:collapse;" }, [
            h(
              "tbody",
              rows.map((row) =>
                h("tr", { key: row.id }, [
                  h("td", { style: "padding:4px 8px;white-space:nowrap;" }, row.id),
                  h(
                    "td",
                    { style: "padding:4px 8px;" },
                    h(
                      component,
                      {
                        items: row.labels,
                        maxLines: 2,
                        style: `width:${width.value}px;max-width:100%;`,
                      },
                      {
                        before: () => {
                          beforeSlotCalls += 1;
                          return h("span", { style: fixedBadgeStyle(72) }, "Lead");
                        },
                        item: ({ item }: { item: string }) => {
                          itemSlotCalls += 1;
                          return h("span", { style: fixedBadgeStyle(40) }, item);
                        },
                        after: ({
                          clamped,
                          hiddenItems,
                        }: {
                          clamped: boolean;
                          hiddenItems: readonly string[];
                        }) => {
                          afterSlotCalls += 1;
                          const hiddenCount = hiddenItems.length;
                          return clamped
                            ? h(
                                "span",
                                {
                                  style: fixedBadgeStyle(hiddenCount >= 10 ? 68 : 32),
                                },
                                `+${hiddenCount}`,
                              )
                            : null;
                        },
                      },
                    ),
                  ),
                ]),
              ),
            ),
          ]),
        );
    },
  });

  const app = createApp(Host);
  app.mount(container);

  const mountedBenchmark = {
    app,
    container,
    width,
  };
  mounted.add(mountedBenchmark);

  return {
    afterSlotCalls: () => afterSlotCalls,
    beforeSlotCalls: () => beforeSlotCalls,
    itemSlotCalls: () => itemSlotCalls,
    mountedBenchmark,
  };
}

function mountMaxHeightGrowVariant(component: Component): MountedVariant {
  return mountMaxHeightProfileVariant(component, maxHeightGrowWidths);
}

function mountMaxHeightShrinkVariant(component: Component): MountedVariant {
  return mountMaxHeightProfileVariant(component, maxHeightShrinkWidths);
}

function mountBeforeMaxHeightGrowVariant(component: Component): MountedVariant {
  return mountMaxHeightProfileVariant(component, beforeMaxHeightGrowWidths, {
    beforeWidth: 72,
  });
}

function mountBeforeMaxHeightShrinkVariant(component: Component): MountedVariant {
  return mountMaxHeightProfileVariant(component, beforeMaxHeightShrinkWidths, {
    beforeWidth: 72,
  });
}

function mountMixedLimitGrowVariant(component: Component): MountedVariant {
  return mountMaxHeightProfileVariant(component, mixedLimitGrowWidths, {
    maxLines: 3,
  });
}

function mountMixedLimitShrinkVariant(component: Component): MountedVariant {
  return mountMaxHeightProfileVariant(component, mixedLimitShrinkWidths, {
    maxLines: 3,
  });
}

function mountMaxHeightProfileVariant(
  component: Component,
  widths: readonly number[],
  options: MaxHeightProfileOptions = {},
): MountedVariant {
  const width = ref(widths[0] ?? 120);
  const container = document.createElement("div");
  document.body.append(container);

  let itemSlotCalls = 0;
  let beforeSlotCalls = 0;
  let afterSlotCalls = 0;
  const rows = Array.from({ length: 100 }, (_, rowIndex) => ({
    id: `R-${rowIndex + 1}`,
    labels: Array.from({ length: 24 }, (_, itemIndex) => `I${itemIndex + 1}`),
  }));

  const Host = defineComponent({
    setup() {
      const item = ({ item }: { item: string }) => {
        itemSlotCalls += 1;
        return h("span", { style: fixedBadgeStyle(40) }, item);
      };

      return () =>
        h(
          "div",
          {
            style: hostStyle(640),
          },
          h("table", { style: "table-layout:auto;width:100%;border-collapse:collapse;" }, [
            h(
              "tbody",
              rows.map((row) =>
                h("tr", { key: row.id }, [
                  h("td", { style: "padding:4px 8px;white-space:nowrap;" }, row.id),
                  h(
                    "td",
                    { style: "padding:4px 8px;" },
                    h(
                      component,
                      {
                        items: row.labels,
                        maxHeight: "60px",
                        maxLines: options.maxLines,
                        style: `width:${width.value}px;max-width:100%;`,
                      },
                      options.beforeWidth === undefined
                        ? {
                            item,
                          }
                        : {
                            before: () => {
                              beforeSlotCalls += 1;
                              return h(
                                "span",
                                { style: fixedBadgeStyle(options.beforeWidth ?? 0) },
                                "Lead",
                              );
                            },
                            item,
                          },
                    ),
                  ),
                ]),
              ),
            ),
          ]),
        );
    },
  });

  const app = createApp(Host);
  app.mount(container);

  const mountedBenchmark = {
    app,
    container,
    width,
  };
  mounted.add(mountedBenchmark);

  return {
    afterSlotCalls: () => afterSlotCalls,
    beforeSlotCalls: () => beforeSlotCalls,
    itemSlotCalls: () => itemSlotCalls,
    mountedBenchmark,
  };
}

function mountBeforeAffixProfileVariant(
  component: Component,
  widths: readonly number[],
): MountedVariant {
  const width = ref(widths[0] ?? 120);
  const container = document.createElement("div");
  document.body.append(container);

  let itemSlotCalls = 0;
  let beforeSlotCalls = 0;
  let afterSlotCalls = 0;
  const rows = Array.from({ length: 100 }, (_, rowIndex) => ({
    id: `R-${rowIndex + 1}`,
    labels: Array.from({ length: 24 }, (_, itemIndex) => `I${itemIndex + 1}`),
  }));

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          "div",
          {
            style: hostStyle(640),
          },
          h("table", { style: "table-layout:auto;width:100%;border-collapse:collapse;" }, [
            h(
              "tbody",
              rows.map((row) =>
                h("tr", { key: row.id }, [
                  h("td", { style: "padding:4px 8px;white-space:nowrap;" }, row.id),
                  h(
                    "td",
                    { style: "padding:4px 8px;" },
                    h(
                      component,
                      {
                        items: row.labels,
                        maxLines: 2,
                        style: `width:${width.value}px;max-width:100%;`,
                      },
                      {
                        before: () => {
                          beforeSlotCalls += 1;
                          return h("span", { style: fixedBadgeStyle(72) }, "Lead");
                        },
                        item: ({ item }: { item: string }) => {
                          itemSlotCalls += 1;
                          return h("span", { style: fixedBadgeStyle(40) }, item);
                        },
                      },
                    ),
                  ),
                ]),
              ),
            ),
          ]),
        );
    },
  });

  const app = createApp(Host);
  app.mount(container);

  const mountedBenchmark = {
    app,
    container,
    width,
  };
  mounted.add(mountedBenchmark);

  return {
    afterSlotCalls: () => afterSlotCalls,
    beforeSlotCalls: () => beforeSlotCalls,
    itemSlotCalls: () => itemSlotCalls,
    mountedBenchmark,
  };
}

async function runWidthSequence(
  mountedBenchmark: MountedBenchmark,
  widths: readonly number[],
  initialObservation: ScenarioObservation,
): Promise<{
  meanStepMs: number;
  rectReads: number;
  totalMs: number;
}> {
  const observations = [initialObservation];
  const measuredWidths = widths.slice(1);
  let totalMs = 0;

  beginRectTracking(mountedBenchmark.container);

  for (const width of measuredWidths) {
    const stepStart = performance.now();
    mountedBenchmark.width.value = width;
    const stableObservation = await waitForStableObservation(
      mountedBenchmark.container,
      width,
      observations.at(-1)?.signature ?? null,
      stepStart,
    );
    observations.push(stableObservation.observation);
    totalMs += stableObservation.settledMs;
  }

  return {
    meanStepMs: totalMs / Math.max(1, measuredWidths.length),
    rectReads: endRectTracking(),
    totalMs,
  };
}

async function runWidthBursts(
  mountedBenchmark: MountedBenchmark,
  bursts: readonly (readonly number[])[],
  initialObservation: ScenarioObservation,
): Promise<{
  meanStepMs: number;
  rectReads: number;
  totalMs: number;
}> {
  const observations = [initialObservation];
  let totalMs = 0;

  beginRectTracking(mountedBenchmark.container);

  for (const burst of bursts) {
    const finalWidth = burst.at(-1);
    if (finalWidth === undefined) {
      throw new Error("Benchmark width bursts must not be empty.");
    }

    const stepStart = performance.now();
    for (const width of burst) {
      mountedBenchmark.width.value = width;
      await nextTick();
    }

    const stableObservation = await waitForStableObservation(
      mountedBenchmark.container,
      finalWidth,
      observations.at(-1)?.signature ?? null,
      stepStart,
    );
    observations.push(stableObservation.observation);
    totalMs += stableObservation.settledMs;
  }

  return {
    meanStepMs: totalMs / Math.max(1, bursts.length),
    rectReads: endRectTracking(),
    totalMs,
  };
}

async function runScenario(
  mountVariant: (component: Component) => MountedVariant,
  widths: readonly number[],
): Promise<BenchmarkRun> {
  const initialWidth = widths[0];
  if (initialWidth === undefined) {
    throw new Error("Benchmark widths must include an initial mounted width.");
  }

  const mountedVariant = mountVariant(WrapClamp);
  try {
    const initialObservation = (
      await waitForStableObservation(
        mountedVariant.mountedBenchmark.container,
        initialWidth,
        null,
        performance.now(),
      )
    ).observation;
    const baselineAfter = mountedVariant.afterSlotCalls();
    const baselineBefore = mountedVariant.beforeSlotCalls();
    const baselineItem = mountedVariant.itemSlotCalls();
    const metrics = await runWidthSequence(
      mountedVariant.mountedBenchmark,
      widths,
      initialObservation,
    );

    return {
      afterSlotCalls: mountedVariant.afterSlotCalls() - baselineAfter,
      beforeSlotCalls: mountedVariant.beforeSlotCalls() - baselineBefore,
      itemSlotCalls: mountedVariant.itemSlotCalls() - baselineItem,
      meanStepMs: metrics.meanStepMs,
      rectReads: metrics.rectReads,
      totalMs: metrics.totalMs,
    };
  } finally {
    destroyMountedBenchmark(mountedVariant.mountedBenchmark);
  }
}

async function runBenchmark(
  mountVariant: (component: Component) => MountedVariant,
  widths: readonly number[],
): Promise<BenchmarkSummary> {
  const runs: BenchmarkRun[] = [];

  for (let runIndex = 0; runIndex < benchmarkWarmupRuns + benchmarkMeasuredRuns; runIndex += 1) {
    const run = await runScenario(mountVariant, widths);
    if (runIndex >= benchmarkWarmupRuns) {
      runs.push(run);
    }
  }

  return summarize(runs);
}

async function runBurstScenario(
  mountVariant: (component: Component) => MountedVariant,
  initialWidth: number,
  bursts: readonly (readonly number[])[],
): Promise<BenchmarkRun> {
  const mountedVariant = mountVariant(WrapClamp);
  mountedVariant.mountedBenchmark.width.value = initialWidth;

  try {
    const initialObservation = (
      await waitForStableObservation(
        mountedVariant.mountedBenchmark.container,
        initialWidth,
        null,
        performance.now(),
      )
    ).observation;
    const baselineAfter = mountedVariant.afterSlotCalls();
    const baselineBefore = mountedVariant.beforeSlotCalls();
    const baselineItem = mountedVariant.itemSlotCalls();
    const metrics = await runWidthBursts(
      mountedVariant.mountedBenchmark,
      bursts,
      initialObservation,
    );

    return {
      afterSlotCalls: mountedVariant.afterSlotCalls() - baselineAfter,
      beforeSlotCalls: mountedVariant.beforeSlotCalls() - baselineBefore,
      itemSlotCalls: mountedVariant.itemSlotCalls() - baselineItem,
      meanStepMs: metrics.meanStepMs,
      rectReads: metrics.rectReads,
      totalMs: metrics.totalMs,
    };
  } finally {
    destroyMountedBenchmark(mountedVariant.mountedBenchmark);
  }
}

async function runBurstBenchmark(
  mountVariant: (component: Component) => MountedVariant,
  initialWidth: number,
  bursts: readonly (readonly number[])[],
): Promise<BenchmarkSummary> {
  const runs: BenchmarkRun[] = [];

  for (let runIndex = 0; runIndex < benchmarkWarmupRuns + benchmarkMeasuredRuns; runIndex += 1) {
    const run = await runBurstScenario(mountVariant, initialWidth, bursts);
    if (runIndex >= benchmarkWarmupRuns) {
      runs.push(run);
    }
  }

  return summarize(runs);
}

afterEach(() => {
  for (const mountedBenchmark of Array.from(mounted)) {
    destroyMountedBenchmark(mountedBenchmark);
  }

  trackedRoot = null;
  trackedRectReads = 0;
});

beforeAll(() => {
  if (!originalGetBoundingClientRect) {
    throw new Error("Missing Element.prototype.getBoundingClientRect for benchmark setup.");
  }

  Element.prototype.getBoundingClientRect = function patchedGetBoundingClientRect(
    this: Element,
  ): DOMRect {
    if (trackedRoot && (this === trackedRoot || trackedRoot.contains(this))) {
      trackedRectReads += 1;
    }

    return originalGetBoundingClientRect.call(this);
  };
});

afterAll(() => {
  if (originalGetBoundingClientRectDescriptor) {
    Object.defineProperty(
      Element.prototype,
      "getBoundingClientRect",
      originalGetBoundingClientRectDescriptor,
    );
  }
});

describe("WrapClamp benchmark", () => {
  it("reports current workload benchmark results", async () => {
    const scenarios: ScenarioResult[] = [
      {
        scenario: "single-line-width-sweep",
        summary: await runBenchmark(mountSingleLineVariant, singleLineWidths),
      },
      {
        scenario: "table-demo-width-sweep",
        summary: await runBenchmark(mountTableVariant, tableWidths),
      },
      {
        scenario: "table-demo-width-churn",
        summary: await runBurstBenchmark(
          mountTableVariant,
          tableWidths[0] ?? 180,
          tableWidthBursts,
        ),
      },
      {
        scenario: "no-affix-jump-grow",
        summary: await runBenchmark(mountNoAffixResizeVariant, noAffixJumpGrowWidths),
      },
      {
        scenario: "no-affix-shrink",
        summary: await runBenchmark(mountNoAffixResizeVariant, noAffixShrinkWidths),
      },
      {
        scenario: "no-affix-hidden-grow",
        summary: await runBenchmark(mountNoAffixHiddenGrowVariant, noAffixHiddenGrowWidths),
      },
      {
        scenario: "no-affix-large-n",
        summary: await runBenchmark(mountNoAffixLargeNVariant, noAffixLargeNWidths),
      },
      {
        scenario: "no-affix-narrow-item-grow",
        summary: await runBenchmark(mountNoAffixNarrowItemGrowVariant, noAffixNarrowItemGrowWidths),
      },
      {
        scenario: "no-affix-wide-item-grow",
        summary: await runBenchmark(mountNoAffixWideItemGrowVariant, noAffixWideItemGrowWidths),
      },
      {
        scenario: "no-affix-wide-container-grow",
        summary: await runBenchmark(
          mountNoAffixWideContainerGrowVariant,
          noAffixWideContainerGrowWidths,
        ),
      },
      {
        scenario: "no-affix-tiny-item-wide-grow",
        summary: await runBenchmark(
          mountNoAffixTinyItemWideGrowVariant,
          noAffixTinyItemWideGrowWidths,
        ),
      },
      {
        scenario: "no-affix-mixed-item-grow",
        summary: await runBenchmark(mountNoAffixMixedItemGrowVariant, noAffixMixedItemGrowWidths),
      },
      {
        scenario: "no-affix-heavy-item-grow",
        summary: await runBenchmark(mountNoAffixHeavyItemGrowVariant, noAffixHeavyItemGrowWidths),
      },
      {
        scenario: "before-affix-grow",
        summary: await runBenchmark(mountBeforeAffixGrowVariant, beforeAffixGrowWidths),
      },
      {
        scenario: "before-affix-shrink",
        summary: await runBenchmark(mountBeforeAffixShrinkVariant, beforeAffixShrinkWidths),
      },
      {
        scenario: "dynamic-before-grow",
        summary: await runBenchmark(mountDynamicBeforeGrowVariant, dynamicBeforeGrowWidths),
      },
      {
        scenario: "dynamic-before-shrink",
        summary: await runBenchmark(mountDynamicBeforeShrinkVariant, dynamicBeforeShrinkWidths),
      },
      {
        scenario: "static-after-grow",
        summary: await runBenchmark(mountStaticAfterGrowVariant, staticAfterGrowWidths),
      },
      {
        scenario: "static-after-shrink",
        summary: await runBenchmark(mountStaticAfterShrinkVariant, staticAfterShrinkWidths),
      },
      {
        scenario: "static-before-dynamic-after-grow",
        summary: await runBenchmark(
          mountStaticBeforeDynamicAfterGrowVariant,
          staticBeforeDynamicAfterGrowWidths,
        ),
      },
      {
        scenario: "after-affix-shrink",
        summary: await runBenchmark(mountAfterAffixShrinkVariant, afterAffixShrinkWidths),
      },
      {
        scenario: "max-height-grow",
        summary: await runBenchmark(mountMaxHeightGrowVariant, maxHeightGrowWidths),
      },
      {
        scenario: "max-height-shrink",
        summary: await runBenchmark(mountMaxHeightShrinkVariant, maxHeightShrinkWidths),
      },
      {
        scenario: "before-max-height-grow",
        summary: await runBenchmark(mountBeforeMaxHeightGrowVariant, beforeMaxHeightGrowWidths),
      },
      {
        scenario: "before-max-height-shrink",
        summary: await runBenchmark(mountBeforeMaxHeightShrinkVariant, beforeMaxHeightShrinkWidths),
      },
      {
        scenario: "mixed-lines-height-grow",
        summary: await runBenchmark(mountMixedLimitGrowVariant, mixedLimitGrowWidths),
      },
      {
        scenario: "mixed-lines-height-shrink",
        summary: await runBenchmark(mountMixedLimitShrinkVariant, mixedLimitShrinkWidths),
      },
    ];

    console.error(`WRAP_BENCHMARK ${JSON.stringify({ scenarios })}`);

    expect(scenarios).toHaveLength(27);
    for (const scenario of scenarios) {
      expect(scenario.summary.runs).toHaveLength(benchmarkMeasuredRuns);
    }
  });
});
