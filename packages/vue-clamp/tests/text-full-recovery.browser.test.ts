import { afterEach, expect, it } from "vite-plus/test";
import { createApp, h, nextTick, ref } from "vue";
import { InlineClamp } from "../src/index.ts";
import { prepareText, searchTextLayout } from "../src/text.ts";
import type { TextClampResult } from "../src/text.ts";

type Family = "line" | "inline";
type State = { width: number; occupancy: number };
type Fixture = {
  text: () => string;
  update: (state: State) => Promise<string[]>;
  destroy: () => void;
};
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

async function settle() {
  await nextTick();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await nextTick();
}

function measuredWidth(text: string): number {
  const span = document.createElement("span");
  span.style.cssText = "position:absolute;white-space:pre;font:16px/24px monospace";
  span.textContent = text;
  document.body.append(span);
  const width = span.getBoundingClientRect().width;
  span.remove();
  return width;
}

function setup(source: string, availableUnits: number) {
  const style = document.createElement("style");
  style.textContent =
    '.full-recovery-case [data-part="body"]::before { content: ""; display: inline-block; width: var(--occupancy); height: 1px; }';
  document.head.append(style);
  cleanups.push(() => style.remove());
  const unit = measuredWidth("W");
  const width = Math.ceil(measuredWidth(source) + 4 * unit);
  return { unit, initial: { width, occupancy: width - availableUnits * unit } };
}

function rootStyle(family: Family, state: State) {
  return {
    display: "block",
    width: `${state.width}px`,
    font: "16px/24px monospace",
    whiteSpace: family === "inline" ? "nowrap" : "normal",
    overflowWrap: "anywhere",
    "--occupancy": `${state.occupancy}px`,
  };
}

async function mount(
  family: Family,
  source: string,
  marker: string,
  state: State,
): Promise<Fixture> {
  const host = document.createElement("div");
  host.style.width = "5000px";
  document.body.append(host);
  let disposed = false;
  if (family === "line") {
    const root = document.createElement("div");
    root.className = "full-recovery-case";
    const content = document.createElement("span");
    content.dataset.part = "body";
    const target = document.createElement("span");
    content.append(target);
    root.append(content);
    host.append(root);
    const prepared = prepareText(source);
    let hint: TextClampResult | null = null;
    const update = (next: State) => {
      Object.assign(root.style, rootStyle(family, next));
      root.style.setProperty("--occupancy", `${next.occupancy}px`);
      const search = searchTextLayout(
        {
          root,
          content,
          target,
          prepared,
          hint,
          ellipsis: marker,
          lineLimit: 1,
          lineCapacity: 1,
          maxHeight: undefined,
          ratio: 1,
          rootWidth: next.width,
        },
        false,
      );
      const probes: string[] = [];
      let step = search.next();
      while (!step.done) {
        probes.push(target.textContent ?? "");
        step = search.next(step.value());
      }
      hint = step.value;
      return Promise.resolve(probes);
    };
    await update(state);
    const destroy = () => {
      if (disposed) return;
      disposed = true;
      host.remove();
    };
    cleanups.push(destroy);
    return { text: () => target.textContent ?? "", update, destroy };
  }

  const current = ref(state);
  const app = createApp({
    render: () =>
      h(InlineClamp, {
        text: source,
        ellipsis: marker,
        boundary: "grapheme",
        location: 1,
        class: "full-recovery-case",
        style: rootStyle(family, current.value),
      }),
  });
  app.mount(host);
  await settle();
  const root = host.querySelector<HTMLElement>('[data-part="root"]')!;
  const body = host.querySelector<HTMLElement>('[data-part="body"]')!;
  const destroy = () => {
    if (disposed) return;
    disposed = true;
    app.unmount();
    host.remove();
  };
  cleanups.push(destroy);
  return {
    text: () => body.textContent ?? "",
    update: async (next) => {
      const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "scrollWidth")!;
      const probes: string[] = [];
      Object.defineProperty(root, "scrollWidth", {
        configurable: true,
        get() {
          probes.push(body.textContent ?? "");
          return descriptor.get!.call(root);
        },
      });
      try {
        current.value = next;
        await settle();
        return probes;
      } finally {
        Reflect.deleteProperty(root, "scrollWidth");
      }
    },
    destroy,
  };
}

// Independent ASCII candidates and DOM geometry, without production text or fit
// helpers. Full source and the maximal marked candidate receive separate reads.
function enumerate(family: Family, source: string, marker: string, state: State) {
  const root = document.createElement("div");
  root.className = "full-recovery-case";
  Object.assign(root.style, rootStyle(family, state));
  root.style.setProperty("--occupancy", `${state.occupancy}px`);
  const body = document.createElement("span");
  body.dataset.part = "body";
  root.append(body);
  document.body.append(root);
  const fits = (candidate: string) => {
    body.textContent = candidate;
    if (family === "inline") return root.scrollWidth <= state.width + 0.5;
    // The pseudo element can occupy the first row while the entire word moves
    // to the next one. Text-only Range rects would miss that occupied first row.
    return root.getBoundingClientRect().height <= 24.5;
  };
  try {
    const fullFits = fits(source);
    const lastMarkedFits = fits(source.slice(0, -1) + marker);
    for (let kept = source.length - 1; kept >= 0; kept--) {
      const marked = source.slice(0, kept) + marker;
      if (fits(marked)) return { fullFits, lastMarkedFits, marked, kept };
    }
    throw new Error("This fixture must have a fitting marked candidate");
  } finally {
    root.remove();
  }
}

async function expectCold(
  family: Family,
  warm: Fixture,
  source: string,
  marker: string,
  state: State,
) {
  const warmText = warm.text();
  const cold = await mount(family, source, marker, state);
  expect(warmText).toBe(cold.text());
  cold.destroy();
}

for (const family of ["line", "inline"] as const) {
  it(`${family} restores full source when shrinking reveals more marked text despite a failing marked endpoint`, async () => {
    await document.fonts.ready;
    const source = "W".repeat(12);
    const marker = "..";
    const { unit, initial } = setup(source, 11.5);
    const before = enumerate(family, source, marker, initial);
    expect(before.fullFits).toBe(false);
    const warm = await mount(family, source, marker, initial);
    expect(warm.text()).toBe(before.marked);
    const state = { width: 12.5 * unit, occupancy: 0 };
    const oracle = enumerate(family, source, marker, state);
    expect(oracle.fullFits).toBe(true);
    expect(oracle.lastMarkedFits).toBe(false);
    expect(oracle.kept).toBeGreaterThan(before.kept);
    const probes = await warm.update(state);
    expect(probes).toContain(source);
    expect(warm.text()).toBe(source);
    await expectCold(family, warm, source, marker, state);
  });

  it(`${family} restores marked text after a failed full recovery and forgets the stale overflow width`, async () => {
    await document.fonts.ready;
    const source = "W".repeat(20);
    const marker = "[...]";
    const { unit, initial } = setup(source, 10.5);
    const before = enumerate(family, source, marker, initial);
    expect(before.fullFits).toBe(false);
    const warm = await mount(family, source, marker, initial);
    expect(warm.text()).toBe(before.marked);
    const state = { width: 18.5 * unit, occupancy: 0 };
    const oracle = enumerate(family, source, marker, state);
    expect(oracle.fullFits).toBe(false);
    expect(oracle.kept).toBeGreaterThan(before.kept);
    const probes = await warm.update(state);
    expect(probes).toContain(source);
    expect(warm.text()).toBe(oracle.marked);
    await expectCold(family, warm, source, marker, state);

    const grown = { width: 20.5 * unit, occupancy: 0 };
    expect(grown.width).toBeLessThan(initial.width);
    const grownOracle = enumerate(family, source, marker, grown);
    expect(grownOracle.fullFits).toBe(true);
    expect(grownOracle.lastMarkedFits).toBe(false);
    const grownProbes = await warm.update(grown);
    expect(grownProbes).toContain(source);
    expect(warm.text()).toBe(source);
    await expectCold(family, warm, source, marker, grown);
  });

  it(`${family} checks full source at the maximal marked endpoint even when kept count stays unchanged`, async () => {
    await document.fonts.ready;
    const source = "W".repeat(12);
    const marker = "";
    const { unit, initial } = setup(source, 11.5);
    const before = enumerate(family, source, marker, initial);
    expect(before.fullFits).toBe(false);
    expect(before.kept).toBe(source.length - 1);
    const warm = await mount(family, source, marker, initial);
    expect(warm.text()).toBe(before.marked);
    const state = { width: 12.5 * unit, occupancy: 0 };
    const oracle = enumerate(family, source, marker, state);
    expect(oracle.fullFits).toBe(true);
    expect(oracle.lastMarkedFits).toBe(true);
    expect(oracle.kept).toBe(before.kept);
    const probes = await warm.update(state);
    expect(probes).toContain(source);
    expect(warm.text()).toBe(source);
    await expectCold(family, warm, source, marker, state);
  });
}
