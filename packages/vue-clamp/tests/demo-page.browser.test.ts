import { afterEach, describe, expect, it } from "vite-plus/test";
import { createApp } from "vue";
import {
  bestBrowserFitText,
  sampleVisibleLineCounts,
  settle,
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

function workspaceClamp(container: HTMLElement): HTMLElement {
  const clampRoot = container.querySelector('[data-testid="demo-1-clamp"]');
  if (!(clampRoot instanceof HTMLElement)) {
    throw new Error("Expected the workspace clamp root.");
  }

  return clampRoot;
}

function widthInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('[data-testid="demo-1-width"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Expected the workspace width slider.");
  }

  return input;
}

async function setWorkspaceWidth(container: HTMLElement, width: number): Promise<void> {
  const input = widthInput(container);
  input.value = String(width);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
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

      const textNode = clampRoot.querySelector('[role="text"]');
      if (!(textNode instanceof HTMLElement)) {
        throw new Error("Expected the workspace clamp text node.");
      }

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

    const textNode = clampRoot.querySelector('[role="text"]');
    if (!(textNode instanceof HTMLElement)) {
      throw new Error("Expected the workspace clamp text node.");
    }

    const sourceText = textNode.getAttribute("aria-label");
    if (!sourceText) {
      throw new Error("Expected the workspace clamp source text.");
    }

    const current = textNode.textContent ?? "";
    const best = bestBrowserFitText(clampRoot, sourceText, 3);

    expect(await sampleVisibleLineCounts(clampRoot)).toEqual([3, 3, 3]);
    expect(current.length).toBeGreaterThanOrEqual(best.length - 1);
  });
});
