import { afterEach, describe, expect, it } from "vite-plus/test";
import { h } from "vue";
import {
  afterElement,
  bestBrowserFitText,
  beforeElement,
  cleanupMounted,
  mountClamp,
  rootElement,
  sampleVisibleLineCounts,
  settle,
  textElement,
  waitUntilVisible,
} from "./browser.ts";

import type { ClampExposed } from "../src/index.ts";

const DEMO_TEXT =
  "Vue (pronounced /vjuː/, like view) is a progressive framework for building user interfaces. Unlike other monolithic frameworks, Vue is designed from the ground up to be incrementally adoptable. The core library is focused on the view layer only, and is easy to pick up and integrate with other libraries or existing projects. On the other hand, Vue is also perfectly capable of powering sophisticated Single-Page Applications when used in combination with modern tooling and supporting libraries.";

afterEach(() => {
  cleanupMounted();
});

describe("Clamp browser contract", () => {
  it("renders the text prop and mirrors it to aria-label", async () => {
    const mounted = mountClamp({
      text: "abcdefghijklmno",
    });

    await settle();

    const textNode = textElement(rootElement(mounted.container));
    expect(textNode.getAttribute("role")).toBe("text");
    expect(textNode.textContent).toBe("abcdefghijklmno");
    expect(textNode.getAttribute("aria-label")).toBe("abcdefghijklmno");
  });

  it("renders the requested root tag through the as prop", async () => {
    const mounted = mountClamp({
      text: "alpha beta",
      props: {
        as: "article",
      },
    });

    await settle();

    expect(rootElement(mounted.container).tagName).toBe("ARTICLE");
  });

  it("emits update:expanded when the exposed toggle is called", async () => {
    const values: boolean[] = [];
    const mounted = mountClamp({
      text: "abcdefghijklmno",
      props: {
        "onUpdate:expanded"(value: boolean) {
          values.push(value);
        },
      },
    });

    await settle();

    (mounted.exposed.value as ClampExposed).toggle();
    await settle();

    expect(values.at(-1)).toBe(true);
  });

  it("renders atomic before and after slot wrappers", async () => {
    const mounted = mountClamp({
      text: "abcdefghijklmno",
      before: () => "Before",
      after: () => "After",
    });

    await settle();

    const root = rootElement(mounted.container);
    expect(beforeElement(root)?.textContent).toBe("Before");
    expect(afterElement(root)?.textContent).toBe("After");
  });

  it("clamps within the requested line limit when font metrics are inherited from the parent context", async () => {
    const mounted = mountClamp({
      text: "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz",
      applyWidthToComponent: false,
      containerStyle: 'width:180px;font:24px "Times New Roman",serif;line-height:32px',
      style: "font:inherit;line-height:inherit",
      props: {
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    expect(textElement(root).textContent).toContain("…");
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("renders an ellipsis in the collapsed text when clamped", async () => {
    const mounted = mountClamp({
      text: "abcdefghijklmnopqrstuvwxyz",
      props: {
        maxLines: 1,
      },
    });

    await waitUntilVisible(rootElement(mounted.container));

    expect(textElement(rootElement(mounted.container)).textContent).toContain("…");
  });

  it("clamps when the live width comes from the parent container instead of the root element", async () => {
    const mounted = mountClamp({
      text: "abcdefghijklmnopqrstuvwxyz",
      applyWidthToComponent: false,
      containerStyle: "width:120px",
      props: {
        maxLines: 1,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    expect(textElement(root).textContent).toContain("…");
    expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);
  });

  it("reclamps after an after slot appears when clamped state changes", async () => {
    const mounted = mountClamp({
      text: "abcdefghijklmnopqrstuvwxyz",
      props: {
        maxLines: 1,
      },
      after: ({ clamped }) =>
        clamped ? h("span", { style: "display:inline-block;width:20px" }, "After") : null,
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle();

    expect(textElement(root).textContent).toContain("…");
    expect(afterElement(root)).not.toBeNull();
    expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);
  });

  it("keeps the production component within 3 visible lines at fractional widths", async () => {
    const mounted = mountClamp({
      text: "Vue is a progressive framework for building user interfaces. Unlike other monolithic frameworks, Vue is designed from the ground up to be incrementally adoptable across layouts that change often.",
      width: 220.671875,
      style: "line-height:24px",
      props: {
        maxLines: 3,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    expect(await sampleVisibleLineCounts(root)).toEqual([3, 3, 3]);
  });

  it("settles back within the requested line limit after a width shrink", async () => {
    const mounted = mountClamp({
      text: DEMO_TEXT,
      width: 360,
      style: "line-height:24px",
      props: {
        maxLines: 3,
      },
      after: () => "[Read more]",
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    mounted.width.value = 220;
    await settle(2);

    expect(await sampleVisibleLineCounts(root)).toEqual([3, 3, 3]);
  });

  it("keeps updates within the requested line limit after a text swap", async () => {
    const nextText = "0123456789abcdefghijklmnopqrstuvwxyz";
    const mounted = mountClamp({
      text: "abcdefghijklmnopqrstuvwxyz",
      width: 120,
      props: {
        maxLines: 1,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    mounted.text.value = nextText;
    await settle(1);

    expect(textElement(root).getAttribute("aria-label")).toBe(nextText);
    expect(textElement(root).textContent).not.toBe(nextText);
    expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);
  });

  it("keeps after-slot correction close to the browser-fit maximum instead of over-clamping", async () => {
    const mounted = mountClamp({
      text: DEMO_TEXT,
      width: 373,
      style: [
        'font-family:"IBM Plex Sans","Segoe UI",sans-serif',
        "font-size:16px",
        "line-height:29.6px",
        "overflow-wrap:anywhere",
        "box-sizing:border-box",
        "border:1px solid #c7d0dc",
        "font-kerning:none",
        "font-variant-ligatures:none",
        'font-feature-settings:"kern" 0,"liga" 0,"clig" 0',
        "padding:0.9rem 1rem",
      ].join(";"),
      props: {
        maxLines: 3,
      },
      after: ({ clamped, expanded }) =>
        expanded || clamped
          ? h(
              "button",
              {
                style: [
                  "display:inline",
                  "padding:0",
                  "border:0",
                  "background:transparent",
                  "color:#2656b9",
                  "font-size:0.78rem",
                  "font-weight:500",
                  "line-height:inherit",
                  "white-space:nowrap",
                ].join(";"),
              },
              "Toggle",
            )
          : null,
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const current = textElement(root).textContent ?? "";
    const best = bestBrowserFitText(root, DEMO_TEXT, 3);

    expect((await sampleVisibleLineCounts(root)).every((count) => count <= 3)).toBe(true);
    expect(current.length).toBeGreaterThanOrEqual(best.length - 1);
  });

  it("emits the naive initial unclamped state before the settled clamp result", async () => {
    const values: boolean[] = [];
    const mounted = mountClamp({
      text: "abcdefghijklmnopqrstuvwxyz",
      props: {
        maxLines: 1,
        onClampchange(value: boolean) {
          values.push(value);
        },
      },
    });

    await waitUntilVisible(rootElement(mounted.container));
    await settle();

    expect(values).toEqual([false, true]);
  });
});
