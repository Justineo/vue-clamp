import { afterEach, expect, it, vi } from "vite-plus/test";
import { nextTick } from "vue";
import { LineClamp } from "../src/index.ts";
import { cleanupMounted, mountClamp, rootElement, settle, textElement } from "./browser.ts";

afterEach(() => {
  vi.restoreAllMocks();
  cleanupMounted();
});

it("does not restore and dirty a fitting marked prefix again during font invalidation", async () => {
  await document.fonts.ready;
  const family = "LineSemanticAnchorFixture";
  const text = "iiiiiiii ".repeat(6).trimEnd();
  const mounted = mountClamp({
    component: LineClamp,
    text,
    width: 220,
    font: `24px ${family}, monospace`,
    lineHeight: "22px",
    props: { maxLines: 3, boundary: "word", ellipsis: "iiii" },
  });
  await settle(4);
  const root = rootElement(mounted.container);
  const target = textElement(root);
  const previous = target.textContent;
  expect(previous).not.toBe(text);
  const node = target.firstChild!;
  const changes: MutationRecord[] = [];
  const observer = new MutationObserver((records) => changes.push(...records));
  observer.observe(node, { characterData: true, characterDataOldValue: true });
  const content = root.querySelector<HTMLElement>('[data-part="content"]')!;
  const bounds = content.getBoundingClientRect.bind(content);
  const rects = content.getClientRects.bind(content);
  const fitInputs: string[] = [];
  vi.spyOn(content, "getBoundingClientRect").mockImplementation(() => {
    fitInputs.push(target.textContent ?? "");
    return bounds();
  });
  vi.spyOn(content, "getClientRects").mockImplementation(() => {
    fitInputs.push(target.textContent ?? "");
    return rects();
  });
  const face = new FontFace(
    family,
    `url(${new URL("./fixtures/narrow.ttf", import.meta.url).href})`,
  );
  try {
    document.fonts.dispatchEvent(new Event("loadingdone"));
    await settle(4);
    changes.push(...observer.takeRecords());
    expect(target.textContent).toBe(previous);
    expect(fitInputs).toContain(text);
    // Leaving the known fitting prefix once is necessary to inspect full text.
    // Restoring it and leaving it again would add a redundant dirty layout.
    expect(changes.filter((record) => record.oldValue === previous)).toHaveLength(1);
    observer.disconnect();

    fitInputs.length = 0;
    document.fonts.add(face);
    await document.fonts.load(`24px ${family}`, "iiiiiiii");
    await document.fonts.ready;
    root.style.width = "218px";
    await nextTick();
    // Explicit delivery also exercises WebKit, whose native completion is absent.
    document.fonts.dispatchEvent(new Event("loadingdone"));
    await settle(4);
    expect(target.textContent).toBe(text);
    expect(fitInputs).toContain(text);
  } finally {
    observer.disconnect();
    document.fonts.delete(face);
  }
});
