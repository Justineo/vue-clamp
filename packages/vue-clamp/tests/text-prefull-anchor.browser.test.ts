import { afterEach, expect, it } from "vite-plus/test";
import { createApp, h, nextTick, ref } from "vue";
import { InlineClamp } from "../src/index.ts";
import { fitsContent } from "../src/layout.ts";
import { displayTextForKeptCount, prepareText, searchTextLayout } from "../src/text.ts";
import type { TextClampLayoutInput, TextClampResult } from "../src/text.ts";

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

function host(width: number) {
  const root = document.createElement("div");
  root.style.cssText = `display:block;width:${width}px;font:16px monospace;line-height:24px;white-space:normal;overflow-wrap:anywhere`;
  const content = document.createElement("span");
  const target = document.createElement("span");
  content.append(target);
  root.append(content);
  document.body.append(root);
  cleanups.push(() => root.remove());
  return { root, content, target };
}

function solve(input: TextClampLayoutInput) {
  const search = searchTextLayout(input, false);
  const probes: string[] = [];
  let step = search.next();
  while (!step.done) {
    probes.push(input.target.textContent ?? "");
    step = search.next(step.value());
  }
  expect(step.value).not.toBeNull();
  return { probes, result: step.value as TextClampResult };
}

it("reads the displayed Line candidate before full source and does not measure it twice", async () => {
  await document.fonts.ready;
  const elements = host(160);
  const prepared = prepareText("MW".repeat(100));
  const input: TextClampLayoutInput = {
    ...elements,
    prepared,
    ellipsis: "…",
    lineCapacity: 2,
    lineLimit: 2,
    maxHeight: undefined,
    ratio: 1,
    rootWidth: 160,
  };
  const previous = solve(input).result;
  expect(previous.text).not.toBe(prepared.text);
  elements.root.style.width = "160.25px";
  const next = solve({ ...input, hint: previous, rootWidth: 160.25 });
  expect(next.probes.slice(0, 2)).toEqual([previous.text, prepared.text]);
  expect(next.probes.filter((text) => text === previous.text)).toHaveLength(1);
  expect(fitsContent(elements.root, elements.content, 2, undefined, true)).toBe(true);
  elements.target.textContent = displayTextForKeptCount(prepared, 1, "…", next.result.kept + 1);
  expect(fitsContent(elements.root, elements.content, 2, undefined, true)).toBe(false);
});

it("checks bare full text after a rejected anchor and refreshes its moved height bounds", async () => {
  await document.fonts.ready;
  const elements = host(20);
  elements.root.style.maxHeight = "24px";
  const prepared = prepareText("abc");
  const input: TextClampLayoutInput = {
    ...elements,
    prepared,
    ellipsis: "[read complete details]",
    lineCapacity: 1,
    lineLimit: undefined,
    maxHeight: 24,
    ratio: 1,
    rootWidth: 20,
  };
  const previous = solve(input).result;
  expect(previous.text).not.toBe(prepared.text);
  elements.root.style.width = "40px";
  const search = searchTextLayout({ ...input, hint: previous, rootWidth: 40 }, false);
  const anchor = search.next();
  expect(anchor.done).toBe(false);
  if (anchor.done) throw new Error("Expected current-candidate measurement");
  expect(elements.target.textContent).toBe(previous.text);
  expect(anchor.value()).toBe(false);
  const full = search.next(false);
  expect(full.done).toBe(false);
  if (full.done) throw new Error("Expected full-source measurement");
  expect(elements.target.textContent).toBe(prepared.text);
  elements.root.style.marginTop = "180px";
  const fits = full.value();
  expect(fits).toBe(true);
  const result = search.next(fits);
  expect(result.done).toBe(true);
  expect(result.value).toMatchObject({ text: prepared.text });
});

it("takes the same pre-full observation through an Inline component resize", async () => {
  await document.fonts.ready;
  const text = "MW".repeat(100);
  const width = ref(160);
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp({
    setup: () => () =>
      h(InlineClamp, {
        text,
        location: "middle",
        style: { display: "block", width: `${width.value}px`, font: "16px/24px monospace" },
      }),
  });
  app.mount(container);
  cleanups.push(() => {
    app.unmount();
    container.remove();
  });
  async function settle() {
    await nextTick();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await nextTick();
  }
  await settle();
  const root = container.querySelector<HTMLElement>('[data-part="root"]')!;
  const body = root.querySelector<HTMLElement>('[data-part="body"]')!;
  const previous = body.textContent;
  expect(previous).not.toBe(text);
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
    width.value = 160.25;
    await settle();
  } finally {
    Reflect.deleteProperty(root, "scrollWidth");
  }
  expect(probes.slice(0, 2)).toEqual([previous, text]);
  expect(body.textContent).toBe(previous);
});
