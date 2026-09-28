import { afterEach, describe, expect, it } from "vite-plus/test";
import { createApp, h, nextTick, ref } from "vue";
import { InlineClamp, LineClamp } from "../src/index.ts";
import { displayTextForKeptCount, prepareText } from "../src/text.ts";
import type { Component } from "vue";

type Family = "line" | "height" | "inline";
type State = { width: number; text: string; ellipsis: string; ratio: number; fontSize: number };
const splitBody = (body: string) => ({ start: "[", body, end: "]" });
const initial: State = {
  width: 210,
  text: "Pneumonoultramicroscopicsilicovolcanoconiosis".repeat(6),
  ellipsis: "…",
  ratio: 0.5,
  fontSize: 16,
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
function mount(family: Family, state: State, split = false) {
  const current = ref({ ...state });
  const container = document.createElement("div");
  container.style.width = "5000px";
  document.body.append(container);
  const app = createApp({
    setup: () => () =>
      h((family === "inline" ? InlineClamp : LineClamp) as Component, {
        text: current.value.text,
        boundary: "word",
        location: current.value.ratio,
        ellipsis: current.value.ellipsis,
        ...(family === "line" ? { maxLines: 2 } : family === "height" ? { maxHeight: 48 } : {}),
        ...(split ? { split: splitBody } : {}),
        style: {
          display: "block",
          width: `${current.value.width}px`,
          fontFamily: "monospace",
          fontSize: `${current.value.fontSize}px`,
          lineHeight: "24px",
          // A real ASCII word needs explicit wrapping to exercise Line fallback.
          overflowWrap: "anywhere",
        },
      }),
  });
  app.mount(container);
  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    app.unmount();
    container.remove();
  };
  cleanups.push(destroy);
  return {
    current,
    destroy,
    root: () => container.querySelector<HTMLElement>('[data-part="root"]')!,
    text: () => {
      const body = container.querySelector<HTMLElement>('[data-part="body"]')!;
      return (family === "inline" ? body : body.lastElementChild)!.textContent!;
    },
  };
}
async function expectCold(family: Family, warm: ReturnType<typeof mount>, split = false) {
  expect(warm.root().getBoundingClientRect().width).toBe(warm.current.value.width);
  const warmText = warm.text();
  const warmHtml = warm.root().innerHTML;
  const cold = mount(family, warm.current.value, split);
  await settle();
  expect(warmText).toBe(cold.text());
  // Capture before mounting cold so another delivery cannot repair the result.
  // The hidden accessible source and split affixes must settle identically too.
  expect(warmHtml).toBe(cold.root().innerHTML);
  cold.destroy();
}

// Independent ASCII enumeration: no production search, text generation or fit
// helpers. The single-word source has no positive marked word candidate, so its
// non-full answer must be the largest fitting character cut.
function enumerateAscii(family: Family, state: State): string {
  const root = document.createElement("div");
  const text = document.createElement("span");
  root.style.cssText = `display:block;width:${state.width}px;font:${state.fontSize}px/24px monospace;overflow-wrap:anywhere;white-space:${family === "inline" ? "nowrap" : "normal"}`;
  root.append(text);
  document.body.append(root);
  const range = document.createRange();
  const fits = (candidate: string) => {
    text.textContent = candidate;
    range.selectNodeContents(text);
    const rects = [...range.getClientRects()];
    if (family === "inline") return root.scrollWidth <= state.width + 0.5;
    const tops: number[] = [];
    for (const rect of rects)
      if (!tops.some((top) => Math.abs(top - rect.top) < 0.5)) tops.push(rect.top);
    if (family === "line") return tops.length <= 2;
    return (
      (rects.at(-1)?.bottom ?? root.getBoundingClientRect().top) -
        root.getBoundingClientRect().top <=
      48.5
    );
  };
  try {
    if (fits(state.text)) return state.text;
    for (let kept = state.text.length - 1; kept >= 0; kept--) {
      const prefix = Math.floor(kept * state.ratio);
      const suffix = kept - prefix;
      const candidate =
        state.text.slice(0, prefix) + state.ellipsis + (suffix ? state.text.slice(-suffix) : "");
      if (fits(candidate)) return candidate;
    }
    return state.ellipsis;
  } finally {
    range.detach();
    root.remove();
  }
}

for (const family of ["line", "height", "inline"] as const) {
  describe(`${family} real word fallback`, () => {
    it("matches fresh cold output across shrink, growth and full-fit transitions", async () => {
      await document.fonts.ready;
      expect(prepareText(initial.text, "word").boundaryOffsets).toHaveLength(2);
      const warm = mount(family, initial);
      await settle();
      expect(warm.text()).not.toBe(initial.text);
      expect(warm.text().length - initial.ellipsis.length).toBeGreaterThan(1);
      for (const width of [110, 180, 290, 140, 4000, 120]) {
        warm.current.value.width = width;
        await settle();
        await expectCold(family, warm);
        expect(warm.text()).toBe(enumerateAscii(family, warm.current.value));
        if (width === 4000) expect(warm.text()).toBe(initial.text);
        else expect(warm.text()).not.toBe(initial.text);
      }
    });

    it("returns to whole-word cuts when a wider layout can fit them", async () => {
      await document.fonts.ready;
      const state = {
        ...initial,
        width: 120,
        text: "W".repeat(64) + " " + "M".repeat(64) + " " + "W".repeat(64),
      };
      const prepared = prepareText(state.text, "word");
      const wordCandidates = Array.from({ length: prepared.boundaryOffsets.length - 2 }, (_, i) =>
        displayTextForKeptCount(
          prepared,
          state.ratio,
          state.ellipsis,
          i + 1,
          family === "inline" ? "preserve-outer" : "trim",
        ),
      );
      const warm = mount(family, state);
      await settle();
      expect(warm.text()).not.toBe(state.text);
      expect(wordCandidates).not.toContain(warm.text());
      for (const width of [72, 105, 150, 900, 100, 4000]) {
        warm.current.value.width = width;
        await settle();
        await expectCold(family, warm);
        if (width === 900) {
          expect(warm.text()).not.toBe(state.text);
          expect(wordCandidates).toContain(warm.text());
        }
        if (width === 4000) expect(warm.text()).toBe(state.text);
      }
    });

    it("recomputes fallback after source, ratio, marker and CSS font changes", async () => {
      await document.fonts.ready;
      const warm = mount(family, initial);
      await settle();
      expect(warm.text()).not.toBe(initial.text);
      const changes: Array<Partial<State>> = [
        { width: 120 },
        { text: "W".repeat(91), width: 180 },
        { ratio: 0.25, width: 150 },
        { ellipsis: "[complete]", width: 170 },
        { fontSize: 8, width: 160 },
        { text: "WideWord".repeat(8), fontSize: 32, width: 190 },
        { fontSize: 8, width: 600 },
      ];
      for (const change of changes) {
        Object.assign(warm.current.value, change);
        await settle();
        await expectCold(family, warm);
        expect(warm.text()).toBe(enumerateAscii(family, warm.current.value));
      }
      expect(warm.text()).toBe(warm.current.value.text);
    });
  });
}

it("preserves stable Inline split affixes across fallback resizes", async () => {
  await document.fonts.ready;
  const warm = mount("inline", initial, true);
  await settle();
  expect(warm.text()).not.toBe(initial.text);
  for (const change of [
    { width: 90 },
    { width: 180 },
    { width: 350 },
    { ratio: 0.25, width: 170 },
    { fontSize: 8, width: 140 },
    { width: 4000 },
  ]) {
    Object.assign(warm.current.value, change);
    await settle();
    await expectCold("inline", warm, true);
    expect(warm.root().querySelector('[data-part="start"]')?.textContent).toBe("[");
    expect(warm.root().querySelector('[data-part="end"]')?.textContent).toBe("]");
  }
  expect(warm.text()).toBe(initial.text);
});

for (const singleWord of [false, true]) {
  it(`rechecks current ${singleWord ? "full text" : "positive word candidates"} when pseudo-element occupancy changes after fallback`, async () => {
    await document.fonts.ready;
    const text = singleWord
      ? "W".repeat(30)
      : "W".repeat(12) + " " + "M".repeat(30) + " " + "W".repeat(30);
    const width = ref(320);
    const occupancy = ref(200);
    const firstWord = text.split(" ")[0]!;
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;white-space:pre;font:16px/24px monospace";
    document.body.append(probe);
    try {
      probe.textContent = text;
      expect(probe.getBoundingClientRect().width + occupancy.value).toBeGreaterThan(
        width.value + 0.5,
      );
      probe.textContent = `${firstWord}…`;
      expect(probe.getBoundingClientRect().width + occupancy.value).toBeGreaterThan(
        width.value + 0.5,
      );
    } finally {
      probe.remove();
    }
    const stylesheet = document.createElement("style");
    stylesheet.textContent =
      '.fallback-pseudo [data-part="body"]::before { content: ""; display: inline-block; width: var(--occupancy); height: 1px; }';
    document.head.append(stylesheet);
    cleanups.push(() => stylesheet.remove());
    const render = () =>
      h(InlineClamp, {
        text,
        boundary: "word",
        location: 1,
        class: "fallback-pseudo",
        style: {
          display: "block",
          width: `${width.value}px`,
          font: "16px/24px monospace",
          "--occupancy": `${occupancy.value}px`,
        },
      });
    function mountPseudo() {
      const container = document.createElement("div");
      document.body.append(container);
      const app = createApp({ render });
      app.mount(container);
      cleanups.push(() => {
        app.unmount();
        container.remove();
      });
      return () => container.querySelector('[data-part="body"]')!.textContent;
    }
    const warm = mountPseudo();
    await settle();
    const initialText = warm()!;
    expect(initialText.endsWith("…")).toBe(true);
    const prefix = initialText.slice(0, -1);
    expect(prefix.length).toBeGreaterThan(0);
    expect(prefix.length).toBeLessThan(firstWord.length);
    expect(prefix).toBe(firstWord.slice(0, prefix.length));
    occupancy.value = 0;
    width.value = 300;
    await settle();
    const warmText = warm();
    const cold = mountPseudo();
    await settle();
    expect(warmText).toBe(cold());
    // Independent expected result: 30 monospace letters fit 300px. With several
    // words only the first 12-letter word fits, so keeping part of the next word
    // would violate boundary="word" even though that grapheme cut fits.
    expect(warmText).toBe(singleWord ? text : "W".repeat(12) + "…");
  });
}

it("drops fallback overflow history after returning to word cuts before growing to full text", async () => {
  await document.fonts.ready;
  const firstWord = "W".repeat(12);
  const text = firstWord + " " + "M".repeat(19);
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;white-space:pre;font:16px/24px monospace";
  document.body.append(probe);
  const measure = (candidate: string) => {
    probe.textContent = candidate;
    return probe.getBoundingClientRect().width;
  };
  let fullWidth: number;
  let wordWidth: number;
  let markerWidth: number;
  try {
    fullWidth = measure(text);
    wordWidth = measure(`${firstWord}…`);
    markerWidth = measure("…");
  } finally {
    probe.remove();
  }
  // Derive all three widths from the browser's font. The first layout forces
  // fallback, the second fits a word but not full text, and the final width fits
  // full text while remaining below the old fallback overflow observation.
  const initialWidth = Math.ceil(fullWidth) + 20;
  const wordOnlyWidth = Math.floor(fullWidth) - 8;
  const fullFitWidth = Math.ceil(fullWidth) + 8;
  expect(wordWidth).toBeLessThan(wordOnlyWidth - 0.5);
  const width = ref(initialWidth);
  const occupancy = ref(initialWidth - wordWidth + markerWidth * 2);
  const stylesheet = document.createElement("style");
  stylesheet.textContent =
    '.fallback-domain-pseudo [data-part="body"]::before { content: ""; display: inline-block; width: var(--occupancy); height: 1px; }';
  document.head.append(stylesheet);
  cleanups.push(() => stylesheet.remove());
  function mountPseudo() {
    const container = document.createElement("div");
    container.style.width = "5000px";
    document.body.append(container);
    const app = createApp({
      render: () =>
        h(InlineClamp, {
          text,
          boundary: "word",
          location: 1,
          class: "fallback-domain-pseudo",
          style: {
            display: "block",
            width: `${width.value}px`,
            font: "16px/24px monospace",
            "--occupancy": `${occupancy.value}px`,
          },
        }),
    });
    app.mount(container);
    cleanups.push(() => {
      app.unmount();
      container.remove();
    });
    return () => container.querySelector('[data-part="body"]')!.textContent!;
  }
  const warm = mountPseudo();
  await settle();
  const fallback = warm();
  expect(fallback.endsWith("…")).toBe(true);
  expect(fallback.length - 1).toBeGreaterThan(0);
  expect(fallback.length - 1).toBeLessThan(firstWord.length);
  expect(fallback.slice(0, -1)).toBe(firstWord.slice(0, fallback.length - 1));

  occupancy.value = 0;
  width.value = wordOnlyWidth;
  await settle();
  expect(warm()).toBe(`${firstWord}…`);

  width.value = fullFitWidth;
  await settle();
  const warmText = warm();
  const cold = mountPseudo();
  await settle();
  expect(cold()).toBe(text);
  expect(warmText).toBe(cold());
});
