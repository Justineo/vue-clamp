import { afterEach, describe, expect, it } from "vite-plus/test";
import { Comment, createApp, defineComponent, h, nextTick, ref } from "vue";
import { InlineClamp, LineClamp, RichLineClamp } from "../src/index.ts";
import { clampRich, patchRich, prepareRich } from "../src/rich.ts";
import {
  accessibleTextElement,
  afterElement,
  bestBrowserFitText,
  bodyElement,
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
import type { RichClampResult, RichState } from "../src/rich.ts";

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
const RICH_DYNAMIC_TOKEN_HTML =
  '<span class="dynamic-token">observabilityPlatform1</span> trailing copy';

type RichClampFixture = {
  body: HTMLElement;
  clamp: () => RichClampResult;
  cleanup: () => void;
  content: HTMLElement;
  reclamp: (previous: RichClampResult) => RichClampResult;
  root: HTMLElement;
  styles: HTMLStyleElement[];
};

type RichClampFixtureOptions = {
  className?: string;
  html?: string;
  reuseSimpleLineFit?: boolean;
  rootStyle?: readonly string[];
  styles?: readonly string[];
  width?: number;
};

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

function inlineBodyElement(root: HTMLElement): HTMLElement {
  const body = root.querySelector('[data-part="body"]');
  if (!(body instanceof HTMLElement)) {
    throw new Error("Expected inline clamp body element.");
  }

  return body;
}

function measuredTextWidth(text: string, style: string): number {
  const span = document.createElement("span");
  span.style.cssText = `${style};position:absolute;visibility:hidden;white-space:nowrap`;
  span.textContent = text;
  document.body.append(span);

  try {
    return span.getBoundingClientRect().width;
  } finally {
    span.remove();
  }
}

function countClientRectsDuring(element: Element, run: () => void): number {
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "getClientRects");
  const original = descriptor?.value as ((this: Element) => DOMRectList) | undefined;
  if (!descriptor || !original) {
    throw new Error("Expected Element.prototype.getClientRects to be patchable.");
  }

  let calls = 0;
  Object.defineProperty(Element.prototype, "getClientRects", {
    ...descriptor,
    value(this: Element): DOMRectList {
      if (this === element) {
        calls += 1;
      }

      return original.call(this);
    },
  });

  try {
    run();
  } finally {
    Object.defineProperty(Element.prototype, "getClientRects", descriptor);
  }

  return calls;
}

function countComputedStylesDuring(run: () => void): number {
  const original = window.getComputedStyle;
  let calls = 0;
  window.getComputedStyle = ((...args: Parameters<typeof window.getComputedStyle>) => {
    calls += 1;
    return original(...args);
  }) as typeof window.getComputedStyle;

  try {
    run();
  } finally {
    window.getComputedStyle = original;
  }

  return calls;
}

function countStyleSheetRuleReadsDuring(run: () => void): number {
  const descriptor = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, "cssRules");
  if (!descriptor?.get) {
    throw new Error("Expected CSSStyleSheet.prototype.cssRules to be patchable.");
  }
  const cssRulesDescriptor = descriptor as PropertyDescriptor & {
    get(this: CSSStyleSheet): CSSRuleList;
  };

  let calls = 0;
  Object.defineProperty(CSSStyleSheet.prototype, "cssRules", {
    ...cssRulesDescriptor,
    get(this: CSSStyleSheet): CSSRuleList {
      calls += 1;
      return Reflect.apply(cssRulesDescriptor.get, this, []) as CSSRuleList;
    },
  });

  try {
    run();
  } finally {
    Object.defineProperty(CSSStyleSheet.prototype, "cssRules", descriptor);
  }

  return calls;
}

function withUnreadableStyleSheetRules<T>(sheet: CSSStyleSheet, run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, "cssRules");
  if (!descriptor?.get) {
    throw new Error("Expected CSSStyleSheet.prototype.cssRules to be patchable.");
  }
  const cssRulesDescriptor = descriptor as PropertyDescriptor & {
    get(this: CSSStyleSheet): CSSRuleList;
  };

  Object.defineProperty(CSSStyleSheet.prototype, "cssRules", {
    ...cssRulesDescriptor,
    get(this: CSSStyleSheet): CSSRuleList {
      if (this === sheet) {
        throw new Error("Stylesheet rules are not readable.");
      }

      return Reflect.apply(cssRulesDescriptor.get, this, []) as CSSRuleList;
    },
  });

  try {
    return run();
  } finally {
    Object.defineProperty(CSSStyleSheet.prototype, "cssRules", descriptor);
  }
}

function createRichClampFixture({
  className,
  html = RICH_DYNAMIC_TOKEN_HTML,
  reuseSimpleLineFit = false,
  rootStyle = [],
  styles = [],
  width = 120,
}: RichClampFixtureOptions = {}): RichClampFixture {
  const prepared = prepareRich(html, "word");
  if (!prepared) {
    throw new Error("Expected rich preparation to be available.");
  }
  const preparedRich = prepared;

  const styleElements = styles.map((text) => {
    const style = document.createElement("style");
    style.textContent = text;
    document.head.append(style);
    return style;
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = document.createElement("div");
  if (className) {
    root.className = className;
  }
  root.style.cssText = [
    "display:block",
    `width:${width}px`,
    "font:16px Georgia, serif",
    "line-height:20px",
    "white-space:normal",
    "overflow-wrap:break-word",
    ...rootStyle,
  ].join(";");
  const content = document.createElement("span");
  const body = document.createElement("span");
  body.innerHTML = html;
  content.append(body);
  root.append(content);
  container.append(root);

  function clamp(
    from: RichState | null = null,
    searchIndex: RichClampResult["searchIndex"] = null,
  ): RichClampResult {
    return clampRich({
      ellipsis: "…",
      from,
      hint: from,
      lineLimit: 1,
      maxHeight: undefined,
      prepared: preparedRich,
      probe: {
        body,
        content,
        root,
        width,
      },
      reuseSimpleLineFit,
      searchIndex,
    });
  }

  return {
    body,
    clamp,
    cleanup(): void {
      for (const style of styleElements) {
        style.remove();
      }
      container.remove();
    },
    content,
    reclamp(previous): RichClampResult {
      return clamp(previous.state, previous.searchIndex ?? null);
    },
    root,
    styles: styleElements,
  };
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

  it("reclamps text after font-load metrics change", async () => {
    const mounted = mountClamp({
      text: DEMO_TEXT,
      containerStyle: "--clamp-font-size:16px",
      style: "font-size:var(--clamp-font-size);line-height:28px",
      width: 220,
      props: {
        boundary: "word",
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const before = textElement(root).textContent ?? "";
    mounted.container.style.setProperty("--clamp-font-size", "24px");
    document.fonts?.dispatchEvent(new Event("loadingdone"));
    await settle(5);

    const after = textElement(root).textContent ?? "";
    expect(after).toContain("…");
    expect(after.length).toBeLessThan(before.length);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("restores full text after same-width font-load metrics shrink", async () => {
    const source = "Release dashboards keep ownership visible after regional incidents.";
    const mounted = mountClamp({
      text: source,
      containerStyle: "--clamp-font-size:24px",
      style: "font-size:var(--clamp-font-size);line-height:28px",
      width: 280,
      props: {
        boundary: "word",
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(textElement(root).textContent).toContain("…");
    mounted.container.style.setProperty("--clamp-font-size", "12px");
    document.fonts?.dispatchEvent(new Event("loadingdone"));
    await settle(5);

    expect(textElement(root).textContent).toBe(source);
    expect(mounted.exposed.value?.clamped).toBe(false);
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

  it("does not report native multiline clamping from a zero-width content box", async () => {
    const style = document.createElement("style");
    style.textContent = [
      ".native-zero-content[data-part='root']{padding-inline:24px}",
      ".native-zero-content [data-part='content']{width:0!important;max-width:0!important}",
    ].join("\n");
    document.head.append(style);

    const mounted = mountClamp({
      text: DEMO_TEXT,
      width: 210,
      props: {
        class: "native-zero-content",
        maxLines: 2,
      },
    });

    try {
      const root = rootElement(mounted.container);
      await waitUntilVisible(root);
      await settle();

      expect(root.getBoundingClientRect().width).toBeGreaterThan(0);
      expect(lineContentElement(root).clientWidth).toBe(0);
      expect(textElement(root).textContent).toBe(DEMO_TEXT);
      expect(accessibleTextElement(root)).toBeNull();
      expect((mounted.exposed.value as LineClampExposed).clamped).toBe(false);
    } finally {
      style.remove();
    }
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

  it("reclamps measured text across repeated external container resizes", async () => {
    const sourceText = "Alpha beta gamma delta epsilon zeta eta theta iota kappa";
    const mounted = mountClamp({
      text: sourceText,
      applyWidthToComponent: false,
      containerStyle: "width:128px",
      style: "line-height:20px",
      props: {
        maxLines: 2,
      },
      after: () => h("button", { type: "button" }, "More"),
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(textElement(root).textContent).toContain("…");
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);

    mounted.container.style.width = "760px";
    await settle(4);

    expect(textElement(root).textContent).toBe(sourceText);
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(false);

    mounted.container.style.width = "128px";
    await settle(4);

    expect(textElement(root).textContent).toContain("…");
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("recovers full measured text after a large width grow", async () => {
    const sourceText = "Alpha beta gamma delta epsilon zeta eta theta iota kappa";
    const mounted = mountClamp({
      text: sourceText,
      width: 128,
      style: "line-height:20px",
      props: {
        maxLines: 2,
      },
      after: () => h("button", { type: "button" }, "More"),
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(textElement(root).textContent).toContain("…");
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);

    mounted.width.value = 760;
    await settle(4);

    expect(textElement(root).textContent).toBe(sourceText);
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(false);
    expect((await sampleVisibleLineCounts(root)).every((count) => count <= 2)).toBe(true);
  });

  it("uses the current external width when text changes in the same flush", async () => {
    const nextText = "Omega beta gamma delta epsilon zeta eta theta iota kappa";
    const mounted = mountClamp({
      text: "Alpha beta gamma delta epsilon zeta eta theta iota kappa",
      applyWidthToComponent: false,
      containerStyle: "width:128px",
      style: "line-height:20px",
      props: {
        maxLines: 2,
      },
      after: () => h("button", { type: "button" }, "More"),
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(textElement(root).textContent).toContain("…");
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);

    mounted.container.style.width = "760px";
    mounted.text.value = nextText;
    await settle(4);

    expect(textElement(root).textContent).toBe(nextText);
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(false);
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

  it("keeps max-height fitting correct when candidate height moves the root", async () => {
    const mounted = mountClamp({
      text: DEMO_TEXT,
      width: 150,
      containerStyle: "height:160px;display:flex;align-items:center",
      style: "line-height:20px",
      props: {
        maxHeight: "40px",
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const visibleText = textElement(root).textContent ?? "";
    expect(visibleText).toContain("…");
    expect(visibleText).not.toBe("…");
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
    expect((await sampleVisibleLineCounts(root)).every((count) => count <= 2)).toBe(true);
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

  it("updates rewritten visible and accessible text when the source text changes", async () => {
    const nextText = "Omega beta gamma delta epsilon zeta eta theta iota kappa lambda";
    const mounted = mountClamp({
      text: "Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda",
      width: 170,
      props: {
        ellipsis: "...",
        maxLines: 1,
      },
      after: () => h("button", { type: "button" }, "More"),
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(textElement(root).textContent).toContain("Alpha");
    expect(accessibleTextElement(root)?.textContent).toContain("Alpha");

    mounted.text.value = nextText;
    await settle(4);

    expect(textElement(root).textContent).toContain("Omega");
    expect(textElement(root).textContent).not.toContain("Alpha");
    expect(accessibleTextElement(root)?.textContent).toBe(nextText);
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(true);
  });

  it("replaces rewritten text structure when the source becomes empty", async () => {
    const mounted = mountClamp({
      text: "Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda",
      width: 170,
      props: {
        boundary: "word",
        maxLines: 1,
      },
      after: () => h("button", { type: "button" }, "More"),
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(textElement(root).textContent).toContain("…");
    expect(accessibleTextElement(root)?.textContent).toContain("Alpha");

    mounted.text.value = "";
    await settle(4);

    expect(bodyElement(root).textContent).toBe("");
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(false);
  });

  it("replaces unclamped measured text when the source becomes empty", async () => {
    const mounted = mountClamp({
      text: "Alpha beta",
      width: 480,
      props: {
        boundary: "word",
        maxLines: 2,
      },
      after: () => h("button", { type: "button" }, "More"),
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(textElement(root).textContent).toBe("Alpha beta");
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(false);

    mounted.text.value = "";
    await settle(4);

    expect(bodyElement(root).textContent).toBe("");
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(false);
  });

  it("replaces unclamped measured text without leaving a hidden source wrapper", async () => {
    const mounted = mountClamp({
      text: "Alpha beta",
      width: 480,
      props: {
        boundary: "word",
        maxLines: 2,
      },
      after: () => h("button", { type: "button" }, "More"),
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    mounted.text.value = "Omega beta";
    await settle(4);

    expect(textElement(root).textContent).toBe("Omega beta");
    expect(textElement(root).getAttribute("aria-hidden")).toBeNull();
    expect(accessibleTextElement(root)).toBeNull();
    expect((mounted.exposed.value as LineClampExposed).clamped).toBe(false);
  });

  it("restores full inline text after a small width grow", async () => {
    const sourceText = "abcdefghijklmnopqrstuvwxyz";
    const textStyle = "font:16px Menlo,monospace;line-height:20px";
    const fullWidth = measuredTextWidth(sourceText, textStyle);
    const width = ref(Math.ceil(fullWidth - 8));
    const container = document.createElement("div");
    document.body.append(container);

    const Host = defineComponent({
      setup() {
        return () =>
          h(InlineClamp, {
            location: "middle",
            style: `width:${width.value}px;${textStyle}`,
            text: sourceText,
          });
      },
    });

    const app = createApp(Host);
    app.mount(container);

    try {
      const root = rootElement(container);
      await settle(4);

      expect(inlineBodyElement(root).textContent).not.toBe(sourceText);
      expect(inlineBodyElement(root).getAttribute("aria-hidden")).toBe("true");

      width.value = Math.ceil(fullWidth + 2);
      await settle(4);

      expect(inlineBodyElement(root).textContent).toBe(sourceText);
      expect(inlineBodyElement(root).getAttribute("aria-hidden")).toBeNull();
    } finally {
      app.unmount();
      container.remove();
    }
  });

  it("keeps the rich root ellipsis when reclamping from a trimmed root text cut", () => {
    const prepared = prepareRich("<span></span> abc");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = null;

    state = patchRich(
      prepared,
      target,
      state,
      { kind: "clamped", point: { path: [1], offset: 1 } },
      "…",
    );
    expect(target.textContent).toBe("…");

    patchRich(prepared, target, state, { kind: "clamped", point: { path: [1], offset: 2 } }, "…");

    expect([...target.childNodes].map((node) => node.textContent)).toEqual(["", " a", "…"]);
  });

  it("preserves rich text nodes when reclamping to a same-node whitespace cut", async () => {
    const prepared = prepareRich("<span>alpha beta</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(
      prepared,
      target,
      null,
      { kind: "clamped", point: { path: [0, 0], offset: 5 } },
      "…",
    );
    const span = target.firstChild;
    const text = span?.firstChild;
    const ellipsisNode = target.lastChild;
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((nextRecords) => {
      records.push(...nextRecords);
    });

    observer.observe(target, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    state = patchRich(
      prepared,
      target,
      state,
      { kind: "clamped", point: { path: [0, 0], offset: 6 } },
      "…",
    );
    await Promise.resolve();
    observer.disconnect();

    expect(target.textContent).toBe("alpha…");
    expect(target.firstChild).toBe(span);
    expect(target.firstChild?.firstChild).toBe(text);
    expect(target.lastChild).toBe(ellipsisNode);
    expect(records).toHaveLength(0);
  });

  it("preserves the rich root ellipsis across generic clamped patches", () => {
    const prepared = prepareRich("<span>alpha</span> <span>beta</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(
      prepared,
      target,
      null,
      { kind: "clamped", point: { path: [0, 0], offset: 2 } },
      "…",
    );
    const ellipsisNode = target.lastChild;

    state = patchRich(
      prepared,
      target,
      state,
      { kind: "clamped", point: { path: [2, 0], offset: 2 } },
      "…",
    );

    expect(target.textContent).toBe("alpha be…");
    expect(target.lastChild).toBe(ellipsisNode);
    expect(state.kind).toBe("clamped");
  });

  it("preserves complete rich prefix nodes when growing across sibling text wrappers", () => {
    const prepared = prepareRich("<span>alpha</span> <span>beta</span> <span>gamma</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(
      prepared,
      target,
      null,
      { kind: "clamped", point: { path: [0, 0], offset: 5 } },
      "…",
    );
    const firstSpan = target.firstChild;
    const ellipsisNode = target.lastChild;

    state = patchRich(
      prepared,
      target,
      state,
      { kind: "clamped", point: { path: [2, 0], offset: 4 } },
      "…",
    );

    expect(target.textContent).toBe("alpha beta…");
    expect(target.firstChild).toBe(firstSpan);
    expect(target.lastChild).toBe(ellipsisNode);
  });

  it("preserves rich prefix nodes when growing from a partial text cut", () => {
    const prepared = prepareRich("<span>alpha</span> <span>beta</span> <span>gamma</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(
      prepared,
      target,
      null,
      { kind: "clamped", point: { path: [0, 0], offset: 2 } },
      "…",
    );
    const firstSpan = target.firstChild;
    const firstText = firstSpan?.firstChild;
    const ellipsisNode = target.lastChild;

    state = patchRich(
      prepared,
      target,
      state,
      { kind: "clamped", point: { path: [2, 0], offset: 4 } },
      "…",
    );

    expect(target.textContent).toBe("alpha beta…");
    expect(target.firstChild).toBe(firstSpan);
    expect(target.firstChild?.firstChild).toBe(firstText);
    expect(target.lastChild).toBe(ellipsisNode);
  });

  it("preserves rich prefix nodes when clamping from full rich content", () => {
    const prepared = prepareRich("<span>alpha</span> <span>beta</span> <span>gamma</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(prepared, target, null, { kind: "full" }, "…");
    const firstSpan = target.childNodes[0];
    const rootSpace = target.childNodes[1];
    const secondSpan = target.childNodes[2];
    const secondText = secondSpan?.firstChild;

    state = patchRich(
      prepared,
      target,
      state,
      { kind: "clamped", point: { path: [2, 0], offset: 2 } },
      "…",
    );

    expect(target.textContent).toBe("alpha be…");
    expect(target.childNodes[0]).toBe(firstSpan);
    expect(target.childNodes[1]).toBe(rootSpace);
    expect(target.childNodes[2]).toBe(secondSpan);
    expect(target.childNodes[2]?.firstChild).toBe(secondText);
  });

  it("preserves complete rich prefix nodes when growing to full rich content", () => {
    const prepared = prepareRich("<span>alpha</span> <span>beta</span> <span>gamma</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(
      prepared,
      target,
      null,
      { kind: "clamped", point: { path: [0, 0], offset: 5 } },
      "…",
    );
    const firstSpan = target.firstChild;

    state = patchRich(prepared, target, state, { kind: "full" }, "…");

    expect(target.textContent).toBe("alpha beta gamma");
    expect(target.firstChild).toBe(firstSpan);
  });

  it("restores trimmed rich prefix whitespace when growing across sibling wrappers", () => {
    const prepared = prepareRich("<span>alpha </span><span>beta</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(
      prepared,
      target,
      null,
      { kind: "clamped", point: { path: [0, 0], offset: 6 } },
      "…",
    );

    expect(target.textContent).toBe("alpha…");

    state = patchRich(
      prepared,
      target,
      state,
      { kind: "clamped", point: { path: [1, 0], offset: 4 } },
      "…",
    );

    expect(target.textContent).toBe("alpha beta…");
  });

  it("preserves complete rich prefix nodes when growing from a trimmed root space", () => {
    const prepared = prepareRich("<span>alpha</span> <span>beta</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(
      prepared,
      target,
      null,
      { kind: "clamped", point: { path: [1], offset: 1 } },
      "…",
    );
    const firstSpan = target.firstChild;
    const ellipsisNode = target.lastChild;

    state = patchRich(
      prepared,
      target,
      state,
      { kind: "clamped", point: { path: [2, 0], offset: 4 } },
      "…",
    );

    expect(target.textContent).toBe("alpha beta…");
    expect(target.firstChild).toBe(firstSpan);
    expect(target.lastChild).toBe(ellipsisNode);
  });

  it("preserves complete rich prefix nodes when shrinking to a trimmed root space", () => {
    const prepared = prepareRich("<span>alpha</span> <span>beta</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(
      prepared,
      target,
      null,
      { kind: "clamped", point: { path: [2, 0], offset: 4 } },
      "…",
    );
    const firstSpan = target.firstChild;
    const ellipsisNode = target.lastChild;

    state = patchRich(
      prepared,
      target,
      state,
      { kind: "clamped", point: { path: [1], offset: 1 } },
      "…",
    );

    expect(target.textContent).toBe("alpha…");
    expect(target.firstChild).toBe(firstSpan);
    expect(target.lastChild).toBe(ellipsisNode);
  });

  it("rebuilds rich content when a trimmed root space hides inner prefix whitespace", () => {
    const prepared = prepareRich("<span>alpha </span> <span>beta</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(
      prepared,
      target,
      null,
      { kind: "clamped", point: { path: [1], offset: 1 } },
      "…",
    );

    expect(target.textContent).toBe("alpha…");

    state = patchRich(prepared, target, state, { kind: "full" }, "…");

    expect(target.innerHTML).toBe("<span>alpha </span> <span>beta</span>");
    expect(state.kind).toBe("full");
  });

  it("preserves complete rich prefix nodes when shrinking across sibling text wrappers", () => {
    const prepared = prepareRich("<span>alpha</span> <span>beta</span> <span>gamma</span>");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const target = document.createElement("span");
    let state: RichState | null = patchRich(
      prepared,
      target,
      null,
      { kind: "clamped", point: { path: [2, 0], offset: 5 } },
      "…",
    );
    const firstSpan = target.firstChild;
    const ellipsisNode = target.lastChild;

    state = patchRich(
      prepared,
      target,
      state,
      { kind: "clamped", point: { path: [0, 0], offset: 5 } },
      "…",
    );

    expect(target.textContent).toBe("alpha…");
    expect(target.firstChild).toBe(firstSpan);
    expect(target.lastChild).toBe(ellipsisNode);
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

  it("reclamps rich html after font-load metrics change", async () => {
    const mounted = mountRichClamp({
      html: RICH_TEXT_HTML,
      containerStyle: "--clamp-font-size:16px",
      style: "font-size:var(--clamp-font-size);line-height:28px",
      width: 220,
      props: {
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const before = richContentElement(root).textContent ?? "";
    mounted.container.style.setProperty("--clamp-font-size", "24px");
    document.fonts?.dispatchEvent(new Event("loadingdone"));
    await settle(5);

    const after = richContentElement(root).textContent ?? "";
    expect(after).toContain("…");
    expect(after.length).toBeLessThan(before.length);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("restores full rich html after same-width font-load metrics shrink", async () => {
    const source = "Release dashboards keep ownership visible after regional incidents.";
    const html =
      "<strong>Release dashboards</strong> keep ownership visible after <em>regional incidents</em>.";
    const mounted = mountRichClamp({
      html,
      containerStyle: "--clamp-font-size:24px",
      style: "font-size:var(--clamp-font-size);line-height:28px",
      width: 280,
      props: {
        boundary: "word",
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(richContentElement(root).textContent).toContain("…");
    mounted.container.style.setProperty("--clamp-font-size", "12px");
    document.fonts?.dispatchEvent(new Event("loadingdone"));
    await settle(5);

    expect(richContentElement(root).textContent).toBe(source);
    expect(mounted.exposed.value?.clamped).toBe(false);
  });

  it("does not reuse a repeated-width rich cache entry after root style changes", async () => {
    const source = "Release dashboards keep ownership visible after regional incidents.";
    const html =
      "<strong>Release dashboards</strong> keep ownership visible after <em>regional incidents</em>.";
    const width = ref(280);
    const fontSize = ref(24);
    const exposed = ref<RichLineClampExposed | null>(null);
    const container = document.createElement("div");
    document.body.append(container);

    const Host = defineComponent({
      setup() {
        return () =>
          h(RichLineClamp, {
            ref: exposed,
            boundary: "word",
            html,
            maxLines: 2,
            style: [
              "display:block",
              `width:${width.value}px`,
              "font-family:Georgia,serif",
              `font-size:${fontSize.value}px`,
              "line-height:28px",
              "overflow-wrap:break-word",
            ].join(";"),
          });
      },
    });

    const app = createApp(Host);
    app.mount(container);

    try {
      const root = rootElement(container);
      await waitUntilVisible(root);
      await settle(4);

      width.value = 360;
      await settle(4);
      width.value = 280;
      await settle(4);

      expect(richContentElement(root).textContent).toContain("…");

      width.value = 360;
      await settle(4);
      fontSize.value = 12;
      width.value = 280;
      await settle(4);

      expect(richContentElement(root).textContent).toBe(source);
      expect(exposed.value?.clamped).toBe(false);
    } finally {
      app.unmount();
      container.remove();
    }
  });

  it("keeps supported rich html within the line limit at fractional widths", async () => {
    const mounted = mountRichClamp({
      html: RICH_TEXT_HTML,
      width: 170.671875,
      props: {
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);
    expect(
      Number.parseFloat((root.lastElementChild as HTMLElement | null)?.style.width ?? ""),
    ).toBeCloseTo(170.671875, 3);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("recovers full rich html after a small width grow from a clamped state", async () => {
    const sourceText = "Alpha beta gamma delta epsilon zeta";
    const sourceHtml = "<strong>Alpha beta</strong> gamma delta epsilon zeta";
    const textStyle = "font:16px Menlo,monospace;line-height:20px";
    const twoLineFitWidth = measuredTextWidth(sourceText, textStyle) / 2;
    const mounted = mountRichClamp({
      html: sourceHtml,
      style: textStyle,
      width: Math.floor(twoLineFitWidth - 16),
      props: {
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(richContentElement(root).textContent).toContain("…");
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);

    mounted.width.value = Math.ceil(twoLineFitWidth + 48);
    await settle(4);

    expect(richContentElement(root).innerHTML).toBe(sourceHtml);
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(false);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("uses the current external width when rich html changes in the same flush", async () => {
    const nextHtml = "<strong>Omega beta</strong> gamma delta epsilon zeta eta theta";
    const mounted = mountRichClamp({
      html: "<strong>Alpha beta</strong> gamma delta epsilon zeta eta theta",
      applyWidthToComponent: false,
      containerStyle: "width:128px",
      style: "font:16px Menlo,monospace;line-height:20px",
      props: {
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(richContentElement(root).textContent).toContain("…");
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);

    mounted.container.style.width = "760px";
    mounted.html.value = nextHtml;
    await settle(4);

    expect(richContentElement(root).innerHTML).toBe(nextHtml);
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(false);
    expect(await sampleVisibleLineCounts(root)).toEqual([1, 1, 1]);
  });

  it("reclamps rich html when an affix wrapper keeps identity but changes size", async () => {
    const afterWidth = ref(20);
    const mounted = mountRichClamp({
      after: () =>
        h("span", {
          style: `display:inline-block;width:${afterWidth.value}px`,
        }),
      html: RICH_TEXT_HTML,
      width: 170,
      props: {
        maxLines: 2,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    const initialText = richContentElement(root).textContent ?? "";
    expect(initialText).toContain("…");
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);

    afterWidth.value = 120;
    await settle(8);

    const renderedAfter = afterElement(root)?.firstElementChild as HTMLElement | null;
    expect(renderedAfter?.getBoundingClientRect().width).toBeCloseTo(120, 3);
    expect(richContentElement(root).textContent?.length ?? 0).toBeLessThan(initialText.length);
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("replaces clamped rich html when the source changes to a fitting value", async () => {
    const shortHtml = "<em>Short rich text</em>";
    const mounted = mountRichClamp({
      html: "<strong>Alpha beta gamma delta epsilon zeta eta theta iota kappa</strong>",
      width: 130,
      props: {
        maxLines: 1,
      },
    });

    const root = rootElement(mounted.container);
    await waitUntilVisible(root);
    await settle(4);

    expect(richContentElement(root).textContent).toContain("…");
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(true);

    mounted.html.value = shortHtml;
    await settle(4);

    expect(richContentElement(root).innerHTML).toBe(shortHtml);
    expect((mounted.exposed.value as RichLineClampExposed).clamped).toBe(false);
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

  it("marks class-styled atomic whitespace rich cuts as unsafe warm ranks", async () => {
    const html =
      '<span class="rich-atomic-token">A</span> <span class="rich-atomic-token">B</span> trailing rich copy';
    const fixture = createRichClampFixture({
      html,
      styles: [
        ".rich-atomic-token{display:inline-block;width:36px;height:12px;vertical-align:baseline}",
      ],
      width: 44,
    });

    try {
      await settle(1);
      const result = fixture.clamp();

      expect(result.state?.kind).toBe("clamped");
      expect(result.textRankSafe).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  it("does not publish a word rank for rich fallback grapheme cuts", async () => {
    const html = "supercalifragilisticexpialidocious";
    const fixture = createRichClampFixture({ html, width: 44 });

    try {
      await settle(1);
      const result = fixture.clamp();

      expect(result.state?.kind).toBe("clamped");
      expect(result.rank).toBeUndefined();
      expect(result.textRankSafe).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });

  it("avoids rich rect-list line counting for simple inline text with roomy line metrics", async () => {
    const html = `<strong>Telemetry</strong> ${Array.from(
      { length: 12 },
      (_, index) => `<span>observabilityPlatform${index + 1}</span>`,
    ).join(" ")}`;
    const prepared = prepareRich(html, "word");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = document.createElement("div");
    root.style.cssText = [
      "display:block",
      "width:360px",
      "font:16px Georgia, serif",
      "line-height:20px",
      "white-space:normal",
      "overflow-wrap:break-word",
    ].join(";");
    const content = document.createElement("span");
    const body = document.createElement("span");
    body.innerHTML = html;
    content.append(body);
    root.append(content);
    container.append(root);

    try {
      await settle(1);
      const calls = countClientRectsDuring(content, () => {
        clampRich({
          ellipsis: "…",
          from: null,
          hint: null,
          lineLimit: 5,
          maxHeight: undefined,
          prepared,
          probe: {
            body,
            content,
            root,
            width: 360,
          },
        });
      });

      expect(calls).toBe(0);
    } finally {
      container.remove();
    }
  });

  it("keeps exact rich rect-list counting when font boxes can exceed line height", async () => {
    const html = `<strong>Telemetry</strong> ${Array.from(
      { length: 12 },
      (_, index) => `<span>observabilityPlatform${index + 1}</span>`,
    ).join(" ")}`;
    const prepared = prepareRich(html, "word");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = document.createElement("div");
    root.style.cssText = [
      "display:block",
      "width:360px",
      "font-family:Georgia, serif",
      "font-size:18px",
      "line-height:20px",
      "white-space:normal",
      "overflow-wrap:break-word",
    ].join(";");
    const content = document.createElement("span");
    const body = document.createElement("span");
    body.innerHTML = html;
    content.append(body);
    root.append(content);
    container.append(root);

    try {
      await settle(1);
      const calls = countClientRectsDuring(content, () => {
        clampRich({
          ellipsis: "…",
          from: null,
          hint: null,
          lineLimit: 5,
          maxHeight: undefined,
          prepared,
          probe: {
            body,
            content,
            root,
            width: 360,
          },
        });
      });

      expect(calls).toBeGreaterThan(0);
    } finally {
      container.remove();
    }
  });

  it("rechecks rich child line metrics before using cached height line counting", async () => {
    const html = `<strong>Telemetry</strong> ${Array.from(
      { length: 12 },
      (_, index) => `<span>observabilityPlatform${index + 1}</span>`,
    ).join(" ")}`;
    const prepared = prepareRich(html, "word");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = document.createElement("div");
    root.style.cssText = [
      "display:block",
      "width:360px",
      "font:16px Georgia, serif",
      "line-height:20px",
      "white-space:normal",
      "overflow-wrap:break-word",
    ].join(";");
    const content = document.createElement("span");
    const body = document.createElement("span");
    body.innerHTML = html;
    content.append(body);
    root.append(content);
    container.append(root);

    try {
      await settle(1);
      const first = clampRich({
        ellipsis: "…",
        from: null,
        hint: null,
        lineLimit: 5,
        maxHeight: undefined,
        prepared,
        probe: {
          body,
          content,
          root,
          width: 360,
        },
      });

      for (const span of body.querySelectorAll("span")) {
        span.style.fontSize = "18px";
      }

      const calls = countClientRectsDuring(content, () => {
        clampRich({
          ellipsis: "…",
          from: first.state,
          hint: first.state,
          lineLimit: 5,
          maxHeight: undefined,
          prepared,
          probe: {
            body,
            content,
            root,
            width: 360,
          },
          searchIndex: first.searchIndex ?? null,
        });
      });

      expect(calls).toBeGreaterThan(0);
    } finally {
      container.remove();
    }
  });

  it("rechecks stylesheet-driven rich child line metrics before reusing cached height line counting", async () => {
    const html = `<strong>Telemetry</strong> ${Array.from(
      { length: 12 },
      (_, index) => `<span>observabilityPlatform${index + 1}</span>`,
    ).join(" ")}`;
    const prepared = prepareRich(html, "word");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const style = document.createElement("style");
    style.textContent = ".metric-host span{font-size:var(--metric-size)}";
    const container = document.createElement("div");
    document.head.append(style);
    document.body.append(container);
    const root = document.createElement("div");
    root.style.cssText = [
      "display:block",
      "width:360px",
      "font:16px Georgia, serif",
      "line-height:20px",
      "--metric-size:16px",
      "white-space:normal",
      "overflow-wrap:break-word",
    ].join(";");
    const content = document.createElement("span");
    const body = document.createElement("span");
    body.className = "metric-host";
    body.innerHTML = html;
    content.append(body);
    root.append(content);
    container.append(root);

    try {
      await settle(1);
      const first = clampRich({
        ellipsis: "…",
        from: null,
        hint: null,
        lineLimit: 5,
        maxHeight: undefined,
        prepared,
        probe: {
          body,
          content,
          root,
          width: 360,
        },
      });

      root.style.setProperty("--metric-size", "18px");

      const calls = countClientRectsDuring(content, () => {
        clampRich({
          ellipsis: "…",
          from: first.state,
          hint: first.state,
          lineLimit: 5,
          maxHeight: undefined,
          prepared,
          probe: {
            body,
            content,
            root,
            width: 360,
          },
          reuseSimpleLineFit: true,
          searchIndex: first.searchIndex ?? null,
        });
      });

      expect(calls).toBeGreaterThan(0);
    } finally {
      style.remove();
      container.remove();
    }
  });

  it("reuses cached rich simple-line style after a trusted width-only reclamp", async () => {
    const html = "<strong>Telemetry</strong> <span>observabilityPlatform1</span> trailing copy";
    const prepared = prepareRich(html, "word");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = document.createElement("div");
    root.style.cssText = [
      "display:block",
      "width:360px",
      "font:16px Georgia, serif",
      "line-height:20px",
      "white-space:normal",
      "overflow-wrap:break-word",
    ].join(";");
    const content = document.createElement("span");
    const body = document.createElement("span");
    body.innerHTML = html;
    content.append(body);
    root.append(content);
    container.append(root);

    try {
      await settle(1);
      const first = clampRich({
        ellipsis: "…",
        from: null,
        hint: null,
        lineLimit: 2,
        maxHeight: undefined,
        prepared,
        probe: {
          body,
          content,
          root,
          width: 360,
        },
      });

      root.style.width = "320px";
      const calls = countComputedStylesDuring(() => {
        clampRich({
          ellipsis: "…",
          from: first.state,
          hint: first.state,
          lineLimit: 2,
          maxHeight: undefined,
          prepared,
          probe: {
            body,
            content,
            root,
            width: 320,
          },
          reuseSimpleLineFit: true,
          searchIndex: first.searchIndex ?? null,
        });
      });

      expect(calls).toBe(1);
    } finally {
      container.remove();
    }
  });

  it("refreshes inherited rich simple-line metrics without rechecking child styles", async () => {
    const html = [
      "<strong>Telemetry</strong>",
      '<span style="white-space:nowrap">observabilityPlatform1</span>',
      "trailing copy",
    ].join(" ");
    const prepared = prepareRich(html, "word");
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = document.createElement("div");
    root.style.cssText = [
      "display:block",
      "width:360px",
      "font:16px Georgia, serif",
      "line-height:20px",
      "white-space:normal",
      "overflow-wrap:break-word",
    ].join(";");
    const content = document.createElement("span");
    const body = document.createElement("span");
    body.innerHTML = html;
    content.append(body);
    root.append(content);
    container.append(root);

    try {
      await settle(1);
      const first = clampRich({
        ellipsis: "…",
        from: null,
        hint: null,
        lineLimit: 2,
        maxHeight: undefined,
        prepared,
        probe: {
          body,
          content,
          root,
          width: 360,
        },
      });

      root.style.fontSize = "18px";
      root.style.lineHeight = "22px";
      let result: RichClampResult | undefined;
      const calls = countComputedStylesDuring(() => {
        result = clampRich({
          ellipsis: "…",
          from: first.state,
          hint: first.state,
          lineLimit: 2,
          maxHeight: undefined,
          prepared,
          probe: {
            body,
            content,
            root,
            width: 360,
          },
          reuseSimpleLineFit: true,
          searchIndex: first.searchIndex ?? null,
        });
      });

      expect(calls).toBe(1);
      expect(result?.fallback).toBe(false);
    } finally {
      container.remove();
    }
  });

  it("rebuilds cached rich search metadata when inline wrappers become atomic", async () => {
    const fixture = createRichClampFixture({
      html: "<span>observabilityPlatform1</span> trailing copy",
    });

    try {
      await settle(1);
      const first = fixture.clamp();

      const span = fixture.body.querySelector("span");
      if (!span) {
        throw new Error("Expected rich body to contain the source span.");
      }
      span.style.display = "inline-block";
      span.style.width = "180px";

      const result = fixture.reclamp(first);

      expect(result.fallback).toBe(false);
      expect(fixture.body.querySelector("span")).toBeNull();
      expect(fixture.body.textContent).toBe("…");
    } finally {
      fixture.cleanup();
    }
  });

  it("rebuilds cached rich search metadata when atomic wrappers become inline", async () => {
    const fixture = createRichClampFixture({
      className: "dynamic-rich-host",
      reuseSimpleLineFit: true,
      rootStyle: ["--token-display:inline-block"],
      styles: [".dynamic-rich-host .dynamic-token{display:var(--token-display);width:180px}"],
    });

    try {
      await settle(1);
      const first = fixture.clamp();

      expect(fixture.body.textContent).toBe("…");
      fixture.root.style.setProperty("--token-display", "inline");

      const result = fixture.reclamp(first);

      expect(result.fallback).toBe(false);
      expect(fixture.body.textContent).toContain("observability");
      expect(fixture.body.textContent).toContain("…");
    } finally {
      fixture.cleanup();
    }
  });

  it("continues scanning stylesheets after finding variable rich line metrics", async () => {
    const fixture = createRichClampFixture({
      className: "line-metric-before-display-host",
      reuseSimpleLineFit: true,
      rootStyle: ["--token-display:inline-block"],
      styles: [
        ".line-metric-before-display-host strong{font-size:var(--metric-size,16px)}",
        ".line-metric-before-display-host .dynamic-token{display:var(--token-display);width:180px}",
      ],
    });

    try {
      await settle(1);
      const first = fixture.clamp();

      expect(fixture.body.textContent).toBe("…");
      fixture.root.style.setProperty("--token-display", "inline");

      const result = fixture.reclamp(first);

      expect(result.fallback).toBe(false);
      expect(fixture.body.textContent).toContain("observability");
      expect(fixture.body.textContent).toContain("…");
    } finally {
      fixture.cleanup();
    }
  });

  it("finds variable rich display declarations inside grouping rules", async () => {
    const fixture = createRichClampFixture({
      className: "grouped-dynamic-rich-host",
      rootStyle: ["--token-display:inline-block"],
      styles: [
        "@media (min-width:1px){.grouped-dynamic-rich-host .dynamic-token{display:var(--token-display);width:180px}}",
      ],
    });

    try {
      await settle(1);
      const first = fixture.clamp();

      expect(fixture.body.textContent).toBe("…");
      fixture.root.style.setProperty("--token-display", "inline");

      const result = fixture.reclamp(first);

      expect(result.fallback).toBe(false);
      expect(fixture.body.textContent).toContain("observability");
      expect(fixture.body.textContent).toContain("…");
    } finally {
      fixture.cleanup();
    }
  });

  it("rebuilds cached rich search metadata when a later stylesheet makes atomic wrappers inline", async () => {
    const dynamicStyle = document.createElement("style");
    dynamicStyle.textContent =
      ".late-style-host .dynamic-token{display:var(--token-display);width:180px}";
    const fixture = createRichClampFixture({
      className: "late-style-host",
      rootStyle: ["--token-display:inline"],
      styles: [".late-style-host .dynamic-token{display:inline-block;width:180px}"],
    });

    try {
      await settle(1);
      const first = fixture.clamp();

      expect(fixture.body.textContent).toBe("…");
      document.head.append(dynamicStyle);

      const result = fixture.reclamp(first);

      expect(result.fallback).toBe(false);
      expect(fixture.body.textContent).toContain("observability");
      expect(fixture.body.textContent).toContain("…");
    } finally {
      dynamicStyle.remove();
      fixture.cleanup();
    }
  });

  it("rebuilds cached rich search metadata when an inserted CSSOM rule makes atomic wrappers inline", async () => {
    const fixture = createRichClampFixture({
      className: "insert-rule-host",
      rootStyle: ["--token-display:inline"],
      styles: [".insert-rule-host .dynamic-token{display:inline-block;width:180px}"],
    });

    try {
      await settle(1);
      const first = fixture.clamp();

      expect(fixture.body.textContent).toBe("…");
      const sheet = fixture.styles[0]?.sheet;
      if (!sheet) {
        throw new Error("Expected test stylesheet to be available.");
      }
      sheet.insertRule(
        ".insert-rule-host .dynamic-token{display:var(--token-display);width:180px}",
        sheet.cssRules.length,
      );

      const result = fixture.reclamp(first);

      expect(result.fallback).toBe(false);
      expect(fixture.body.textContent).toContain("observability");
      expect(fixture.body.textContent).toContain("…");
    } finally {
      fixture.cleanup();
    }
  });

  it("rebuilds cached rich search metadata when a nested CSSOM rule makes atomic wrappers inline", async () => {
    const fixture = createRichClampFixture({
      className: "nested-rule-host",
      rootStyle: ["--token-display:inline"],
      styles: [
        [
          ".nested-rule-host .dynamic-token{display:inline-block;width:180px}",
          "@media (min-width:1px){}",
        ].join("\n"),
      ],
    });

    try {
      await settle(1);
      const first = fixture.clamp();

      expect(fixture.body.textContent).toBe("…");
      const sheet = fixture.styles[0]?.sheet;
      if (!sheet) {
        throw new Error("Expected test stylesheet to be available.");
      }
      const mediaRule = sheet.cssRules[1];
      if (!(mediaRule instanceof CSSMediaRule)) {
        throw new Error("Expected test media rule to be available.");
      }
      mediaRule.insertRule(
        ".nested-rule-host .dynamic-token{display:var(--token-display);width:180px}",
        mediaRule.cssRules.length,
      );

      const result = fixture.reclamp(first);

      expect(result.fallback).toBe(false);
      expect(fixture.body.textContent).toContain("observability");
      expect(fixture.body.textContent).toContain("…");
    } finally {
      fixture.cleanup();
    }
  });

  it("rebuilds cached rich search metadata when a CSSOM rule display changes in place", async () => {
    const fixture = createRichClampFixture({
      className: "mutated-rule-host",
      styles: [".mutated-rule-host .dynamic-token{display:inline-block;width:180px}"],
    });

    try {
      await settle(1);
      const first = fixture.clamp();

      expect(fixture.body.textContent).toBe("…");
      const sheet = fixture.styles[0]?.sheet;
      if (!sheet) {
        throw new Error("Expected test stylesheet to be available.");
      }
      const rule = sheet.cssRules[0];
      if (!(rule instanceof CSSStyleRule)) {
        throw new Error("Expected test style rule to be available.");
      }
      rule.style.display = "inline";

      const result = fixture.reclamp(first);

      expect(result.fallback).toBe(false);
      expect(fixture.body.textContent).toContain("observability");
      expect(fixture.body.textContent).toContain("…");
    } finally {
      fixture.cleanup();
    }
  });

  it("rebuilds cached rich search metadata when a media rule becomes active", async () => {
    const fixture = createRichClampFixture({
      className: "media-change-host",
      rootStyle: ["--token-display:inline"],
      styles: [
        [
          ".media-change-host .dynamic-token{display:inline-block;width:180px}",
          "@media (max-width:1px){.media-change-host .dynamic-token{display:var(--token-display);width:180px}}",
        ].join("\n"),
      ],
    });

    try {
      await settle(1);
      const first = fixture.clamp();

      expect(fixture.body.textContent).toBe("…");
      const sheet = fixture.styles[0]?.sheet;
      if (!sheet) {
        throw new Error("Expected test stylesheet to be available.");
      }
      const mediaRule = sheet.cssRules[1];
      if (!(mediaRule instanceof CSSMediaRule)) {
        throw new Error("Expected test media rule to be available.");
      }
      mediaRule.media.mediaText = "(min-width: 1px)";

      const result = fixture.reclamp(first);

      expect(result.fallback).toBe(false);
      expect(fixture.body.textContent).toContain("observability");
      expect(fixture.body.textContent).toContain("…");
    } finally {
      fixture.cleanup();
    }
  });

  it("treats unreadable rich display stylesheets as style-dependent", async () => {
    const fixture = createRichClampFixture({
      className: "unreadable-style-host",
      rootStyle: ["--token-display:inline-block"],
      styles: [".unreadable-style-host .dynamic-token{display:var(--token-display);width:180px}"],
    });

    try {
      await settle(1);
      const sheet = fixture.styles[0]?.sheet;
      if (!sheet) {
        throw new Error("Expected test stylesheet to be available.");
      }

      const first = withUnreadableStyleSheetRules(sheet, () => fixture.clamp());

      expect(fixture.body.textContent).toBe("…");
      fixture.root.style.setProperty("--token-display", "inline");

      const result = withUnreadableStyleSheetRules(sheet, () => fixture.reclamp(first));

      expect(result.fallback).toBe(false);
      expect(fixture.body.textContent).toContain("observability");
      expect(fixture.body.textContent).toContain("…");
    } finally {
      fixture.cleanup();
    }
  });

  it("shares one stylesheet signature scan during a cached rich metadata refresh", async () => {
    const fixture = createRichClampFixture({
      className: "signature-scan-host",
      rootStyle: ["--token-display:inline-block"],
      styles: [".signature-scan-host .dynamic-token{display:var(--token-display);width:180px}"],
    });

    try {
      await settle(1);
      const first = fixture.clamp();

      expect(fixture.body.textContent).toBe("…");
      fixture.root.style.setProperty("--token-display", "inline");
      const styleSheetCount = document.styleSheets.length;

      const calls = countStyleSheetRuleReadsDuring(() => {
        fixture.reclamp(first);
      });

      expect(calls).toBe(styleSheetCount);
      expect(fixture.body.textContent).toContain("observability");
      expect(fixture.body.textContent).toContain("…");
    } finally {
      fixture.cleanup();
    }
  });

  it("shares the stylesheet signature scan when detecting variable rich display rules", async () => {
    const fixture = createRichClampFixture({
      className: "first-signature-scan-host",
      rootStyle: ["--token-display:inline-block"],
      styles: [
        ".first-signature-scan-host .dynamic-token{display:var(--token-display);width:180px}",
      ],
    });

    try {
      await settle(1);
      const styleSheetCount = document.styleSheets.length;
      const calls = countStyleSheetRuleReadsDuring(() => {
        fixture.clamp();
      });

      expect(calls).toBe(styleSheetCount);
      expect(fixture.body.textContent).toBe("…");
    } finally {
      fixture.cleanup();
    }
  });

  it("does not scan stylesheets for all-text rich search metadata", async () => {
    const fixture = createRichClampFixture({
      html: "observabilityPlatform1 trailing copy",
    });
    const firstResult: { value?: RichClampResult } = {};

    try {
      await settle(1);
      const firstCalls = countStyleSheetRuleReadsDuring(() => {
        firstResult.value = fixture.clamp();
      });
      const first = firstResult.value;
      if (!first) {
        throw new Error("Expected first rich clamp result.");
      }

      expect(firstCalls).toBe(0);
      expect(first.searchIndex).toBeTruthy();

      const reclampCalls = countStyleSheetRuleReadsDuring(() => {
        fixture.reclamp(first);
      });

      expect(reclampCalls).toBe(0);
    } finally {
      fixture.cleanup();
    }
  });

  it("ignores variable rich display declarations inside inactive media rules", async () => {
    const fixture = createRichClampFixture({
      className: "inactive-media-host",
      html: '<span class="static-token">observabilityPlatform1</span> trailing copy',
      rootStyle: ["--token-display:inline"],
      styles: [
        [
          ".inactive-media-host .static-token{display:inline-block;width:180px}",
          "@media (max-width:1px){.inactive-media-host .static-token{display:var(--token-display);width:180px}}",
        ].join("\n"),
      ],
    });

    try {
      await settle(1);
      const first = fixture.clamp();

      expect(fixture.body.textContent).toBe("…");

      const calls = countComputedStylesDuring(() => {
        fixture.reclamp(first);
      });

      expect(calls).toBe(0);
      expect(fixture.body.textContent).toBe("…");
    } finally {
      fixture.cleanup();
    }
  });

  it("verifies full rich text when a hinted run candidate with ellipsis overflows", async () => {
    const html = "abci";
    const ellipsis = "WWWW";
    const style = "font:16px Menlo,monospace;line-height:20px";
    const prepared = prepareRich(html);
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = document.createElement("div");
    root.style.cssText = [
      "display:block",
      `width:${Math.ceil(measuredTextWidth(html, style) + 1)}px`,
      style,
      "white-space:normal",
      "overflow-wrap:normal",
    ].join(";");
    const content = document.createElement("span");
    const body = document.createElement("span");
    body.textContent = html;
    content.append(body);
    root.append(content);
    container.append(root);

    const hint: RichState = {
      kind: "clamped",
      point: {
        offset: 3,
        path: [0],
      },
    };

    try {
      await settle(1);
      expect(measuredTextWidth(`abc${ellipsis}`, style)).toBeGreaterThan(
        root.getBoundingClientRect().width,
      );

      const result = clampRich({
        ellipsis,
        from: hint,
        hint,
        lineLimit: 1,
        maxHeight: undefined,
        preferHintedTextRun: true,
        prepared,
        probe: {
          body,
          content,
          root,
          width: root.getBoundingClientRect().width,
        },
        skipFullFit: true,
      });

      expect(result.state?.kind).toBe("full");
      expect(body.textContent).toBe(html);
      expect(result.fallback).toBe(false);
    } finally {
      container.remove();
    }
  });

  it("measures full rich text before accepting a trailing-whitespace full state", async () => {
    const html = "abc                   ";
    const style = "font:16px Menlo,monospace;line-height:20px";
    const prepared = prepareRich(html);
    if (!prepared) {
      throw new Error("Expected rich preparation to be available.");
    }

    const container = document.createElement("div");
    document.body.append(container);
    const root = document.createElement("div");
    root.style.cssText = [
      "display:block",
      `width:${Math.ceil(measuredTextWidth("abc…", style) + 10)}px`,
      style,
      "white-space:break-spaces",
      "overflow-wrap:normal",
    ].join(";");
    const content = document.createElement("span");
    const body = document.createElement("span");
    body.textContent = html;
    content.append(body);
    root.append(content);
    container.append(root);

    const hint: RichState = {
      kind: "clamped",
      point: {
        offset: 3,
        path: [0],
      },
    };
    const visibleProbeLineCount = () => {
      const lines: Array<{ bottom: number; top: number }> = [];

      for (const rect of content.getClientRects()) {
        if (rect.width <= 0 || rect.height <= 0) {
          continue;
        }

        const line = lines.find(
          (current) =>
            Math.abs(current.top - rect.top) <= 0.5 &&
            Math.abs(current.bottom - rect.bottom) <= 0.5,
        );
        if (!line) {
          lines.push({
            bottom: rect.bottom,
            top: rect.top,
          });
        }
      }

      return lines.length;
    };

    try {
      await settle(1);
      expect(visibleProbeLineCount()).toBeGreaterThan(1);

      const result = clampRich({
        ellipsis: "…",
        from: hint,
        hint,
        lineLimit: 1,
        maxHeight: undefined,
        preferHintedTextRun: true,
        prepared,
        probe: {
          body,
          content,
          root,
          width: root.getBoundingClientRect().width,
        },
        skipFullFit: true,
      });

      expect(result.state?.kind).toBe("clamped");
      expect(body.textContent).not.toBe(html);
      expect(body.textContent).toContain("…");
      expect(visibleProbeLineCount()).toBe(1);
      expect(result.fallback).toBe(false);
    } finally {
      container.remove();
    }
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

  it("does not treat fitting float rich html as searchable", async () => {
    const sourceHtml =
      '<span style="float:left;height:120px;width:24px">F</span><span>short copy</span>';
    const mounted = mountRichClamp({
      html: sourceHtml,
      width: 160,
      props: {
        maxHeight: 40,
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

  it("does not treat fitting absolute-positioned rich html as searchable", async () => {
    const sourceHtml =
      '<span style="position:absolute;left:0;top:0;height:120px;width:24px">A</span><span>short copy</span>';
    const mounted = mountRichClamp({
      html: sourceHtml,
      width: 160,
      props: {
        maxHeight: 40,
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
