import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createApp } from "vue";
import {
  accessibleTextElement,
  bestBrowserFitText,
  frame,
  richContentElement,
  sampleVisibleLineCounts,
  settle,
  textElement,
  waitUntilVisible,
} from "./browser.ts";

import type { App as VueApp, Component } from "vue";

type MountedPage = {
  app: VueApp;
  container: HTMLElement;
};

const mounted = new Set<MountedPage>();

function mountPage(component: Component): MountedPage {
  const container = document.createElement("div");
  document.body.append(container);

  const app = createApp(component);
  app.mount(container);

  const mountedPage = {
    app,
    container,
  };
  mounted.add(mountedPage);
  return mountedPage;
}

function clampInDemoBlock(block: HTMLElement): HTMLElement {
  const clampRoot = block.querySelector(".demo-clamp");
  if (!(clampRoot instanceof HTMLElement)) {
    throw new Error("Expected the demo clamp root.");
  }

  return clampRoot;
}

function workspaceClamp(container: HTMLElement): HTMLElement {
  return clampInDemoBlock(workspaceDemoBlock(container));
}

function widthInput(container: HTMLElement): HTMLInputElement {
  const input = workspaceDemoBlock(container).querySelector(".control-range");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Expected the workspace width slider.");
  }

  return input;
}

function lineTextInput(container: HTMLElement): HTMLTextAreaElement {
  const input = container.querySelector("[data-line-text-input]");
  if (!(input instanceof HTMLTextAreaElement)) {
    throw new Error("Expected the shared line demo text input.");
  }

  return input;
}

function lineTextPresetButtons(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll("[data-line-text-preset]")].map((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("Expected the shared line text preset button.");
    }

    return button;
  });
}

function workspaceDemoBlock(container: HTMLElement): HTMLElement {
  return demoBlock(container, 0);
}

function demoBlock(container: HTMLElement, index: number): HTMLElement {
  const blocks = container.querySelectorAll(".demo-block");
  const block = blocks.item(index);
  if (!(block instanceof HTMLElement)) {
    throw new Error(`Expected demo block ${index}.`);
  }

  return block;
}

function locationDemoBlock(container: HTMLElement): HTMLElement {
  const block = container.querySelector('[data-demo="location"]');
  if (!(block instanceof HTMLElement)) {
    throw new Error("Expected the location demo block.");
  }

  return block;
}

function locationClamp(container: HTMLElement): HTMLElement {
  return clampInDemoBlock(locationDemoBlock(container));
}

function richHtmlDemoBlock(container: HTMLElement): HTMLElement {
  const block = container.querySelector('[data-demo="rich-html"]');
  if (!(block instanceof HTMLElement)) {
    throw new Error("Expected the rich html demo block.");
  }

  return block;
}

function richHtmlClamp(container: HTMLElement): HTMLElement {
  return clampInDemoBlock(richHtmlDemoBlock(container));
}

function richExampleBlocks(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll("[data-rich-example]")].filter(
    (block): block is HTMLElement => block instanceof HTMLElement,
  );
}

function richExampleBlock(container: HTMLElement, example: string): HTMLElement {
  const block = container.querySelector(`[data-rich-example="${example}"]`);
  if (!(block instanceof HTMLElement)) {
    throw new Error(`Expected the ${example} rich demo block.`);
  }

  return block;
}

function richHtmlInput(container: HTMLElement): HTMLTextAreaElement {
  const input = container.querySelector("[data-rich-html-input]");
  if (!(input instanceof HTMLTextAreaElement)) {
    throw new Error("Expected the rich html textarea.");
  }

  return input;
}

function richPresetButtons(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll("[data-rich-preset]")].filter(
    (button): button is HTMLButtonElement => button instanceof HTMLButtonElement,
  );
}

function richPresetButton(container: HTMLElement, preset: string): HTMLButtonElement {
  const button = container.querySelector(`[data-rich-preset="${preset}"]`);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected the ${preset} rich preset button.`);
  }

  return button;
}

function richHyphensToggle(container: HTMLElement): HTMLInputElement {
  const input = richHtmlDemoBlock(container).querySelector("[data-rich-hyphens-toggle]");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Expected the rich html hyphens toggle.");
  }

  return input;
}

function locationRatioInput(container: HTMLElement): HTMLInputElement {
  const input = locationDemoBlock(container).querySelector("[data-location-ratio-slider]");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Expected the location ratio slider.");
  }

  return input;
}

function locationWidthInput(container: HTMLElement): HTMLInputElement {
  const input = locationDemoBlock(container).querySelector("[data-location-width-slider]");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Expected the location width slider.");
  }

  return input;
}

function locationPresetButtons(container: HTMLElement): HTMLButtonElement[] {
  return [...locationDemoBlock(container).querySelectorAll("[data-location-preset]")].filter(
    (button): button is HTMLButtonElement => button instanceof HTMLButtonElement,
  );
}

function locationPresetButton(container: HTMLElement, preset: string): HTMLButtonElement {
  const button = locationDemoBlock(container).querySelector(`[data-location-preset="${preset}"]`);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected the ${preset} location preset button.`);
  }

  return button;
}

function inlineDemoBlock(container: HTMLElement): HTMLElement {
  const block = container.querySelector('[data-demo="inline"]');
  if (!(block instanceof HTMLElement)) {
    throw new Error("Expected the inline demo block.");
  }

  return block;
}

function inlineWidthInput(container: HTMLElement): HTMLInputElement {
  const input = inlineDemoBlock(container).querySelector("[data-inline-width-slider]");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Expected the inline width slider.");
  }

  return input;
}

function inlineExampleBlocks(container: HTMLElement): HTMLElement[] {
  return [...inlineDemoBlock(container).querySelectorAll("[data-inline-example]")].filter(
    (block): block is HTMLElement => block instanceof HTMLElement,
  );
}

function inlineExampleBlock(container: HTMLElement, example: string): HTMLElement {
  const block = inlineDemoBlock(container).querySelector(`[data-inline-example="${example}"]`);
  if (!(block instanceof HTMLElement)) {
    throw new Error(`Expected the ${example} inline example block.`);
  }

  return block;
}

function inlineRow(scope: ParentNode, mode: "plain" | "split"): HTMLElement {
  const row = scope.querySelector(`[data-inline-mode="${mode}"]`);
  if (!(row instanceof HTMLElement)) {
    throw new Error(`Expected the ${mode} inline row.`);
  }

  return row;
}

function wrapDemoBlock(container: HTMLElement): HTMLElement {
  const block = container.querySelector('[data-demo="wrap"]');
  if (!(block instanceof HTMLElement)) {
    throw new Error("Expected the wrap demo block.");
  }

  return block;
}

function wrapExampleBlocks(container: HTMLElement): HTMLElement[] {
  return Array.from(wrapDemoBlock(container).querySelectorAll("[data-wrap-example]")).filter(
    (block): block is HTMLElement => block instanceof HTMLElement,
  );
}

function wrapExampleBlock(container: HTMLElement, example: string): HTMLElement {
  const block = wrapDemoBlock(container).querySelector(`[data-wrap-example="${example}"]`);
  if (!(block instanceof HTMLElement)) {
    throw new Error(`Expected the ${example} wrap example block.`);
  }

  return block;
}

function wrapVisibleTabs(block: HTMLElement): string[] {
  return Array.from(block.querySelectorAll(".wrap-tab"))
    .map((tab) => tab.textContent?.trim())
    .filter((label): label is string => Boolean(label));
}

function rangeInput(scope: ParentNode): HTMLInputElement {
  const input = scope.querySelector(".control-range");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Expected a range input.");
  }

  return input;
}

function copyButton(container: ParentNode, blockId: string): HTMLButtonElement {
  const button = container.querySelector(`[data-copy-button="${blockId}"]`);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected the ${blockId} copy button.`);
  }

  return button;
}

function surfaceTab(
  container: HTMLElement,
  surface: "line" | "rich" | "inline" | "wrap",
): HTMLButtonElement {
  const button = container.querySelector(`[data-surface-tab="${surface}"]`);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected the ${surface} surface tab.`);
  }

  return button;
}

function surfaceGuideItem(
  container: HTMLElement,
  surface: "line" | "rich" | "inline" | "wrap",
): HTMLElement {
  const element = container.querySelector(`[data-surface-guide-item="${surface}"]`);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected the ${surface} surface guide item.`);
  }

  return element;
}

function surfaceGuideLink(
  container: HTMLElement,
  surface: "line" | "rich" | "inline" | "wrap",
): HTMLAnchorElement {
  const element = container.querySelector(`[data-surface-guide-link="${surface}"]`);
  if (!(element instanceof HTMLAnchorElement)) {
    throw new Error(`Expected the ${surface} surface guide link.`);
  }

  return element;
}

function replaceRouteHash(hash: string): void {
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}${hash}`,
  );
}

function surfaceTooltip(
  container: HTMLElement,
  surface: "line" | "rich" | "inline" | "wrap",
): HTMLElement {
  const tooltip = container.querySelector(`[data-surface-tooltip="${surface}"]`);
  if (!(tooltip instanceof HTMLElement)) {
    throw new Error(`Expected the ${surface} surface tooltip.`);
  }

  return tooltip;
}

function componentTabsScroll(container: HTMLElement): HTMLElement {
  const element = container.querySelector("[data-component-tabs-scroll]");
  if (!(element instanceof HTMLElement)) {
    throw new Error("Expected the component tabs scroller.");
  }

  return element;
}

function componentTabsMore(container: HTMLElement): HTMLElement | null {
  const element = container.querySelector("[data-component-tabs-more]");
  return element instanceof HTMLElement ? element : null;
}

function heroTagline(container: HTMLElement): HTMLElement {
  const element = container.querySelector(".hero-tagline");
  if (!(element instanceof HTMLElement)) {
    throw new Error("Expected the hero tagline.");
  }

  return element;
}

function heroTaglinePart(container: HTMLElement, part: "body" | "end"): HTMLElement {
  const element = container.querySelector(`.hero-tagline [data-part="${part}"]`);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected the hero tagline ${part} segment.`);
  }

  return element;
}

async function waitFrames(count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await frame();
  }
}

function waitTime(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
async function waitForHeroTaglineShrink(
  tagline: HTMLElement,
  minimumDelta: number,
): Promise<number> {
  const initialWidth = tagline.getBoundingClientRect().width;
  let maxDelta = 0;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await waitTime(250);
    await waitFrames(2);

    const currentWidth = tagline.getBoundingClientRect().width;
    const delta = initialWidth - currentWidth;
    maxDelta = Math.max(maxDelta, delta);

    if (delta > minimumDelta) {
      return delta;
    }
  }

  return maxDelta;
}

async function maxHeroTaglineSuffixOverflow(container: HTMLElement): Promise<{
  maxOverflow: number;
  sawCollapsed: boolean;
}> {
  let maxOverflow = Number.NEGATIVE_INFINITY;
  let sawCollapsed = false;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await waitTime(250);
    await waitFrames(2);

    const tagline = heroTagline(container);
    const body = heroTaglinePart(container, "body");
    const end = heroTaglinePart(container, "end");

    if (body.scrollWidth <= body.clientWidth) {
      continue;
    }

    sawCollapsed = true;
    const taglineRect = tagline.getBoundingClientRect();
    const endRect = end.getBoundingClientRect();
    maxOverflow = Math.max(maxOverflow, endRect.right - taglineRect.right);
  }

  return {
    maxOverflow,
    sawCollapsed,
  };
}

function referenceShell(container: HTMLElement): HTMLElement {
  const shell = container.querySelector("[data-reference-shell]");
  if (!(shell instanceof HTMLElement)) {
    throw new Error("Expected the shared reference shell.");
  }

  return shell;
}

function referenceTabsAnchor(container: HTMLElement): HTMLElement {
  const anchor = referenceShell(container).querySelector(".reference-tabs-anchor");
  if (!(anchor instanceof HTMLElement)) {
    throw new Error("Expected the reference tabs anchor.");
  }

  return anchor;
}

function referencePanelNames(container: HTMLElement): string[] {
  return Array.from(referenceShell(container).querySelectorAll("[data-reference-panel]")).map(
    (panel) => panel.getAttribute("data-reference-panel") ?? "",
  );
}

function checkboxInBlock(block: HTMLElement, label: string): HTMLInputElement {
  const control = Array.from(block.querySelectorAll(".control-check")).find((candidate) =>
    candidate.textContent?.includes(label),
  );
  const input = control?.querySelector("input");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Expected the ${label} checkbox.`);
  }

  return input;
}

async function setRangeValue(input: HTMLInputElement, value: number): Promise<void> {
  input.value = String(value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await settle(4);
}

async function setTextareaValue(input: HTMLTextAreaElement, value: string): Promise<void> {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await settle(4);
}

async function setWorkspaceWidth(container: HTMLElement, width: number): Promise<void> {
  await setRangeValue(widthInput(container), width);
}

async function setLineDemoText(container: HTMLElement, value: string): Promise<void> {
  await setTextareaValue(lineTextInput(container), value);
}

async function setRichDemoHtml(container: HTMLElement, value: string): Promise<void> {
  await setTextareaValue(richHtmlInput(container), value);
}

async function setLocationWidth(container: HTMLElement, width: number): Promise<void> {
  await setRangeValue(locationWidthInput(container), width);
}

async function setLocationRatio(container: HTMLElement, ratio: number): Promise<void> {
  await setRangeValue(locationRatioInput(container), ratio);
}

async function setInlineWidth(container: HTMLElement, width: number): Promise<void> {
  await setRangeValue(inlineWidthInput(container), width);
}

async function clickLocationPreset(container: HTMLElement, preset: string): Promise<void> {
  locationPresetButton(container, preset).click();
  await settle(4);
}

async function selectSurface(
  container: HTMLElement,
  surface: "line" | "rich" | "inline" | "wrap",
): Promise<void> {
  surfaceTab(container, surface).click();
  await settle(4);
}

afterEach(() => {
  for (const mountedPage of mounted) {
    mountedPage.app.unmount();
    mountedPage.container.remove();
  }

  mounted.clear();
  replaceRouteHash("");
});

describe("Website demo page", () => {
  it("keeps the workspace line-clamp toggle demo within three visible lines at 585px", async () => {
    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);

    await settle(4);
    await mountedPage.container.ownerDocument.fonts?.ready;
    await setWorkspaceWidth(mountedPage.container, 585);

    const clampRoot = workspaceClamp(mountedPage.container);
    await waitUntilVisible(clampRoot);

    const counts = await sampleVisibleLineCounts(clampRoot);
    expect(counts.every((count) => count <= 3)).toBe(true);
  });

  it("keeps the workspace line-clamp toggle demo close to browser fit across the narrow edge widths", async () => {
    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);

    await settle(4);
    await mountedPage.container.ownerDocument.fonts?.ready;

    const failures: string[] = [];

    for (let width = 330; width >= 315; width -= 1) {
      await setWorkspaceWidth(mountedPage.container, width);

      const clampRoot = workspaceClamp(mountedPage.container);
      await waitUntilVisible(clampRoot);

      const textNode = textElement(clampRoot);
      const sourceText = accessibleTextElement(clampRoot)?.textContent ?? textNode.textContent;
      if (!sourceText) {
        throw new Error(`Expected the workspace clamp source text at ${width}px.`);
      }

      const currentLength = textNode.textContent?.length ?? 0;
      const bestLength = bestBrowserFitText(clampRoot, sourceText, 3).length;

      if (currentLength < bestLength - 1) {
        failures.push(`${width}px: ${currentLength} < ${bestLength - 1}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it("switches line demo slot copy with the RTL examples", async () => {
    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);

    await settle(4);
    await mountedPage.container.ownerDocument.fonts?.ready;

    const firstBlock = workspaceDemoBlock(mountedPage.container);
    const secondBlock = demoBlock(mountedPage.container, 1);
    const firstToggle = firstBlock.querySelector(".toggle-btn");
    const secondBadge = secondBlock.querySelector(".badge");

    if (!(firstToggle instanceof HTMLButtonElement)) {
      throw new Error("Expected the first demo toggle button.");
    }
    if (!(secondBadge instanceof HTMLElement)) {
      throw new Error("Expected the second demo badge.");
    }

    expect(firstToggle.textContent?.trim()).toBe("More");
    expect(secondBadge.textContent?.trim()).toBe("Featured");

    checkboxInBlock(firstBlock, "RTL").click();
    checkboxInBlock(secondBlock, "RTL").click();
    await settle(4);

    expect(firstToggle.textContent?.trim()).toBe("المزيد");
    expect(secondBadge.textContent?.trim()).toBe("مميز");

    firstToggle.click();
    await settle(4);

    expect(firstToggle.textContent?.trim()).toBe("أقل");
  });

  it("keeps the workspace line-clamp toggle demo close to the browser-fit maximum at 373px", async () => {
    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);

    await settle(4);
    await mountedPage.container.ownerDocument.fonts?.ready;
    await setWorkspaceWidth(mountedPage.container, 373);

    const clampRoot = workspaceClamp(mountedPage.container);
    await waitUntilVisible(clampRoot);

    const textNode = textElement(clampRoot);
    const sourceText = accessibleTextElement(clampRoot)?.textContent ?? textNode.textContent;
    if (!sourceText) {
      throw new Error("Expected the workspace clamp source text.");
    }

    const current = textNode.textContent ?? "";
    const best = bestBrowserFitText(clampRoot, sourceText, 3);

    expect(await sampleVisibleLineCounts(clampRoot)).toEqual([3, 3, 3]);
    expect(current.length).toBeGreaterThanOrEqual(best.length - 1);
  });

  it("updates all multiline demos from the shared line text editor", async () => {
    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);

    await settle(4);
    await mountedPage.container.ownerDocument.fonts?.ready;

    const input = lineTextInput(mountedPage.container);
    expect(input.value).toContain("Vue (pronounced");
    expect(
      lineTextPresetButtons(mountedPage.container).map((button) => button.dataset.lineTextPreset),
    ).toEqual(["english", "chinese", "arabic", "mixed", "emoji"]);

    const customText =
      "Custom demo copy for live testing. It should flow through every LineClamp example without needing to reload the page.";

    await setLineDemoText(mountedPage.container, customText);

    expect(input.value).toBe(customText);
    const allPresetsUnpressed = lineTextPresetButtons(mountedPage.container).every(
      (button) => button.getAttribute("aria-pressed") === "false",
    );
    expect(allPresetsUnpressed).toBe(true);

    const workspaceRoot = workspaceClamp(mountedPage.container);
    const locationRoot = locationClamp(mountedPage.container);

    await waitUntilVisible(workspaceRoot);
    await waitUntilVisible(locationRoot);

    expect(
      accessibleTextElement(workspaceRoot)?.textContent ?? textElement(workspaceRoot).textContent,
    ).toBe(customText);
    expect(
      accessibleTextElement(locationRoot)?.textContent ?? textElement(locationRoot).textContent,
    ).toBe(customText);
  });

  it("shows the rich html demo with editable article-style presets and end-only guidance", async () => {
    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);

    await settle(4);
    await mountedPage.container.ownerDocument.fonts?.ready;
    await selectSurface(mountedPage.container, "rich");

    expect(
      richExampleBlocks(mountedPage.container).map((block) => block.dataset.richExample),
    ).toEqual(["max-lines", "max-height", "clampchange"]);

    const block = richHtmlDemoBlock(mountedPage.container);
    const maxHeightBlock = richExampleBlock(mountedPage.container, "max-height");
    const clampChangeBlock = richExampleBlock(mountedPage.container, "clampchange");
    const clampRoot = richHtmlClamp(mountedPage.container);
    const richRoots = richExampleBlocks(mountedPage.container).map(clampInDemoBlock);

    await waitUntilVisible(clampRoot);
    for (const root of richRoots) {
      await waitUntilVisible(root);
    }

    const input = richHtmlInput(mountedPage.container);
    expect(
      richPresetButtons(mountedPage.container).map((button) => button.dataset.richPreset),
    ).toEqual(["release", "editorial", "incident"]);
    expect(input.value).toContain("<strong>Friday release 2.4.0</strong>");
    expect(input.value).toContain('src="/rich-demo-icon.svg"');
    expect(richContentElement(clampRoot).innerHTML).toContain("<mark>billing export</mark>");
    expect(richContentElement(clampRoot).querySelector("mark")).toBeInstanceOf(HTMLElement);
    expect(richContentElement(clampRoot).querySelector("img")).toBeInstanceOf(HTMLImageElement);
    expect(richContentElement(clampRoot).querySelector("img")?.getAttribute("src")).toBe(
      "/rich-demo-icon.svg",
    );
    expect(richHyphensToggle(mountedPage.container).checked).toBe(true);
    expect(clampRoot.classList.contains("hyphens")).toBe(true);
    expect(block.textContent).toContain("Trusted or sanitized inline HTML only");
    expect(block.textContent).toContain("makes a best-effort pass");
    expect(block.textContent).toContain("nested emphasis");
    expect(block.textContent).toContain("always clamps from the end");
    expect(maxHeightBlock.querySelector(".badge")).toBeInstanceOf(HTMLElement);
    expect(clampChangeBlock.querySelector(".clamp-status")).toBeInstanceOf(HTMLElement);

    richHyphensToggle(mountedPage.container).click();
    await settle(2);

    expect(richHyphensToggle(mountedPage.container).checked).toBe(false);
    expect(clampRoot.classList.contains("hyphens")).toBe(false);

    richHyphensToggle(mountedPage.container).click();
    await settle(2);

    expect(richHyphensToggle(mountedPage.container).checked).toBe(true);
    expect(clampRoot.classList.contains("hyphens")).toBe(true);

    richPresetButton(mountedPage.container, "editorial").click();
    await settle(4);

    expect(input.value).toContain("Feature essay");
    expect(input.value).toContain('<small class="rich-meta">');
    expect(input.value).toContain(
      '<a href="#components">the refreshed <strong>component tabs</strong> should scroll on narrow screens</a>',
    );
    expect(input.value).toContain("<inline-note>");
    expect(input.value).toContain('src="/rich-demo-icon.svg"');
    expect(richPresetButton(mountedPage.container, "editorial").getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(
      richPresetButtons(mountedPage.container)
        .filter((button) => button.dataset.richPreset !== "editorial")
        .every((button) => button.getAttribute("aria-pressed") === "false"),
    ).toBe(true);
    for (const root of richRoots) {
      expect(richContentElement(root).querySelector("small.rich-meta")).toBeInstanceOf(HTMLElement);
      expect(richContentElement(root).querySelector("img")).toBeInstanceOf(HTMLImageElement);
      expect(richContentElement(root).querySelector("img")?.getAttribute("src")).toBe(
        "/rich-demo-icon.svg",
      );
    }
    expect(richContentElement(clampRoot).querySelector("small.rich-meta a strong")).toBeInstanceOf(
      HTMLElement,
    );
  });

  it("updates every RichLineClamp example from the shared rich HTML editor", async () => {
    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);

    await settle(4);
    await mountedPage.container.ownerDocument.fonts?.ready;
    await selectSurface(mountedPage.container, "rich");

    const customHtml =
      'Short release note · <small class="rich-meta">Apr 9</small><br>Keep the <a href="#components">shared <strong>HTML editor</strong></a> in sync with a <mark>single source</mark>.';

    await setRichDemoHtml(mountedPage.container, customHtml);

    expect(richHtmlInput(mountedPage.container).value).toBe(customHtml);
    expect(
      richPresetButtons(mountedPage.container).every(
        (button) => button.getAttribute("aria-pressed") === "false",
      ),
    ).toBe(true);

    for (const root of richExampleBlocks(mountedPage.container).map(clampInDemoBlock)) {
      await waitUntilVisible(root);
      expect(richContentElement(root).querySelector("small.rich-meta")).toBeInstanceOf(HTMLElement);
      expect(richContentElement(root).querySelector("a strong")).toBeInstanceOf(HTMLElement);
      expect(richContentElement(root).querySelector("mark")).toBeInstanceOf(HTMLElement);
    }
  });

  it("applies numeric ratio locations in the location demo and stays aligned with browser fit", async () => {
    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);

    await settle(4);
    await mountedPage.container.ownerDocument.fonts?.ready;
    await setLocationWidth(mountedPage.container, 320);

    const initialText = textElement(locationClamp(mountedPage.container)).textContent ?? "";
    const presetButtons = locationPresetButtons(mountedPage.container);
    expect(presetButtons.map((button) => button.dataset.locationPreset)).toEqual([
      "start",
      "middle",
      "end",
    ]);
    expect(
      locationDemoBlock(mountedPage.container).querySelector("[data-location-value]"),
    ).toBeNull();
    expect(
      locationDemoBlock(mountedPage.container).querySelector('[data-location-mode="custom"]'),
    ).toBeNull();
    expect(locationRatioInput(mountedPage.container).value).toBe("1");
    expect(locationPresetButton(mountedPage.container, "end").getAttribute("aria-pressed")).toBe(
      "true",
    );

    await clickLocationPreset(mountedPage.container, "middle");

    expect(locationRatioInput(mountedPage.container).value).toBe("0.5");
    expect(
      locationPresetButtons(mountedPage.container).map((button) =>
        button.getAttribute("aria-pressed"),
      ),
    ).toEqual(["false", "true", "false"]);

    await setLocationRatio(mountedPage.container, 0.25);

    const clampRoot = locationClamp(mountedPage.container);
    await waitUntilVisible(clampRoot);

    const textNode = textElement(clampRoot);
    const sourceText = accessibleTextElement(clampRoot)?.textContent ?? textNode.textContent;
    if (!sourceText) {
      throw new Error("Expected the location demo clamp source text.");
    }

    const current = textNode.textContent ?? "";
    const [prefix = "", suffix = ""] = current.split("…");

    expect(locationRatioInput(mountedPage.container).value).toBe("0.25");
    expect(
      locationPresetButtons(mountedPage.container).every(
        (button) => button.getAttribute("aria-pressed") === "false",
      ),
    ).toBe(true);
    expect(initialText.endsWith("…")).toBe(true);
    expect(current).not.toBe(initialText);
    expect(current.includes("…")).toBe(true);
    expect(current.endsWith("…")).toBe(false);
    expect(prefix.length).toBeGreaterThan(0);
    expect(prefix.length).toBeLessThan(suffix.length);
    expect(suffix.endsWith(sourceText.slice(-16))).toBe(true);

    await setLocationRatio(mountedPage.container, 0.5);

    expect(locationPresetButton(mountedPage.container, "middle").getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(await sampleVisibleLineCounts(clampRoot)).toEqual([5, 5, 5]);
  });

  it("switches between the documented component surfaces and shows their demos", async () => {
    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);

    await settle(4);
    await mountedPage.container.ownerDocument.fonts?.ready;
    expect(referencePanelNames(mountedPage.container)).toEqual(["demo", "example", "api"]);
    expect(
      referenceShell(mountedPage.container).querySelector(".reference-description"),
    ).toBeNull();
    expect(surfaceTab(mountedPage.container, "line").getAttribute("aria-pressed")).toBe("true");
    expect(surfaceTab(mountedPage.container, "rich").getAttribute("aria-pressed")).toBe("false");
    expect(surfaceTab(mountedPage.container, "inline").getAttribute("aria-pressed")).toBe("false");
    expect(surfaceTab(mountedPage.container, "wrap").getAttribute("aria-pressed")).toBe("false");
    expect(surfaceTooltip(mountedPage.container, "line").textContent).toBe(
      "Multiline browser-fit clamp for plain text, previews, cards, and expandable copy.",
    );
    expect(surfaceTooltip(mountedPage.container, "rich").textContent).toBe(
      "Trusted inline rich-html clamp for styled excerpts, links, and mixed inline markup.",
    );
    expect(surfaceTooltip(mountedPage.container, "inline").textContent).toBe(
      "Native single-line clamp for filenames, paths, and email addresses.",
    );
    expect(surfaceTooltip(mountedPage.container, "wrap").textContent).toBe(
      "Wrapped atomic-item clamp for labels, filters, and selected-value lists.",
    );
    expect(surfaceTab(mountedPage.container, "line").getAttribute("aria-describedby")).toBe(
      "component-tab-tooltip-line",
    );
    expect(surfaceTab(mountedPage.container, "rich").getAttribute("aria-describedby")).toBe(
      "component-tab-tooltip-rich",
    );
    expect(surfaceTab(mountedPage.container, "inline").getAttribute("aria-describedby")).toBe(
      "component-tab-tooltip-inline",
    );
    expect(surfaceTab(mountedPage.container, "wrap").getAttribute("aria-describedby")).toBe(
      "component-tab-tooltip-wrap",
    );

    await selectSurface(mountedPage.container, "inline");
    await setInlineWidth(mountedPage.container, 220);

    expect(surfaceTab(mountedPage.container, "line").getAttribute("aria-pressed")).toBe("false");
    expect(surfaceTab(mountedPage.container, "rich").getAttribute("aria-pressed")).toBe("false");
    expect(surfaceTab(mountedPage.container, "inline").getAttribute("aria-pressed")).toBe("true");
    expect(surfaceTab(mountedPage.container, "wrap").getAttribute("aria-pressed")).toBe("false");
    expect(mountedPage.container.querySelector('[data-demo="location"]')).toBeNull();

    expect(
      inlineExampleBlocks(mountedPage.container).map((block) => block.dataset.inlineExample),
    ).toEqual(["file-list", "email", "path"]);

    const fileListBlock = inlineExampleBlock(mountedPage.container, "file-list");
    const plainFileListRow = inlineRow(fileListBlock, "plain");
    const splitFileListRow = inlineRow(fileListBlock, "split");
    const splitFileListBody = splitFileListRow.querySelector('[data-part="body"]');
    const splitFileListEnd = splitFileListRow.querySelector('[data-part="end"]');
    const splitFileListClamp = splitFileListRow.querySelector(".demo-inline");

    expect(plainFileListRow.querySelector('[data-part="end"]')).toBeNull();
    expect(splitFileListEnd?.textContent).toBe(".jpeg");
    expect(splitFileListClamp?.textContent).toBe("summer-campaign-panorama-final.jpeg");
    if (!(splitFileListBody instanceof HTMLElement)) {
      throw new Error("Expected the split file-list body element.");
    }
    expect(splitFileListBody.scrollWidth).toBeGreaterThan(splitFileListBody.clientWidth);

    const splitEmailRow = inlineRow(inlineExampleBlock(mountedPage.container, "email"), "split");
    expect(splitEmailRow.querySelector('[data-part="end"]')?.textContent).toBe("@acme.dev");

    const splitPathRow = inlineRow(inlineExampleBlock(mountedPage.container, "path"), "split");
    expect(splitPathRow.querySelector('[data-part="start"]')?.textContent).toBe("~/screenshots/");
    expect(splitPathRow.querySelector('[data-part="end"]')?.textContent).toBe(".png");

    await selectSurface(mountedPage.container, "line");

    expect(surfaceTab(mountedPage.container, "line").getAttribute("aria-pressed")).toBe("true");
    expect(surfaceTab(mountedPage.container, "rich").getAttribute("aria-pressed")).toBe("false");
    expect(surfaceTab(mountedPage.container, "inline").getAttribute("aria-pressed")).toBe("false");
    expect(surfaceTab(mountedPage.container, "wrap").getAttribute("aria-pressed")).toBe("false");
    expect(referencePanelNames(mountedPage.container)).toEqual(["demo", "example", "api"]);
    expect(mountedPage.container.querySelector('[data-demo="location"]')).toBeInstanceOf(
      HTMLElement,
    );

    await selectSurface(mountedPage.container, "wrap");
    await setRangeValue(rangeInput(wrapExampleBlock(mountedPage.container, "tabs")), 280);

    expect(surfaceTab(mountedPage.container, "line").getAttribute("aria-pressed")).toBe("false");
    expect(surfaceTab(mountedPage.container, "rich").getAttribute("aria-pressed")).toBe("false");
    expect(surfaceTab(mountedPage.container, "inline").getAttribute("aria-pressed")).toBe("false");
    expect(surfaceTab(mountedPage.container, "wrap").getAttribute("aria-pressed")).toBe("true");
    expect(referencePanelNames(mountedPage.container)).toEqual(["demo", "example", "api"]);
    expect(mountedPage.container.querySelector('[data-demo="inline"]')).toBeNull();
    expect(
      wrapExampleBlocks(mountedPage.container).map((block) => block.dataset.wrapExample),
    ).toEqual(["tabs", "invitees"]);

    const tabsTrigger = wrapExampleBlock(mountedPage.container, "tabs").querySelector(
      "[data-wrap-tabs-trigger]",
    );
    if (!(tabsTrigger instanceof HTMLButtonElement)) {
      throw new Error("Expected the tabs overflow trigger.");
    }
    expect(tabsTrigger.getAttribute("aria-label")).toContain("hidden tabs");
    const tabsBlock = wrapExampleBlock(mountedPage.container, "tabs");
    const visibleLabelsBefore = wrapVisibleTabs(tabsBlock);
    expect(visibleLabelsBefore.length).toBeGreaterThan(0);
    expect(visibleLabelsBefore.length).toBeLessThan(7);
    tabsTrigger.click();
    await settle(4);
    const tabsMenu = mountedPage.container.ownerDocument.querySelector("[data-wrap-tabs-menu]");
    if (!(tabsMenu instanceof HTMLElement)) {
      throw new Error("Expected the tabs overflow menu.");
    }
    const firstHiddenTab = tabsMenu.querySelector(".wrap-tabs-menu-item");
    if (!(firstHiddenTab instanceof HTMLElement)) {
      throw new Error("Expected at least one hidden tab option.");
    }
    const selectedHiddenLabel = firstHiddenTab.textContent?.trim() ?? "";
    firstHiddenTab.click();
    await settle(4);
    expect(mountedPage.container.ownerDocument.querySelector("[data-wrap-tabs-menu]")).toBeNull();
    const visibleLabelsAfter = wrapVisibleTabs(tabsBlock);
    expect(visibleLabelsAfter).toEqual(visibleLabelsBefore);

    tabsTrigger.click();
    await settle(4);
    const reopenedTabsMenu =
      mountedPage.container.ownerDocument.querySelector("[data-wrap-tabs-menu]");
    if (!(reopenedTabsMenu instanceof HTMLElement)) {
      throw new Error("Expected the reopened tabs overflow menu.");
    }
    expect(
      Array.from(reopenedTabsMenu.querySelectorAll(".wrap-tabs-menu-item.active")).some(
        (item) => item.textContent?.trim() === selectedHiddenLabel,
      ),
    ).toBe(true);

    const tabsRtlToggle = checkboxInBlock(tabsBlock, "RTL");
    expect(tabsRtlToggle.checked).toBe(false);
    tabsRtlToggle.click();
    await settle(4);
    const tabsTriggerAfterRtl = tabsBlock.querySelector("[data-wrap-tabs-trigger]");
    if (!(tabsTriggerAfterRtl instanceof HTMLButtonElement)) {
      throw new Error("Expected the tabs overflow trigger after RTL toggle.");
    }
    expect(tabsTriggerAfterRtl.getAttribute("aria-label")).toBe("إظهار التبويبات المخفية");
    expect(tabsBlock.textContent).toContain("نظرة عامة");
    expect(tabsRtlToggle.checked).toBe(true);

    const inviteesBlock = wrapExampleBlock(mountedPage.container, "invitees");
    const inviteesToggle = inviteesBlock.querySelector("[data-wrap-toggle]");
    if (!(inviteesToggle instanceof HTMLButtonElement)) {
      throw new Error("Expected the invitees wrap toggle.");
    }
    expect(inviteesToggle.textContent?.trim()).toBe("More");
    inviteesToggle.click();
    await settle(4);
    expect(inviteesToggle.textContent?.trim()).toBe("Less");

    const inviteesRtlToggle = checkboxInBlock(inviteesBlock, "RTL");
    expect(inviteesRtlToggle.checked).toBe(false);
    inviteesRtlToggle.click();
    await settle(4);
    expect(inviteesBlock.textContent).toContain("المراجعون");
    expect(inviteesBlock.textContent).toContain("مايا تشن");
    expect(inviteesToggle.textContent?.trim()).toBe("أقل");
    expect(inviteesRtlToggle.checked).toBe(true);
  });

  it("scrolls to the tabs row when its in-flow top edge is above the viewport", async () => {
    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);

    await settle(4);
    await mountedPage.container.ownerDocument.fonts?.ready;
    await selectSurface(mountedPage.container, "wrap");

    const anchor = referenceTabsAnchor(mountedPage.container);
    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const scrollYSpy = vi.spyOn(window, "scrollY", "get").mockReturnValue(640);
    const rectSpy = vi
      .spyOn(anchor, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(0, -240, 0, 0));

    try {
      await selectSurface(mountedPage.container, "inline");

      expect(surfaceTab(mountedPage.container, "inline").getAttribute("aria-pressed")).toBe("true");
      expect(scrollToSpy).toHaveBeenCalledWith({
        top: 400,
      });
    } finally {
      rectSpy.mockRestore();
      scrollYSpy.mockRestore();
      scrollToSpy.mockRestore();
    }
  });

  it("does not scroll when the tabs row in-flow top edge is already in view", async () => {
    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);

    await settle(4);
    await mountedPage.container.ownerDocument.fonts?.ready;

    const anchor = referenceTabsAnchor(mountedPage.container);
    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const rectSpy = vi
      .spyOn(anchor, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(0, 120, 0, 0));

    try {
      await selectSurface(mountedPage.container, "wrap");

      expect(surfaceTab(mountedPage.container, "wrap").getAttribute("aria-pressed")).toBe("true");
      expect(scrollToSpy).not.toHaveBeenCalled();
    } finally {
      rectSpy.mockRestore();
      scrollToSpy.mockRestore();
    }
  });

  it("makes the component tabs horizontally scrollable at mobile widths", async () => {
    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);

    mountedPage.container.style.width = "360px";

    await settle(4);
    await mountedPage.container.ownerDocument.fonts?.ready;
    await settle(2);

    const tabsScroll = componentTabsScroll(mountedPage.container);
    const lineTab = surfaceTab(mountedPage.container, "line");

    expect(tabsScroll.hasAttribute("data-overlayscrollbars")).toBe(false);
    expect(getComputedStyle(tabsScroll).overflowX).toBe("auto");
    expect(getComputedStyle(tabsScroll).overflowY).toBe("hidden");
    expect(tabsScroll.scrollWidth).toBeGreaterThan(tabsScroll.clientWidth);
    expect(getComputedStyle(lineTab).textOverflow).toBe("ellipsis");
    expect(componentTabsMore(mountedPage.container)?.textContent).toContain("More");

    tabsScroll.scrollLeft = 120;
    tabsScroll.dispatchEvent(new Event("scroll"));
    await settle(1);
    expect(tabsScroll.scrollLeft).toBeGreaterThan(0);
    expect(componentTabsMore(mountedPage.container)).not.toBeNull();

    tabsScroll.scrollLeft = tabsScroll.scrollWidth;
    tabsScroll.dispatchEvent(new Event("scroll"));
    await settle(1);
    expect(componentTabsMore(mountedPage.container)).toBeNull();

    await selectSurface(mountedPage.container, "wrap");

    expect(surfaceTab(mountedPage.container, "wrap").getAttribute("aria-pressed")).toBe("true");
  });

  it("introduces the four clamp components in a simple grid guide", async () => {
    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);

    await settle(4);

    const guide = mountedPage.container.querySelector("[data-surface-guide]");
    if (!(guide instanceof HTMLElement)) {
      throw new Error("Expected the surface guide.");
    }

    const guideList = mountedPage.container.querySelector("[data-surface-guide-list]");
    if (!(guideList instanceof HTMLUListElement)) {
      throw new Error("Expected the surface guide list.");
    }

    expect(guide.textContent).toContain("vue-clamp");
    expect(guide.textContent).toContain("four focused components");
    expect(getComputedStyle(guideList).display).toBe("grid");
    expect(surfaceGuideItem(mountedPage.container, "line").textContent).toContain("Plain-text");
    expect(surfaceGuideItem(mountedPage.container, "rich").textContent).toContain(
      "Trusted inline HTML clamp",
    );
    expect(surfaceGuideItem(mountedPage.container, "wrap").textContent).toContain(
      "Wrapped item clamp",
    );
    expect(surfaceGuideLink(mountedPage.container, "line").getAttribute("href")).toBe(
      "#line-clamp",
    );
    expect(surfaceGuideLink(mountedPage.container, "rich").getAttribute("href")).toBe(
      "#rich-line-clamp",
    );
  });

  it("syncs the active component surface with route hashes", async () => {
    replaceRouteHash("#rich-line-clamp");

    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);

    await settle(4);

    expect(surfaceTab(mountedPage.container, "rich").getAttribute("aria-pressed")).toBe("true");
    expect(surfaceTab(mountedPage.container, "rich").id).toBe("rich-line-clamp");

    await selectSurface(mountedPage.container, "wrap");

    expect(window.location.hash).toBe("#wrap-clamp");
    expect(surfaceTab(mountedPage.container, "wrap").getAttribute("aria-pressed")).toBe("true");

    replaceRouteHash("#installation");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await settle(2);

    expect(surfaceTab(mountedPage.container, "wrap").getAttribute("aria-pressed")).toBe("true");

    replaceRouteHash("#line-clamp");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await settle(2);

    expect(surfaceTab(mountedPage.container, "line").getAttribute("aria-pressed")).toBe("true");
  });

  it("initializes overlay scrollbars for shared horizontal containers", async () => {
    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);

    await settle(4);

    const firstDemoPreview = mountedPage.container.querySelector(".demo-preview");
    const codeScroll = mountedPage.container.querySelector("[data-code-scroll]");

    expect(firstDemoPreview).toBeInstanceOf(HTMLElement);
    expect(codeScroll).toBeInstanceOf(HTMLElement);
    expect((firstDemoPreview as HTMLElement).hasAttribute("data-overlayscrollbars")).toBe(true);
    expect((codeScroll as HTMLElement).hasAttribute("data-overlayscrollbars")).toBe(true);
  });

  it("surfaces concise API summaries for all components", async () => {
    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);

    await settle(4);

    const lineSummary = referenceShell(mountedPage.container).querySelector(
      '[data-api-summary="line"]',
    );
    if (!(lineSummary instanceof HTMLElement)) {
      throw new Error("Expected the LineClamp API summary.");
    }
    expect(lineSummary.textContent).toContain("max-lines");
    expect(lineSummary.textContent).toContain("max-height");
    expect(lineSummary.textContent).toContain("plain text");

    await selectSurface(mountedPage.container, "rich");

    const richSummary = referenceShell(mountedPage.container).querySelector(
      '[data-api-summary="rich"]',
    );
    if (!(richSummary instanceof HTMLElement)) {
      throw new Error("Expected the RichLineClamp API summary.");
    }
    expect(richSummary.textContent).toContain("trusted inline HTML");
    expect(richSummary.textContent).toContain("nested inline emphasis");
    expect(richSummary.textContent).toContain("best-effort inline-flow runtime");
    expect(richSummary.textContent).toContain("raw HTML");

    await selectSurface(mountedPage.container, "inline");

    const inlineSummary = referenceShell(mountedPage.container).querySelector(
      '[data-api-summary="inline"]',
    );
    if (!(inlineSummary instanceof HTMLElement)) {
      throw new Error("Expected the InlineClamp API summary.");
    }
    expect(inlineSummary.textContent).toContain("single-line text");
    expect(inlineSummary.textContent).toContain("no slots or events");
    expect(inlineSummary.textContent).toContain("split(text)");
    expect(inlineSummary.textContent).toContain("body");

    await selectSurface(mountedPage.container, "wrap");

    const wrapSummary = referenceShell(mountedPage.container).querySelector(
      '[data-api-summary="wrap"]',
    );
    if (!(wrapSummary instanceof HTMLElement)) {
      throw new Error("Expected the WrapClamp API summary.");
    }
    expect(wrapSummary.textContent).toContain("wrapped items");
    expect(wrapSummary.textContent).toContain("after");
    expect(wrapSummary.textContent).toContain("Less");
  });

  it("animates the hero tagline width at mobile content widths", async () => {
    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);

    mountedPage.container.style.width = "375px";

    await settle(4);
    await mountedPage.container.ownerDocument.fonts?.ready;
    await settle(2);

    const tagline = heroTagline(mountedPage.container);
    const delta = await waitForHeroTaglineShrink(tagline, 8);
    expect(delta).toBeGreaterThan(8);

    const suffixOverflow = await maxHeroTaglineSuffixOverflow(mountedPage.container);
    expect(suffixOverflow.sawCollapsed).toBe(true);
    expect(suffixOverflow.maxOverflow).toBeLessThanOrEqual(0.5);
  });

  it("copies installation and example code from the website code blocks", async () => {
    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);
    const clipboardWrites: string[] = [];

    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          clipboardWrites.push(text);
        },
      },
    });

    await settle(4);

    const installButton = copyButton(mountedPage.container, "install");
    installButton.click();
    await settle(2);

    expect(clipboardWrites[0]).toBe("npm install vue-clamp");
    expect(installButton.getAttribute("data-copy-state")).toBe("copied");
    expect(installButton.getAttribute("aria-label")).toBe("installation command copied");

    const bunTab = mountedPage.container.querySelector<HTMLButtonElement>(
      "button.install-tab:nth-child(5)",
    );
    if (!bunTab) {
      throw new Error("Expected the Bun install tab.");
    }
    bunTab.click();
    await settle(2);

    installButton.click();
    await settle(2);

    expect(clipboardWrites[1]).toBe("bun add vue-clamp");

    const lineExampleButton = copyButton(mountedPage.container, "line-example");
    lineExampleButton.click();
    await settle(2);

    expect(clipboardWrites[2]).toContain("import { LineClamp } from 'vue-clamp'");
    expect(clipboardWrites[2]).toContain(':text="text"');

    await selectSurface(mountedPage.container, "rich");

    const richExampleButton = copyButton(mountedPage.container, "rich-example");
    richExampleButton.click();
    await settle(2);

    expect(clipboardWrites[3]).toContain("import { RichLineClamp } from 'vue-clamp'");
    expect(clipboardWrites[3]).toContain(':html="html"');
    expect(richExampleButton.getAttribute("data-copy-state")).toBe("copied");

    await selectSurface(mountedPage.container, "inline");

    const inlineExampleButton = copyButton(mountedPage.container, "inline-example");
    inlineExampleButton.click();
    await settle(2);

    expect(clipboardWrites[4]).toContain("import { InlineClamp } from 'vue-clamp'");
    expect(clipboardWrites[4]).toContain("splitImageFile");
    expect(inlineExampleButton.getAttribute("data-copy-state")).toBe("copied");

    await selectSurface(mountedPage.container, "wrap");

    const wrapExampleButton = copyButton(mountedPage.container, "wrap-example");
    wrapExampleButton.click();
    await settle(2);

    expect(clipboardWrites[5]).toContain("import { WrapClamp } from 'vue-clamp'");
    expect(clipboardWrites[5]).toContain("hiddenItems");
    expect(wrapExampleButton.getAttribute("data-copy-state")).toBe("copied");
  });
});
