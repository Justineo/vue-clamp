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

async function clickLocationPreset(container: HTMLElement, preset: string): Promise<void> {
  locationPresetButton(container, preset).click();
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
});
