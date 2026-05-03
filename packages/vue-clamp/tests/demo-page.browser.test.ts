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

type DemoSurface = "line" | "rich" | "inline" | "wrap";

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
  const input = container.querySelector("[data-line-width-slider]");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Expected the shared line width slider.");
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
  const input = container.querySelector("[data-rich-hyphens-toggle]");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Expected the shared rich hyphens toggle.");
  }

  return input;
}

function sharedControls(container: HTMLElement, surface: DemoSurface): HTMLElement {
  const controls = container.querySelector(`[data-shared-controls="${surface}"]`);
  if (!(controls instanceof HTMLElement)) {
    throw new Error(`Expected the ${surface} shared controls.`);
  }

  return controls;
}

function sharedControlsToggle(container: HTMLElement, surface: DemoSurface): HTMLButtonElement {
  const toggle = sharedControls(container, surface).querySelector("[data-demo-controls-toggle]");
  if (!(toggle instanceof HTMLButtonElement)) {
    throw new Error(`Expected the ${surface} shared controls toggle.`);
  }

  return toggle;
}

function sharedCheckbox(
  container: HTMLElement,
  surface: DemoSurface,
  label: string,
): HTMLInputElement {
  return checkboxInBlock(sharedControls(container, surface), label);
}

function locationRatioInput(container: HTMLElement): HTMLInputElement {
  const input = locationDemoBlock(container).querySelector("[data-location-ratio-slider]");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Expected the location ratio slider.");
  }

  return input;
}

function locationWidthInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector("[data-line-width-slider]");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Expected the shared line width slider.");
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

function inlineLocationRatioInput(container: HTMLElement): HTMLInputElement {
  const input = inlineDemoBlock(container).querySelector("[data-inline-location-ratio-slider]");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Expected the inline location ratio slider.");
  }

  return input;
}

function inlineLocationPresetButtons(container: HTMLElement): HTMLButtonElement[] {
  return [...inlineDemoBlock(container).querySelectorAll("[data-inline-location-preset]")].filter(
    (button): button is HTMLButtonElement => button instanceof HTMLButtonElement,
  );
}

function inlineLocationPresetButton(container: HTMLElement, preset: string): HTMLButtonElement {
  const button = inlineDemoBlock(container).querySelector(
    `[data-inline-location-preset="${preset}"]`,
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected the ${preset} inline location preset button.`);
  }

  return button;
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

function wrapWidthInput(container: HTMLElement): HTMLInputElement {
  const input = wrapDemoBlock(container).querySelector("[data-wrap-width-slider]");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Expected the shared wrap width slider.");
  }

  return input;
}

function wrapVisibleTabs(block: HTMLElement): string[] {
  return Array.from(block.querySelectorAll(".wrap-tab"))
    .map((tab) => tab.textContent?.trim())
    .filter((label): label is string => Boolean(label));
}

function copyButton(container: ParentNode, blockId: string): HTMLButtonElement {
  const button = container.querySelector(`[data-copy-button="${blockId}"]`);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected the ${blockId} copy button.`);
  }

  return button;
}

function surfaceTab(container: HTMLElement, surface: DemoSurface): HTMLButtonElement {
  const button = container.querySelector(`[data-surface-tab="${surface}"]`);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected the ${surface} surface tab.`);
  }

  return button;
}

function surfaceGuideItem(container: HTMLElement, surface: DemoSurface): HTMLElement {
  const element = container.querySelector(`[data-surface-guide-item="${surface}"]`);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected the ${surface} surface guide item.`);
  }

  return element;
}

function surfaceGuideLink(container: HTMLElement, surface: DemoSurface): HTMLAnchorElement {
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

function surfaceTooltip(container: HTMLElement, surface: DemoSurface): HTMLElement {
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

function heroTaglinePart(container: HTMLElement, part: "start" | "body" | "end"): HTMLElement {
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

async function waitForDocumentElement(document: Document, selector: string): Promise<HTMLElement> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await settle(1);

    const element = document.querySelector(selector);
    if (element instanceof HTMLElement) {
      return element;
    }
  }

  throw new Error(`Expected document element matching ${selector}.`);
}

async function waitForElementAttribute(element: HTMLElement, attribute: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await settle(1);

    if (element.hasAttribute(attribute)) {
      return;
    }
  }

  throw new Error(`Expected ${attribute} on element.`);
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

function heroTaglineWidthDelta(container: HTMLElement): {
  suffixOverflow: number;
  widthDelta: number;
} {
  const tagline = heroTagline(container);
  const start = heroTaglinePart(container, "start");
  const end = heroTaglinePart(container, "end");
  const taglineRect = tagline.getBoundingClientRect();
  const startRect = start.getBoundingClientRect();
  const endRect = end.getBoundingClientRect();

  return {
    suffixOverflow: endRect.right - taglineRect.right,
    widthDelta: taglineRect.width - (endRect.right - startRect.left),
  };
}

async function waitForStableCollapsedHeroTagline(container: HTMLElement): Promise<{
  sawCollapsed: boolean;
  suffixOverflow: number;
  widthDelta: number;
}> {
  let previousWidth: number | null = null;
  let sawCollapsed = false;
  let stableSamples = 0;
  let suffixOverflow = Number.NEGATIVE_INFINITY;
  let widthDelta = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    await waitTime(100);
    await waitFrames(1);

    const tagline = heroTagline(container);
    const body = heroTaglinePart(container, "body");

    if (body.textContent !== "…") {
      previousWidth = null;
      stableSamples = 0;
      continue;
    }

    sawCollapsed = true;
    const currentWidth = tagline.getBoundingClientRect().width;
    stableSamples =
      previousWidth !== null && Math.abs(currentWidth - previousWidth) <= 0.5
        ? stableSamples + 1
        : 0;
    previousWidth = currentWidth;

    const delta = heroTaglineWidthDelta(container);
    suffixOverflow = delta.suffixOverflow;
    widthDelta = delta.widthDelta;

    if (stableSamples >= 2) {
      break;
    }
  }

  return {
    sawCollapsed,
    suffixOverflow,
    widthDelta,
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

async function setWrapWidth(container: HTMLElement, width: number): Promise<void> {
  await setRangeValue(wrapWidthInput(container), width);
}

async function setInlineLocationRatio(container: HTMLElement, ratio: number): Promise<void> {
  await setRangeValue(inlineLocationRatioInput(container), ratio);
}

async function clickLocationPreset(container: HTMLElement, preset: string): Promise<void> {
  locationPresetButton(container, preset).click();
  await settle(4);
}

async function clickInlineLocationPreset(container: HTMLElement, preset: string): Promise<void> {
  inlineLocationPresetButton(container, preset).click();
  await settle(4);
}

async function selectSurface(container: HTMLElement, surface: DemoSurface): Promise<void> {
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

    const lineRtlToggle = sharedCheckbox(mountedPage.container, "line", "RTL");
    expect(lineRtlToggle.checked).toBe(false);
    lineRtlToggle.click();
    await settle(4);

    expect(firstToggle.textContent?.trim()).toBe("المزيد");
    expect(secondBadge.textContent?.trim()).toBe("مميز");
    expect(lineRtlToggle.checked).toBe(true);

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
    expect(richRoots.every((root) => root.classList.contains("hyphens"))).toBe(true);
    expect(block.textContent).toContain("Trusted or sanitized inline HTML only");
    expect(block.textContent).toContain("makes a best-effort pass");
    expect(block.textContent).toContain("inline-flow markup");
    expect(block.textContent).toContain("always clamps from the end");
    expect(maxHeightBlock.querySelector(".badge")).toBeInstanceOf(HTMLElement);
    expect(clampChangeBlock.querySelector(".clamp-status")).toBeInstanceOf(HTMLElement);

    richHyphensToggle(mountedPage.container).click();
    await settle(2);

    expect(richHyphensToggle(mountedPage.container).checked).toBe(false);
    expect(richRoots.every((root) => root.classList.contains("hyphens"))).toBe(false);

    richHyphensToggle(mountedPage.container).click();
    await settle(2);

    expect(richHyphensToggle(mountedPage.container).checked).toBe(true);
    expect(richRoots.every((root) => root.classList.contains("hyphens"))).toBe(true);

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
    expect(referencePanelNames(mountedPage.container)).toEqual([
      "overview",
      "demo",
      "stress",
      "example",
      "api",
    ]);
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
      inlineLocationPresetButtons(mountedPage.container).map(
        (button) => button.dataset.inlineLocationPreset,
      ),
    ).toEqual(["start", "middle", "end"]);
    expect(inlineLocationRatioInput(mountedPage.container).value).toBe("1");
    expect(
      inlineLocationPresetButton(mountedPage.container, "end").getAttribute("aria-pressed"),
    ).toBe("true");

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
    expect(splitFileListClamp?.getBoundingClientRect().width).toBeLessThanOrEqual(221);
    if (!(splitFileListBody instanceof HTMLElement)) {
      throw new Error("Expected the split file-list body element.");
    }
    expect(splitFileListBody.textContent?.endsWith("…")).toBe(true);

    await clickInlineLocationPreset(mountedPage.container, "middle");

    expect(inlineLocationRatioInput(mountedPage.container).value).toBe("0.5");
    expect(
      inlineLocationPresetButton(mountedPage.container, "middle").getAttribute("aria-pressed"),
    ).toBe("true");
    expect(splitFileListBody.textContent).toContain("…");
    expect(splitFileListBody.textContent?.startsWith("…")).toBe(false);
    expect(splitFileListBody.textContent?.endsWith("…")).toBe(false);

    await setInlineLocationRatio(mountedPage.container, 0);

    expect(inlineLocationRatioInput(mountedPage.container).value).toBe("0");
    expect(splitFileListBody.textContent?.startsWith("…")).toBe(true);

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
    expect(referencePanelNames(mountedPage.container)).toEqual([
      "overview",
      "demo",
      "stress",
      "example",
      "api",
    ]);
    expect(mountedPage.container.querySelector('[data-demo="location"]')).toBeInstanceOf(
      HTMLElement,
    );

    await selectSurface(mountedPage.container, "wrap");
    await setWrapWidth(mountedPage.container, 280);

    expect(surfaceTab(mountedPage.container, "line").getAttribute("aria-pressed")).toBe("false");
    expect(surfaceTab(mountedPage.container, "rich").getAttribute("aria-pressed")).toBe("false");
    expect(surfaceTab(mountedPage.container, "inline").getAttribute("aria-pressed")).toBe("false");
    expect(surfaceTab(mountedPage.container, "wrap").getAttribute("aria-pressed")).toBe("true");
    expect(referencePanelNames(mountedPage.container)).toEqual([
      "overview",
      "demo",
      "stress",
      "example",
      "api",
    ]);
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

    const wrapRtlToggle = sharedCheckbox(mountedPage.container, "wrap", "RTL");
    expect(wrapRtlToggle.checked).toBe(false);
    wrapRtlToggle.click();
    await settle(4);
    const tabsTriggerAfterRtl = tabsBlock.querySelector("[data-wrap-tabs-trigger]");
    if (!(tabsTriggerAfterRtl instanceof HTMLButtonElement)) {
      throw new Error("Expected the tabs overflow trigger after RTL toggle.");
    }
    expect(tabsTriggerAfterRtl.getAttribute("aria-label")).toBe("إظهار التبويبات المخفية");
    expect(tabsBlock.textContent).toContain("نظرة عامة");
    expect(wrapRtlToggle.checked).toBe(true);

    const inviteesBlock = wrapExampleBlock(mountedPage.container, "invitees");
    const inviteesToggle = inviteesBlock.querySelector("[data-wrap-toggle]");
    if (!(inviteesToggle instanceof HTMLButtonElement)) {
      throw new Error("Expected the invitees wrap toggle.");
    }
    expect(inviteesToggle.textContent?.trim()).toBe("المزيد");
    inviteesToggle.click();
    await settle(4);
    expect(inviteesToggle.textContent?.trim()).toBe("أقل");
    expect(inviteesBlock.textContent).toContain("المراجعون");
    expect(inviteesBlock.textContent).toContain("مايا تشن");
  });

  it("keeps shared demo controls sticky under the component tabs", async () => {
    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);

    await settle(4);

    const rootStyle = getComputedStyle(mountedPage.container.ownerDocument.documentElement);
    const componentTabsHeight = rootStyle.getPropertyValue("--component-tabs-height").trim();

    const expectedLabels: Record<DemoSurface, string[]> = {
      inline: ["Location", "Boundary", "Ratio", "Width"],
      line: ["Boundary", "Width", "CSS Hyphens", "RTL"],
      rich: ["Boundary", "Width", "CSS Hyphens"],
      wrap: ["Width", "RTL"],
    };

    for (const surface of ["line", "rich", "inline", "wrap"] as const) {
      await selectSurface(mountedPage.container, surface);

      const controls = sharedControls(mountedPage.container, surface);
      const style = getComputedStyle(controls);
      const toggle = sharedControlsToggle(mountedPage.container, surface);

      expect(style.position).toBe("sticky");
      expect(style.top).toBe(componentTabsHeight);
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(toggle.getAttribute("aria-label")).toBe("Expand demo controls");
      expect(toggle.textContent).toContain("Demo controls");

      for (const label of expectedLabels[surface]) {
        expect(controls.textContent).toContain(label);
      }
    }

    await selectSurface(mountedPage.container, "line");
    const lineToggle = sharedControlsToggle(mountedPage.container, "line");
    lineToggle.click();
    await settle(1);
    expect(lineToggle.getAttribute("aria-expanded")).toBe("true");
    expect(lineToggle.getAttribute("aria-label")).toBe("Collapse demo controls");

    await selectSurface(mountedPage.container, "rich");

    expect(sharedControlsToggle(mountedPage.container, "rich").getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  it("opens a stress playground with fps and workload controls", async () => {
    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);

    await settle(4);
    await selectSurface(mountedPage.container, "wrap");

    const document = mountedPage.container.ownerDocument;
    const openButton = mountedPage.container.querySelector("[data-stress-playground-open]");
    if (!(openButton instanceof HTMLButtonElement)) {
      throw new Error("Expected the stress playground open button.");
    }

    expect(document.querySelector("[data-stress-playground]")).toBeNull();

    openButton.click();

    const playground = await waitForDocumentElement(document, "[data-stress-playground]");
    await settle(2);
    expect(playground).toBeInstanceOf(HTMLElement);
    expect(
      document.querySelector('[data-stress-surface="wrap"]')?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      document
        .querySelector("[data-stress-surface-item]")
        ?.getAttribute("data-stress-surface-item"),
    ).toBe("wrap");
    expect(document.querySelector("[data-fps-meter] canvas")).toBeInstanceOf(HTMLCanvasElement);
    expect(document.querySelectorAll("[data-stress-item]")).toHaveLength(10);
    expect(
      document
        .querySelector("[data-stress-modal-scroll]")
        ?.hasAttribute("data-overlayscrollbars-initialize"),
    ).toBe(true);
    expect(
      document
        .querySelector("[data-stress-workload]")
        ?.hasAttribute("data-overlayscrollbars-initialize"),
    ).toBe(true);
    expect(document.body.style.position).toBe("fixed");
    expect(document.documentElement.style.overflow).toBe("hidden");

    const meter = document.querySelector("[data-fps-meter]");
    const countSlider = document.querySelector("[data-stress-count-slider]");
    const widthSlider = document.querySelector("[data-stress-width-slider]");
    const payloadSlider = document.querySelector("[data-stress-payload-slider]");
    const maxLinesSlider = document.querySelector("[data-stress-max-lines-slider]");

    for (const slider of [countSlider, widthSlider, payloadSlider, maxLinesSlider]) {
      expect(slider).toBeInstanceOf(HTMLInputElement);
    }
    expect(document.querySelector("[data-stress-max-height-slider]")).toBeNull();
    expect(
      document.querySelector('[data-stress-limit-mode="lines"]')?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(document.querySelector("[data-stress-native-status]")).toBeNull();

    expect(meter).toBeInstanceOf(HTMLElement);

    (countSlider as HTMLInputElement).value = "1.3";
    countSlider?.dispatchEvent(new Event("input", { bubbles: true }));
    await settle(2);

    expect(document.querySelector("[data-stress-count]")?.textContent).toBe("20");
    expect(document.querySelectorAll("[data-stress-item]")).toHaveLength(20);

    expect(document.querySelector("[data-stress-payload]")?.textContent).toBe("24 items");
    (payloadSlider as HTMLInputElement).value = "5";
    payloadSlider?.dispatchEvent(new Event("input", { bubbles: true }));
    await settle(1);
    expect(document.querySelector("[data-stress-payload]")?.textContent).toBe("40 items");

    const lineSurfaceButton = document.querySelector('[data-stress-surface="line"]');
    if (!(lineSurfaceButton instanceof HTMLButtonElement)) {
      throw new Error("Expected the LineClamp stress surface button.");
    }
    lineSurfaceButton.click();
    await settle(2);
    expect(lineSurfaceButton.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector("[data-stress-payload]")?.textContent).toBe("5x text");
    expect(
      document
        .querySelector("[data-stress-surface-item]")
        ?.getAttribute("data-stress-surface-item"),
    ).toBe("line");

    (widthSlider as HTMLInputElement).value = "520";
    widthSlider?.dispatchEvent(new Event("input", { bubbles: true }));
    (maxLinesSlider as HTMLInputElement).value = "1";
    maxLinesSlider?.dispatchEvent(new Event("input", { bubbles: true }));
    await settle(1);

    const nativeStatus = document.querySelector("[data-stress-native-status]");
    expect(nativeStatus).toBeInstanceOf(HTMLElement);
    expect(nativeStatus?.getAttribute("data-stress-native-mode")).toBe("single-line");
    expect(nativeStatus?.textContent?.trim()).toBe("Native");
    expect(nativeStatus?.getAttribute("title")).toBe("Native CSS text-overflow");

    (maxLinesSlider as HTMLInputElement).value = "5";
    maxLinesSlider?.dispatchEvent(new Event("input", { bubbles: true }));
    await settle(1);

    expect(document.querySelector("[data-stress-width]")?.textContent).toBe("520px");
    expect(document.querySelector("[data-stress-max-lines]")?.textContent).toBe("5");

    const heightModeButton = document.querySelector('[data-stress-limit-mode="height"]');
    if (!(heightModeButton instanceof HTMLButtonElement)) {
      throw new Error("Expected the height stress limit mode button.");
    }
    heightModeButton.click();
    await settle(2);

    expect(heightModeButton.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector("[data-stress-max-lines-slider]")).toBeNull();
    expect(document.querySelector("[data-stress-native-status]")).toBeNull();
    const maxHeightSlider = document.querySelector("[data-stress-max-height-slider]");
    expect(maxHeightSlider).toBeInstanceOf(HTMLInputElement);

    expect(document.querySelector("[data-stress-max-height]")?.textContent).toBe("96px");
    (maxHeightSlider as HTMLInputElement).value = "140";
    maxHeightSlider?.dispatchEvent(new Event("input", { bubbles: true }));
    await settle(1);

    expect(document.querySelector("[data-stress-max-height]")?.textContent).toBe("140px");
    expect(document.querySelector("[data-stress-item]")?.getAttribute("data-stress-item")).toBe(
      "height",
    );

    const closeButton = document.querySelector("[data-stress-close]");
    if (!(closeButton instanceof HTMLButtonElement)) {
      throw new Error("Expected the stress playground close button.");
    }
    closeButton.click();
    await settle(1);

    expect(document.querySelector("[data-stress-playground]")).toBeNull();
    expect(document.body.style.position).toBe("");
    expect(document.documentElement.style.overflow).toBe("");
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
    await waitForElementAttribute(firstDemoPreview as HTMLElement, "data-overlayscrollbars");
    await waitForElementAttribute(codeScroll as HTMLElement, "data-overlayscrollbars");
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
    expect(referenceShell(mountedPage.container).querySelector('[data-alert="line"]')).toBeNull();

    await selectSurface(mountedPage.container, "rich");

    const richSummary = referenceShell(mountedPage.container).querySelector(
      '[data-api-summary="rich"]',
    );
    if (!(richSummary instanceof HTMLElement)) {
      throw new Error("Expected the RichLineClamp API summary.");
    }
    expect(richSummary.textContent).toContain("trusted inline HTML");
    expect(richSummary.textContent).toContain("line breaks");
    expect(richSummary.textContent).toContain("clamps from the end");
    const richNotice = referenceShell(mountedPage.container).querySelector('[data-alert="rich"]');
    if (!(richNotice instanceof HTMLElement)) {
      throw new Error("Expected the RichLineClamp alert.");
    }
    expect(richNotice.querySelector(".alert-icon")).toBeInstanceOf(SVGSVGElement);
    expect(richNotice.textContent).toContain("HTML input contract");
    expect(richNotice.textContent).toContain("Sanitize untrusted input");
    expect(richNotice.textContent).toContain("HTML Sanitizer API");
    expect(richNotice.textContent).toContain("DOMPurify");
    expect(richNotice.textContent).toContain("sentence-like HTML");
    expect(richNotice.textContent).toContain("can trim through");
    expect(richNotice.textContent).toContain("Atomic inline content stays whole");
    expect(richNotice.textContent).toContain("<img>");
    expect(richNotice.textContent).toContain("inline <svg>");
    expect(richNotice.textContent).toContain("display: inline-block");
    expect(richNotice.textContent).toContain("display: inline-flex");
    expect(richNotice.textContent).toContain("display: block");
    expect(richNotice.textContent).toContain("display: flex");
    expect(richNotice.textContent).toContain("display: grid");
    expect(richNotice.textContent).toContain("absolute/fixed positioning");
    expect(richNotice.textContent).toContain("reserve space before load");
    expect(richNotice.textContent).toContain("aspect-ratio");

    await selectSurface(mountedPage.container, "inline");

    const inlineSummary = referenceShell(mountedPage.container).querySelector(
      '[data-api-summary="inline"]',
    );
    if (!(inlineSummary instanceof HTMLElement)) {
      throw new Error("Expected the InlineClamp API summary.");
    }
    expect(inlineSummary.textContent).toContain("one-line strings");
    expect(inlineSummary.textContent).toContain("beginning, ending, or both");
    expect(inlineSummary.textContent).toContain("filenames");
    expect(inlineSummary.textContent).toContain("paths");
    expect(inlineSummary.textContent).toContain("email addresses");
    expect(referenceShell(mountedPage.container).querySelector('[data-alert="inline"]')).toBeNull();

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
    expect(referenceShell(mountedPage.container).querySelector('[data-alert="wrap"]')).toBeNull();
  });

  it("animates the hero tagline width at mobile content widths", async () => {
    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);

    mountedPage.container.style.width = "375px";

    await settle(4);
    await mountedPage.container.ownerDocument.fonts?.ready;
    await settle(2);

    const tagline = heroTagline(mountedPage.container);
    const expanded = heroTaglineWidthDelta(mountedPage.container);
    expect(expanded.suffixOverflow).toBeLessThanOrEqual(-72);
    expect(expanded.widthDelta).toBeGreaterThanOrEqual(72);
    expect(expanded.widthDelta).toBeLessThanOrEqual(88);

    const delta = await waitForHeroTaglineShrink(tagline, 8);
    expect(delta).toBeGreaterThan(8);

    const collapsed = await waitForStableCollapsedHeroTagline(mountedPage.container);
    expect(collapsed.sawCollapsed).toBe(true);
    expect(collapsed.suffixOverflow).toBeLessThanOrEqual(0.5);
    expect(Math.abs(collapsed.widthDelta)).toBeLessThanOrEqual(0.75);
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
