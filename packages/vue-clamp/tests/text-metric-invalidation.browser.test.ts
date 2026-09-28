import { afterEach, expect, it } from "vite-plus/test";
import { createApp, h, nextTick, ref } from "vue";
import { InlineClamp, LineClamp } from "../src/index.ts";
import type { Component } from "vue";

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
async function settle() {
  await nextTick();
  await frame();
  await frame();
  await nextTick();
}
function measureText(text: string, fontSize: number) {
  const probe = document.createElement("span");
  probe.style.cssText = `position:absolute;white-space:pre;font:${fontSize}px monospace`;
  probe.textContent = text;
  document.body.append(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}
function visibleText(container: HTMLElement, inline: boolean) {
  const body = container.querySelector<HTMLElement>('[data-part="body"]')!;
  const text = inline
    ? body
    : (body.querySelector<HTMLElement>('[aria-hidden="true"]') ?? body.lastElementChild)!;
  return text.textContent;
}
function mount(render: () => ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp({ render });
  app.mount(container);
  cleanups.push(() => {
    app.unmount();
    container.remove();
  });
  return container;
}

for (const mode of ["line", "height", "inline"] as const) {
  it(`${mode} restores a full fit when CSS metrics and width shrink together`, async () => {
    await document.fonts.ready;
    const source = "alpha beta gamma delta epsilon zeta";
    const ellipsis = " [read details]";
    const fullWidth = measureText(source, 12);
    const markedWidth = measureText(`alpha beta gamma delta epsilon${ellipsis}`, 12);
    expect(markedWidth).toBeGreaterThan(fullWidth);
    const nextWidth = (fullWidth + markedWidth) / 2;
    const width = ref(nextWidth + 24);
    const fontSize = ref(24);
    const render = () =>
      h((mode === "inline" ? InlineClamp : LineClamp) as Component, {
        text: source,
        boundary: "word",
        ellipsis,
        ...(mode === "line" ? { maxLines: 1 } : mode === "height" ? { maxHeight: 28 } : {}),
        style: {
          display: "block",
          width: `${width.value}px`,
          fontFamily: "monospace",
          fontSize: `${fontSize.value}px`,
          lineHeight: "28px",
          overflowWrap: "anywhere",
        },
      });
    const container = mount(render);
    await settle();
    expect(visibleText(container, mode === "inline")).not.toBe(source);

    fontSize.value = 12;
    width.value = nextWidth;
    await nextTick();
    expect(visibleText(container, mode === "inline")).toBe(source);
    await settle();
    expect(visibleText(container, mode === "inline")).toBe(source);

    const fresh = mount(render);
    await settle();
    expect(visibleText(container, mode === "inline")).toBe(visibleText(fresh, mode === "inline"));
  });
}

it("restores an Inline full fit when stable split affixes shrink independently", async () => {
  await document.fonts.ready;
  const source = "alpha beta gamma delta epsilon zeta";
  const ellipsis = " [read details]";
  const start = "prefix-prefix-";
  const end = "-suffix-suffix";
  const fullWidth = measureText(source, 24) + measureText(start + end, 12);
  const markedWidth =
    measureText(`alpha beta gamma delta epsilon${ellipsis}`, 24) + measureText(start + end, 12);
  expect(markedWidth).toBeGreaterThan(fullWidth);
  const nextWidth = (fullWidth + markedWidth) / 2;
  const width = ref(nextWidth + 24);
  const affixFontSize = ref(24);
  const split = (text: string) => ({ start, body: text, end });
  const render = () =>
    h("section", { class: "metric-affix-fixture" }, [
      h(
        "style",
        {},
        `.metric-affix-fixture [data-part="start"], .metric-affix-fixture [data-part="end"] { font-size: ${affixFontSize.value}px; }`,
      ),
      h(InlineClamp, {
        text: source,
        ellipsis,
        boundary: "word",
        split,
        style: {
          display: "block",
          width: `${width.value}px`,
          font: "24px/28px monospace",
        },
      }),
    ]);
  const container = mount(render);
  await settle();
  expect(visibleText(container, true)).not.toBe(source);

  affixFontSize.value = 12;
  width.value = nextWidth;
  await nextTick();
  expect(visibleText(container, true)).toBe(source);
  await settle();
  expect(visibleText(container, true)).toBe(source);

  const fresh = mount(render);
  await settle();
  expect(visibleText(container, true)).toBe(visibleText(fresh, true));
});
