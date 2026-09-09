import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { LineClamp, RichLineClamp, WrapClamp } from "../src/index.ts";
import { frame } from "./browser.ts";

import type { Component } from "vue";

type Metrics = {
  rects: number;
  rectLists: number;
  styles: number;
  parses: number;
  itemSlots: number;
  affixSlots: number;
};
type PhaseResult = Metrics & { settledMs: number };
type Scenario = {
  family: "line" | "rich" | "wrap";
  measured: boolean;
  affixed: boolean;
  unique: boolean;
};

const instances = 48;
const updates = 6;
const source = "Customer impact, ownership and regional response remain visible across updates. ";
let metrics: Metrics | null = null;

function emptyMetrics(): Metrics {
  return { rects: 0, rectLists: 0, styles: 0, parses: 0, itemSlots: 0, affixSlots: 0 };
}

async function settle(): Promise<void> {
  await nextTick();
  await frame();
  await frame();
  await nextTick();
}

async function phase(action: () => Promise<void>): Promise<PhaseResult> {
  metrics = emptyMetrics();
  const start = performance.now();
  await action();
  // Includes deliberate frame waits; use work counters to compare these phases.
  const result = { ...metrics, settledMs: performance.now() - start };
  metrics = null;
  return result;
}

async function runScenario({ family, measured, affixed, unique }: Scenario) {
  const container = document.createElement("div");
  document.body.append(container);
  const tick = ref(0);
  const revision = ref(0);
  const slotRevision = ref(0);
  const items = Array.from({ length: 40 }, (_, index) => `${index}`);
  const component = { line: LineClamp, rich: RichLineClamp, wrap: WrapClamp }[family] as Component;
  const Host = defineComponent({
    setup() {
      return () =>
        h(
          "div",
          Array.from({ length: instances }, (_, index) =>
            h(
              component,
              {
                "data-tick": tick.value,
                key: index,
                maxLines: 2,
                boundary: measured ? "word" : "grapheme",
                style: "font:16px/20px Arial;width:240px",
                ...(family === "wrap"
                  ? { items }
                  : family === "rich"
                    ? {
                        html: `<strong>${source}</strong><em>${source}${revision.value}${unique ? index : ""}</em>`,
                      }
                    : { text: source.repeat(2) + revision.value }),
              },
              {
                ...(family === "wrap"
                  ? {
                      item: ({ item, index: itemIndex }: { item: string; index: number }) => {
                        if (metrics) metrics.itemSlots += 1;
                        return h(
                          "span",
                          {
                            style: `display:inline-block;width:${40 + ((slotRevision.value + itemIndex) % 2) * 12}px;height:20px`,
                          },
                          item + revision.value,
                        );
                      },
                    }
                  : {}),
                ...(affixed
                  ? {
                      after: ({
                        clamped,
                        hiddenItems,
                      }: {
                        clamped: boolean;
                        hiddenItems?: readonly string[];
                      }) => {
                        if (metrics) metrics.affixSlots += 1;
                        return h(
                          "span",
                          { style: "display:inline-block;width:36px;height:20px" },
                          `${clamped ? (hiddenItems?.length ?? "+") : ""}${slotRevision.value}`,
                        );
                      },
                    }
                  : {}),
              },
            ),
          ),
        );
    },
  });
  const app = createApp(Host);
  try {
    const mount = await phase(async () => {
      app.mount(container);
      await settle();
    });
    const noop = await phase(async () => {
      for (let index = 0; index < updates; index += 1) {
        tick.value += 1;
        await settle();
      }
    });
    const content = await phase(async () => {
      for (let index = 0; index < updates; index += 1) {
        revision.value += 1;
        await settle();
      }
    });
    const slots = await phase(async () => {
      for (let index = 0; index < updates; index += 1) {
        slotRevision.value += 1;
        await settle();
      }
    });
    expect(container.querySelectorAll('[data-part="root"]')).toHaveLength(instances);
    return { mount, noop, content, slots };
  } finally {
    metrics = null;
    app.unmount();
    container.remove();
  }
}

beforeAll(() => {
  // oxlint-disable-next-line typescript-eslint/unbound-method -- called with the original receiver
  const rect = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (metrics) metrics.rects += 1;
    return rect.call(this);
  });
  // oxlint-disable-next-line typescript-eslint/unbound-method -- called with the original receiver
  const range = Range.prototype.getClientRects;
  vi.spyOn(Range.prototype, "getClientRects").mockImplementation(function (this: Range) {
    if (metrics) metrics.rectLists += 1;
    return range.call(this);
  });
  // oxlint-disable-next-line typescript-eslint/unbound-method -- called with the original receiver
  const rectList = Element.prototype.getClientRects;
  vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function (this: Element) {
    if (metrics) metrics.rectLists += 1;
    return rectList.call(this);
  });
  const style = globalThis.getComputedStyle;
  vi.spyOn(globalThis, "getComputedStyle").mockImplementation((...args) => {
    if (metrics) metrics.styles += 1;
    return style(...args);
  });
  // oxlint-disable-next-line typescript-eslint/unbound-method -- called with the original receiver
  const parse = DOMParser.prototype.parseFromString;
  vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(function (
    this: DOMParser,
    ...args
  ) {
    if (metrics) metrics.parses += 1;
    return parse.apply(this, args);
  });
});

afterAll(() => vi.restoreAllMocks());

describe("Active update work", () => {
  it("separates cold mount, unrelated attributes, source updates and captured slot updates", async () => {
    const results = [];
    for (const family of ["line", "rich", "wrap"] as const) {
      for (const affixed of [false, true]) {
        for (const measured of family === "wrap" || affixed ? [true] : [false, true]) {
          for (const unique of family === "rich" && measured ? [false, true] : [false]) {
            const scenario = { family, measured, affixed, unique };
            results.push({ ...scenario, ...(await runScenario(scenario)) });
          }
        }
      }
    }
    console.error(`UPDATE_WORK_RESULT ${JSON.stringify({ instances, updates, results })}`);
  });
});
