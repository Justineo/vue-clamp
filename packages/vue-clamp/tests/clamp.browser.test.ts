import { afterEach, describe, expect, it } from "vite-plus/test";
import { Comment, createApp, defineComponent, h, nextTick, ref } from "vue";
import { LineClamp } from "../src/index.ts";
import {
  accessibleTextElement,
  afterElement,
  bestBrowserFitText,
  beforeElement,
  cleanupMounted,
  mountClamp,
  mountRichClamp,
  richContentElement,
  rootElement,
  sampleVisibleLineCounts,
  settle,
  textElement,
  visibleLineCount,
  waitUntilVisible,
} from "./browser.ts";

import type { LineClampExposed, RichLineClampExposed } from "../src/index.ts";

const DEMO_TEXT =
  "Vue (pronounced /vjuː/, like view) is a progressive framework for building user interfaces. Unlike other monolithic frameworks, Vue is designed from the ground up to be incrementally adoptable. The core library is focused on the view layer only, and is easy to pick up and integrate with other libraries or existing projects. On the other hand, Vue is also perfectly capable of powering sophisticated Single-Page Applications when used in combination with modern tooling and supporting libraries.";
const RICH_TEXT_HTML =
  '<strong>Vue</strong> ships <img alt="" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2212%22 viewBox=%220 0 24 12%22%3E%3Crect width=%2224%22 height=%2212%22 rx=%226%22 fill=%22%23005BD2%22/%3E%3C/svg%3E" style="width:24px;height:12px;vertical-align:baseline" /> <a href="/docs">layout-aware rich text clamping</a> for <em>inline content</em> and trailing markup.';
const REMOTE_IMAGE_RICH_TEXT_HTML =
  '<strong>Vue</strong> ships <img alt="" src="/rich-demo-icon.svg" style="width:14px;height:14px;vertical-align:-2px" /> <a href="/docs">layout-aware rich text clamping</a> for <em>inline content</em> and trailing markup.';
const BEHAVIORAL_RICH_TEXT_HTML =
  '<inline-note>Custom inline content</inline-note> stays valid beside <div style="display:inline">behavior-driven wrappers</div> when they render as inline text.';
const ATOMIC_LEAF_RICH_TEXT_HTML =
  '<inline-badge style="display:inline-block;width:24px;height:12px;vertical-align:baseline"></inline-badge> trailing copy that still needs clamping.';
const INLINE_BLOCK_RICH_TEXT_HTML =
  'Lead <span class="inline-box" style="display:inline-block">AtomicBox</span> trailing copy that should not split inside the inline box.';

function expectEndWordBoundary(sourceText: string, clampedText: string): void {
  const prefix = clampedText.replace(/…$/u, "").trim();

  expect(clampedText.endsWith("…")).toBe(true);
  expect(sourceText.startsWith(prefix)).toBe(true);
  expect(prefix.length === 0 || sourceText[prefix.length] === " ").toBe(true);
}

afterEach(() => {
  cleanupMounted();
});

function richImage(root: HTMLElement, message: string): HTMLImageElement {
  const image = richContentElement(root).querySelector("img");
  if (!(image instanceof HTMLImageElement)) {
    throw new Error(message);
  }

  return image;
}

function lineContentElement(root: HTMLElement): HTMLElement {
  const content = root.querySelector('[data-part="content"]');
  if (!(content instanceof HTMLElement)) {
    throw new Error("Expected line clamp content element.");
  }

  return content;
}

describe("LineClamp browser contract", () => {
  it("renders plain text without role or aria-label when no truncation support is needed", async () => {
    const mounted = mountClamp({
      text: "abcdefghijklmno",
    });

    await settle();

    const textNode = textElement(rootElement(mounted.container));
    expect(textNode.getAttribute("role")).toBeNull();
    expect(textNode.getAttribute("aria-hidden")).toBeNull();
    expect(textNode.textContent).toBe("abcdefghijklmno");
    expect(textNode.getAttribute("aria-label")).toBeNull();
    expect(accessibleTextElement(rootElement(mounted.container))).toBeNull();
  });

  it("renders the requested root tag through the as prop", async () => {
    const mounted = mountClamp({
      text: "alpha beta",
      props: {
        as: "article",
      },
    });

    await settle();

    const root = rootElement(mounted.container);
    expect(root.tagName).toBe("ARTICLE");
    expect(root.getAttribute("data-part")).toBe("root");
    expect(root.querySelector('[data-part="content"]')).toBeInstanceOf(HTMLElement);
    expect(root.querySelector('[data-part="body"]')).toBeInstanceOf(HTMLElement);
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

    (mounted.exposed.value as LineClampExposed).toggle();
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
    expect(beforeElement(root)?.getAttribute("data-part")).toBe("before");
    expect(afterElement(root)?.getAttribute("data-part")).toBe("after");
    expect(beforeElement(root)?.textContent).toBe("Before");
    expect(afterElement(root)?.textContent).toBe("After");
  });

  it("does not render before and after wrappers for empty slot output", async () => {
    const mounted = mountClamp({
      text: "abcdefghijklmno",
      before: () => [],
      after: () => h(Comment),
    });

    await settle();

    const root = rootElement(mounted.container);
    expect(beforeElement(root)).toBeNull();
    expect(afterElement(root)).toBeNull();
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

    expect(textElement(root).textContent).toBe(
      "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz",
    );
    expect(getComputedStyle(lineContentElement(root)).getPropertyValue("-webkit-line-clamp")).toBe(
      "2",
    );
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("uses native one-line overflow when the default end-ellipsis path is eligible", async () => {
    const sourceText = "abcdefghijklmnopqrstuvwxyz";
    const mounted = mountClamp({
      text: sourceText,
      props: {
        maxLines: 1,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    const textNode = textElement(root);
    expect(textNode.textContent).toBe(sourceText);
    expect(getComputedStyle(textNode).textOverflow).toBe("ellipsis");
    expect(getComputedStyle(textNode).whiteSpace).toBe("nowrap");
    expect(textNode.getAttribute("aria-hidden")).toBeNull();
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);
  });

  it("keeps the native one-line overflow path when location is 1", async () => {
    const sourceText = "abcdefghijklmnopqrstuvwxyz";
    const mounted = mountClamp({
      text: sourceText,
      props: {
        maxLines: 1,
        location: 1,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    const textNode = textElement(root);
    expect(textNode.textContent).toBe(sourceText);
    expect(getComputedStyle(textNode).textOverflow).toBe("ellipsis");
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
  });

  it("keeps the native one-line path clamped when width comes from the parent container", async () => {
    const sourceText = "abcdefghijklmnopqrstuvwxyz";
    const mounted = mountClamp({
      text: sourceText,
      applyWidthToComponent: false,
      containerStyle: "width:120px",
      props: {
        maxLines: 1,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    expect(textElement(root).textContent).toBe(sourceText);
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);
  });

  it("keeps the native one-line path with fixed-width before and after slots", async () => {
    const sourceText = "abcdefghijklmnopqrstuvwxyz";
    const mounted = mountClamp({
      text: sourceText,
      width: 180,
      props: {
        maxLines: 1,
      },
      before: () => h("strong", "Before"),
      after: () => h("button", { type: "button" }, "After"),
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    const textNode = textElement(root);
    expect(textNode.textContent).toBe(sourceText);
    expect(beforeElement(root)?.textContent).toBe("Before");
    expect(afterElement(root)?.textContent).toBe("After");
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);
  });

  it("allows before slot content in native multiline line-clamp mode", async () => {
    const mounted = mountClamp({
      text: DEMO_TEXT,
      width: 210,
      props: {
        maxLines: 2,
      },
      before: () => h("strong", "Before"),
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle();

    expect(beforeElement(root)?.textContent).toBe("Before");
    expect(textElement(root).textContent).toBe(DEMO_TEXT);
    expect(getComputedStyle(lineContentElement(root)).getPropertyValue("-webkit-line-clamp")).toBe(
      "2",
    );
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("keeps multiline after slot cases on the measured path", async () => {
    const mounted = mountClamp({
      text: DEMO_TEXT,
      width: 210,
      props: {
        maxLines: 2,
      },
      after: () => h("button", { type: "button" }, "After"),
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const textNode = textElement(root);
    expect(
      getComputedStyle(lineContentElement(root)).getPropertyValue("-webkit-line-clamp"),
    ).not.toBe("2");
    expect(textNode.textContent).not.toBe(DEMO_TEXT);
    expect(textNode.getAttribute("aria-hidden")).toBe("true");
    expect(accessibleTextElement(root)?.textContent).toBe(DEMO_TEXT);
    expect(afterElement(root)?.textContent).toBe("After");
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
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

    expect(textElement(root).textContent).toBe("abcdefghijklmnopqrstuvwxyz");
    expect(afterElement(root)).not.toBeNull();
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);
  });

  it("supports numeric ratio locations in the DOM-trimmed path", async () => {
    const sourceText = "abcdefghijklmnopqrstuvwxyz";
    const mounted = mountClamp({
      text: sourceText,
      width: 120,
      props: {
        maxLines: 1,
        location: 0.75,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    const textNode = textElement(root);
    expect(textNode.getAttribute("aria-hidden")).toBe("true");
    expect(textNode.textContent).toBe(bestBrowserFitText(root, sourceText, 1, 0.75));
    expect(accessibleTextElement(root)?.textContent).toBe(sourceText);
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
  });

  it("falls back to DOM-trimmed text for custom one-line ellipsis values", async () => {
    const mounted = mountClamp({
      text: "abcdefghijklmnopqrstuvwxyz",
      props: {
        maxLines: 1,
        ellipsis: "...",
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    const textNode = textElement(root);
    expect(textNode.textContent).toContain("...");
    expect(textNode.textContent).not.toBe("abcdefghijklmnopqrstuvwxyz");
    expect(textNode.getAttribute("aria-hidden")).toBe("true");
    expect(accessibleTextElement(root)?.textContent).toBe("abcdefghijklmnopqrstuvwxyz");
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
  });

  it("uses the measured path for one-line word-boundary clamping", async () => {
    const sourceText = "alpha beta gamma delta";
    const mounted = mountClamp({
      text: sourceText,
      width: 90,
      props: {
        maxLines: 1,
        boundary: "word",
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    const textNode = textElement(root);
    expect(getComputedStyle(textNode).textOverflow).toBe("clip");
    expect(textNode.getAttribute("aria-hidden")).toBe("true");
    expectEndWordBoundary(sourceText, textNode.textContent ?? "");
    expect(accessibleTextElement(root)?.textContent).toBe(sourceText);
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
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

    const textNode = textElement(root);
    expect(textNode.getAttribute("aria-label")).toBeNull();
    expect(textNode.textContent).toBe(nextText);
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);
  });

  it("reclamps when maxHeight increases after mount", async () => {
    const maxHeight = ref("20px");
    const container = document.createElement("div");
    document.body.append(container);

    const Host = defineComponent({
      setup() {
        return () =>
          h(LineClamp, {
            maxHeight: maxHeight.value,
            style: [
              "display:block",
              "width:180px",
              "font:16px Georgia, serif",
              "line-height:20px",
              "white-space:normal",
              "overflow-wrap:break-word",
            ].join(";"),
            text: DEMO_TEXT,
          });
      },
    });

    const app = createApp(Host);
    app.mount(container);

    try {
      const root = rootElement(container);
      await waitUntilVisible(root);
      await settle(4);

      const before = textElement(root).textContent ?? "";
      expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);

      maxHeight.value = "40px";
      await settle(4);

      const after = textElement(root).textContent ?? "";
      expect(after.length).toBeGreaterThan(before.length);
      expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
    } finally {
      app.unmount();
      container.remove();
    }
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

  it("keeps the full source text available for assistive tech when the visible text is rewritten", async () => {
    const sourceText = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz";
    const mounted = mountClamp({
      text: sourceText,
      props: {
        ellipsis: "...",
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);

    const textNode = textElement(root);
    expect(textNode.textContent).not.toBe(sourceText);
    expect(textNode.textContent).toContain("...");
    expect(textNode.getAttribute("aria-hidden")).toBe("true");
    expect(accessibleTextElement(root)?.textContent).toBe(sourceText);
  });

  it("clamps supported inline html while preserving rich markup", async () => {
    const mounted = mountRichClamp({
      html: RICH_TEXT_HTML,
      width: 170,
      props: {
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const rich = richContentElement(root);
    expect(rich.innerHTML).toContain("<strong>Vue</strong>");
    expect(rich.innerHTML).toContain('<a href="/docs">');
    expect(rich.querySelector("img")).toBeInstanceOf(HTMLImageElement);
    expect(rich.textContent).toContain("…");
    expect(rich.getAttribute("aria-hidden")).toBeNull();
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("can clamp supported rich text at word boundaries", async () => {
    const sourceText = "Alpha beta gamma delta epsilon";
    const mounted = mountRichClamp({
      html: `<strong>Alpha</strong> beta gamma delta epsilon`,
      width: 115,
      props: {
        maxLines: 1,
        boundary: "word",
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const rich = richContentElement(root);
    expect(rich.querySelector("strong")).toBeInstanceOf(HTMLElement);
    expectEndWordBoundary(sourceText, rich.textContent ?? "");
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);
  });

  it("places the rich ellipsis outside the inline element that contains the cut", async () => {
    const mounted = mountRichClamp({
      html: "<code>release-candidate-build-number-2026</code> trailing copy",
      width: 150,
      props: {
        maxLines: 1,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const rich = richContentElement(root);
    const code = rich.querySelector("code");
    if (!(code instanceof HTMLElement)) {
      throw new Error("Expected retained code element.");
    }

    expect(code.textContent).not.toContain("…");
    expect(rich.lastChild).toBeInstanceOf(Text);
    expect(rich.lastChild?.textContent).toBe("…");
    expect(rich.innerHTML).toMatch(/^<code>.+<\/code>…$/u);

    mounted.width.value = 130;
    await settle(4);

    const rootEllipses = [...rich.childNodes].filter(
      (node) => node instanceof Text && node.data === "…",
    );
    expect(rootEllipses).toHaveLength(1);
    expect(rich.querySelector("code")?.textContent).not.toContain("…");
  });

  it("preserves visible rich images across same-html width reclamps", async () => {
    const mounted = mountRichClamp({
      html: REMOTE_IMAGE_RICH_TEXT_HTML,
      width: 170,
      props: {
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await settle(4);

    const firstImage = richImage(root, "Expected the initial rich image.");

    mounted.width.value = 171;
    await settle(4);

    const secondImage = richImage(root, "Expected the current rich image.");
    expect(secondImage).toBe(firstImage);
    expect(secondImage.getAttribute("src")).toBe("/rich-demo-icon.svg");

    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("uses inert image sources in the hidden rich probe", async () => {
    const mounted = mountRichClamp({
      html: REMOTE_IMAGE_RICH_TEXT_HTML,
      width: 170,
      props: {
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await settle(4);

    expect(richImage(root, "Expected the visible rich image.").getAttribute("src")).toBe(
      "/rich-demo-icon.svg",
    );

    const probeImage = root.querySelector('[aria-hidden="true"] img');
    if (!(probeImage instanceof HTMLImageElement)) {
      throw new Error("Expected the hidden rich probe image.");
    }

    expect(probeImage.getAttribute("src")).toMatch(/^data:image\//u);
  });

  it("clamps behavior-supported inline wrappers regardless of tag name", async () => {
    const mounted = mountRichClamp({
      html: BEHAVIORAL_RICH_TEXT_HTML,
      width: 170,
      props: {
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const rich = richContentElement(root);
    expect(rich.querySelector("div")).toBeInstanceOf(HTMLDivElement);
    expect(rich.querySelector("inline-note")).toBeInstanceOf(HTMLElement);
    expect(rich.textContent).toContain("…");
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("clamps leaf custom elements as atomic inline content", async () => {
    const mounted = mountRichClamp({
      html: ATOMIC_LEAF_RICH_TEXT_HTML,
      width: 120,
      props: {
        maxLines: 1,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const rich = richContentElement(root);
    expect(rich.querySelector("inline-badge")).toBeInstanceOf(HTMLElement);
    expect(rich.textContent).toContain("…");
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);
  });

  it("treats inline-block descendants as atomic runs", async () => {
    const mounted = mountRichClamp({
      html: INLINE_BLOCK_RICH_TEXT_HTML,
      width: 90,
      props: {
        maxLines: 1,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const rich = richContentElement(root);
    expect(rich.querySelector(".inline-box")).toBeNull();
    expect(rich.textContent).toContain("Lead");
    expect(rich.textContent).toContain("…");
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);
  });

  it("falls back to raw html when descendants leave inline flow", async () => {
    const sourceHtml = "<div>This wrapper stays block layout and should not be clamped.</div>";
    const mounted = mountRichClamp({
      html: sourceHtml,
      width: 120,
      props: {
        maxLines: 1,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(richContentElement(root).innerHTML).toBe(sourceHtml);
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(false);
  });

  it("does not clip raw html fallback when maxHeight is used", async () => {
    const sourceHtml =
      "<div>This wrapper stays block layout and should remain fully visible when rich clamping gives up.</div>";
    const mounted = mountRichClamp({
      html: sourceHtml,
      width: 120,
      props: {
        maxHeight: 20,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(richContentElement(root).innerHTML).toBe(sourceHtml);
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(false);
    expect(root.style.maxHeight).toBe("");
    expect(root.style.overflow).toBe("");
  });

  it("does not show over-limit rich html lines in the first frame after a width shrink", async () => {
    const mounted = mountRichClamp({
      html: RICH_TEXT_HTML,
      width: 260,
      props: {
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    mounted.width.value = 140;
    await nextTick();

    expect(visibleLineCount(root)).toBeLessThanOrEqual(2);

    await settle(4);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("settles back within the requested rich html line limit after an external container width shrink", async () => {
    const mounted = mountRichClamp({
      html: RICH_TEXT_HTML,
      applyWidthToComponent: false,
      containerStyle: "width:260px",
      props: {
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    mounted.container.style.width = "140px";
    await settle(4);

    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });
});
