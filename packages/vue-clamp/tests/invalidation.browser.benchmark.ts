import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { LineClamp } from "../src/index.ts";

import type { App } from "vue";

type InvalidationMetrics = {
  boundingRectReads: number;
  fontListenersAdded: number;
  fontListenersRemoved: number;
  resizeObserverCallbacks: number;
  resizeObserverInstances: number;
};

type InvalidationRun = InvalidationMetrics & {
  fontEventMs: number;
  mountMs: number;
  noopUpdatesMs: number;
  resizeMs: number;
  unmountMs: number;
};

type InvalidationMode = "active" | "expanded";

const instanceCount = 400;
const measuredRuns = 5;
const noopUpdateCount = 12;
const originalResizeObserver = globalThis.ResizeObserver;
// oxlint-disable-next-line typescript-eslint/unbound-method -- invoked with each measured element
const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
const fontFaceSet = document.fonts;
const fontFaceSetPrototype = Object.getPrototypeOf(fontFaceSet) as EventTarget;
// oxlint-disable-next-line typescript-eslint/unbound-method -- restored with its prototype receiver
const originalFontAddEventListener = fontFaceSetPrototype.addEventListener;
// oxlint-disable-next-line typescript-eslint/unbound-method -- restored with its prototype receiver
const originalFontRemoveEventListener = fontFaceSetPrototype.removeEventListener;
let activeMetrics: InvalidationMetrics | null = null;

function emptyMetrics(): InvalidationMetrics {
  return {
    boundingRectReads: 0,
    fontListenersAdded: 0,
    fontListenersRemoved: 0,
    resizeObserverCallbacks: 0,
    resizeObserverInstances: 0,
  };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

async function settle(): Promise<void> {
  await nextTick();
  await nextTick();
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

function renderClampRows(tick: number, mode: InvalidationMode): ReturnType<typeof h>[] {
  return Array.from({ length: instanceCount }, (_, index) =>
    h(LineClamp, {
      "data-tick": tick,
      expanded: mode === "expanded",
      key: index,
      maxLines: 2,
      style: "display:block;width:100%",
      text: `Row ${index + 1} carries enough release dashboard context to overflow when clamping is active.`,
    }),
  );
}

async function runInvalidationScenario(mode: InvalidationMode): Promise<InvalidationRun> {
  const metrics = emptyMetrics();
  activeMetrics = metrics;
  const container = document.createElement("div");
  document.body.append(container);
  const tick = ref(0);
  const width = ref(720);
  const Host = defineComponent({
    setup() {
      return () =>
        h(
          "div",
          {
            style: `font:16px/20px Arial,sans-serif;width:${width.value}px`,
          },
          renderClampRows(tick.value, mode),
        );
    },
  });
  const app: App = createApp(Host);

  const mountStart = performance.now();
  app.mount(container);
  await settle();
  const mountMs = performance.now() - mountStart;

  const updateStart = performance.now();
  for (let index = 0; index < noopUpdateCount; index += 1) {
    tick.value += 1;
    await nextTick();
  }
  await settle();
  const noopUpdatesMs = performance.now() - updateStart;

  const resizeStart = performance.now();
  width.value = 480;
  await settle();
  const resizeMs = performance.now() - resizeStart;

  const fontStart = performance.now();
  fontFaceSet.dispatchEvent(new Event("loadingdone"));
  await settle();
  const fontEventMs = performance.now() - fontStart;

  const unmountStart = performance.now();
  app.unmount();
  container.remove();
  await nextTick();
  const unmountMs = performance.now() - unmountStart;
  activeMetrics = null;

  return {
    ...metrics,
    fontEventMs,
    mountMs,
    noopUpdatesMs,
    resizeMs,
    unmountMs,
  };
}

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function patchedGetBoundingClientRect(): DOMRect {
    if (activeMetrics) {
      activeMetrics.boundingRectReads += 1;
    }
    return originalGetBoundingClientRect.call(this);
  };

  globalThis.ResizeObserver = new Proxy(originalResizeObserver, {
    construct(Target, [callback]: ConstructorParameters<typeof ResizeObserver>) {
      if (activeMetrics) {
        activeMetrics.resizeObserverInstances += 1;
      }

      return new Target((entries, observer) => {
        if (activeMetrics) {
          activeMetrics.resizeObserverCallbacks += 1;
        }
        callback(entries, observer);
      });
    },
  });

  fontFaceSetPrototype.addEventListener = function patchedAddEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    if (type === "loadingdone" && activeMetrics) {
      activeMetrics.fontListenersAdded += 1;
    }
    originalFontAddEventListener.call(this, type, callback, options);
  };

  fontFaceSetPrototype.removeEventListener = function patchedRemoveEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: EventListenerOptions | boolean,
  ): void {
    if (type === "loadingdone" && activeMetrics) {
      activeMetrics.fontListenersRemoved += 1;
    }
    originalFontRemoveEventListener.call(this, type, callback, options);
  };
});

afterEach(() => {
  activeMetrics = null;
  document.body.innerHTML = "";
});

afterAll(() => {
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  globalThis.ResizeObserver = originalResizeObserver;
  fontFaceSetPrototype.addEventListener = originalFontAddEventListener;
  fontFaceSetPrototype.removeEventListener = originalFontRemoveEventListener;
});

describe("Invalidation density benchmark", () => {
  it("reports active and expanded observer and listener overhead", async () => {
    const scenarios = [];

    for (const mode of ["active", "expanded"] as const) {
      const runs: InvalidationRun[] = [];

      for (let runIndex = 0; runIndex < measuredRuns + 1; runIndex += 1) {
        const run = await runInvalidationScenario(mode);
        if (runIndex > 0) {
          runs.push(run);
        }
      }

      scenarios.push({
        mode,
        summary: {
          boundingRectReads: median(runs.map((run) => run.boundingRectReads)),
          fontEventMs: median(runs.map((run) => run.fontEventMs)),
          fontListenersAdded: median(runs.map((run) => run.fontListenersAdded)),
          fontListenersRemoved: median(runs.map((run) => run.fontListenersRemoved)),
          mountMs: median(runs.map((run) => run.mountMs)),
          noopUpdatesMs: median(runs.map((run) => run.noopUpdatesMs)),
          resizeMs: median(runs.map((run) => run.resizeMs)),
          resizeObserverCallbacks: median(runs.map((run) => run.resizeObserverCallbacks)),
          resizeObserverInstances: median(runs.map((run) => run.resizeObserverInstances)),
          runs,
          unmountMs: median(runs.map((run) => run.unmountMs)),
        },
      });

      expect(runs).toHaveLength(measuredRuns);
    }

    console.error(`INVALIDATION_BENCHMARK ${JSON.stringify({ scenarios })}`);
  });
});
