import { afterEach, describe, expect, it } from "vite-plus/test";
import { createApp } from "vue";
import {
  accessibleTextElement,
  bestBrowserFitText,
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

function workspaceDemoBlock(container: HTMLElement): HTMLElement {
  const blocks = container.querySelectorAll(".demo-block");
  const block = blocks.item(0);
  if (!(block instanceof HTMLElement)) {
    throw new Error("Expected the first demo block.");
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
  return Array.from(locationDemoBlock(container).querySelectorAll("[data-location-preset]")).filter(
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
  return Array.from(inlineDemoBlock(container).querySelectorAll("[data-inline-example]")).filter(
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

function copyButton(container: ParentNode, blockId: string): HTMLButtonElement {
  const button = container.querySelector(`[data-copy-button="${blockId}"]`);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected the ${blockId} copy button.`);
  }

  return button;
}

function surfaceTab(container: HTMLElement, surface: "line" | "inline"): HTMLButtonElement {
  const button = container.querySelector(`[data-surface-tab="${surface}"]`);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected the ${surface} surface tab.`);
  }

  return button;
}

function surfaceTooltip(container: HTMLElement, surface: "line" | "inline"): HTMLElement {
  const tooltip = container.querySelector(`[data-surface-tooltip="${surface}"]`);
  if (!(tooltip instanceof HTMLElement)) {
    throw new Error(`Expected the ${surface} surface tooltip.`);
  }

  return tooltip;
}

function referenceShell(container: HTMLElement): HTMLElement {
  const shell = container.querySelector("[data-reference-shell]");
  if (!(shell instanceof HTMLElement)) {
    throw new Error("Expected the shared reference shell.");
  }

  return shell;
}

function referencePanelNames(container: HTMLElement): string[] {
  return Array.from(referenceShell(container).querySelectorAll("[data-reference-panel]")).map(
    (panel) => panel.getAttribute("data-reference-panel") ?? "",
  );
}

async function setRangeValue(input: HTMLInputElement, value: number): Promise<void> {
  input.value = String(value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await settle(4);
}

async function setWorkspaceWidth(container: HTMLElement, width: number): Promise<void> {
  await setRangeValue(widthInput(container), width);
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

async function selectSurface(container: HTMLElement, surface: "line" | "inline"): Promise<void> {
  surfaceTab(container, surface).click();
  await settle(4);
}

afterEach(() => {
  for (const mountedPage of mounted) {
    mountedPage.app.unmount();
    mountedPage.container.remove();
  }

  mounted.clear();
});

describe("Website demo page", () => {
  it("keeps the inline toggle workspace example within three visible lines at 585px", async () => {
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

  it("keeps inline-toggle clamp text monotonic while shrinking through the narrow edge widths", async () => {
    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);

    await settle(4);
    await mountedPage.container.ownerDocument.fonts?.ready;

    let previousLength = Number.POSITIVE_INFINITY;
    const failures: string[] = [];

    for (let width = 330; width >= 315; width -= 1) {
      await setWorkspaceWidth(mountedPage.container, width);

      const clampRoot = workspaceClamp(mountedPage.container);
      await waitUntilVisible(clampRoot);

      const textNode = textElement(clampRoot);
      const currentLength = textNode.textContent?.length ?? 0;
      if (currentLength > previousLength) {
        failures.push(`${width}px: ${currentLength} > ${previousLength}`);
      }

      previousLength = currentLength;
    }

    expect(failures).toEqual([]);
  });

  it("keeps the inline-toggle demo close to the browser-fit maximum at 373px", async () => {
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

  it("shows InlineClamp plain vs split behavior across stacked examples", async () => {
    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);

    await settle(4);
    await mountedPage.container.ownerDocument.fonts?.ready;
    expect(referencePanelNames(mountedPage.container)).toEqual(["demo", "example", "api"]);
    expect(
      referenceShell(mountedPage.container).querySelector(".reference-description"),
    ).toBeNull();
    expect(surfaceTab(mountedPage.container, "line").getAttribute("aria-pressed")).toBe("true");
    expect(surfaceTab(mountedPage.container, "inline").getAttribute("aria-pressed")).toBe("false");
    expect(surfaceTooltip(mountedPage.container, "line").textContent).toBe(
      "Multiline browser-fit clamp with slots, expansion, and ratio-based ellipsis.",
    );
    expect(surfaceTooltip(mountedPage.container, "inline").textContent).toBe(
      "Native single-line clamp with optional split(text) semantics for fixed edges.",
    );
    expect(surfaceTab(mountedPage.container, "line").getAttribute("aria-describedby")).toBe(
      "component-tab-tooltip-line",
    );
    expect(surfaceTab(mountedPage.container, "inline").getAttribute("aria-describedby")).toBe(
      "component-tab-tooltip-inline",
    );

    await selectSurface(mountedPage.container, "inline");
    await setInlineWidth(mountedPage.container, 220);

    expect(surfaceTab(mountedPage.container, "line").getAttribute("aria-pressed")).toBe("false");
    expect(surfaceTab(mountedPage.container, "inline").getAttribute("aria-pressed")).toBe("true");
    expect(mountedPage.container.querySelector('[data-demo="location"]')).toBeNull();

    expect(
      inlineExampleBlocks(mountedPage.container).map((block) => block.dataset.inlineExample),
    ).toEqual(["file-list", "email", "path"]);

    const fileListBlock = inlineExampleBlock(mountedPage.container, "file-list");
    const plainFileListRow = inlineRow(fileListBlock, "plain");
    const splitFileListRow = inlineRow(fileListBlock, "split");
    const splitFileListBody = splitFileListRow.querySelector("[data-inline-body]");
    const splitFileListEnd = splitFileListRow.querySelector("[data-inline-end]");
    const splitFileListClamp = splitFileListRow.querySelector(".demo-inline");

    expect(plainFileListRow.querySelector("[data-inline-end]")).toBeNull();
    expect(splitFileListEnd?.textContent).toBe(".jpeg");
    expect(splitFileListClamp?.textContent).toBe("summer-campaign-panorama-final.jpeg");
    if (!(splitFileListBody instanceof HTMLElement)) {
      throw new Error("Expected the split file-list body element.");
    }
    expect(splitFileListBody.scrollWidth).toBeGreaterThan(splitFileListBody.clientWidth);

    const splitEmailRow = inlineRow(inlineExampleBlock(mountedPage.container, "email"), "split");
    expect(splitEmailRow.querySelector("[data-inline-end]")?.textContent).toBe("@acme.dev");

    const splitPathRow = inlineRow(inlineExampleBlock(mountedPage.container, "path"), "split");
    expect(splitPathRow.querySelector("[data-inline-start]")?.textContent).toBe("~/screenshots/");
    expect(splitPathRow.querySelector("[data-inline-end]")?.textContent).toBe(".png");

    await selectSurface(mountedPage.container, "line");

    expect(surfaceTab(mountedPage.container, "line").getAttribute("aria-pressed")).toBe("true");
    expect(surfaceTab(mountedPage.container, "inline").getAttribute("aria-pressed")).toBe("false");
    expect(referencePanelNames(mountedPage.container)).toEqual(["demo", "example", "api"]);
    expect(mountedPage.container.querySelector('[data-demo="location"]')).toBeInstanceOf(
      HTMLElement,
    );
  });

  it("documents when to use each component and surfaces practical API notes", async () => {
    const { default: App } = await import("../../website/src/App.vue");
    const mountedPage = mountPage(App);

    await settle(4);

    const chooseSection = mountedPage.container.querySelector("#choose")?.closest(".section");
    if (!(chooseSection instanceof HTMLElement)) {
      throw new Error("Expected the choose-a-component section.");
    }

    expect(chooseSection.textContent).toContain("Browser-fit multiline clamp.");
    expect(chooseSection.textContent).toContain("Filenames, emails, IDs, and paths.");
    expect(chooseSection.textContent).toContain("Both components are exported from vue-clamp.");

    const lineNotes = referenceShell(mountedPage.container).querySelector(
      '[data-api-notes="line"]',
    );
    if (!(lineNotes instanceof HTMLElement)) {
      throw new Error("Expected the LineClamp API notes.");
    }
    expect(lineNotes.textContent).toContain("max-lines");
    expect(lineNotes.textContent).toContain("max-height");

    await selectSurface(mountedPage.container, "inline");

    const inlineNotes = referenceShell(mountedPage.container).querySelector(
      '[data-api-notes="inline"]',
    );
    if (!(inlineNotes instanceof HTMLElement)) {
      throw new Error("Expected the InlineClamp API notes.");
    }
    expect(inlineNotes.textContent).toContain(
      "InlineClamp is native-only and single-line-only. It does not expose slots, events, or an instance API.",
    );
    expect(inlineNotes.textContent).toContain("split(text)");
    expect(inlineNotes.textContent).toContain("one-line");
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

    const lineExampleButton = copyButton(mountedPage.container, "line-example");
    lineExampleButton.click();
    await settle(2);

    expect(clipboardWrites[1]).toContain("import { LineClamp } from 'vue-clamp'");

    await selectSurface(mountedPage.container, "inline");

    const inlineExampleButton = copyButton(mountedPage.container, "inline-example");
    inlineExampleButton.click();
    await settle(2);

    expect(clipboardWrites[2]).toContain("import { InlineClamp } from 'vue-clamp'");
    expect(clipboardWrites[2]).toContain("splitImageFile");
    expect(inlineExampleButton.getAttribute("data-copy-state")).toBe("copied");
  });
});
