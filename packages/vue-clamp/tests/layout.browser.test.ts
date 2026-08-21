import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  borderBoxObserverOptions,
  borderBoxSizeSnapshot,
  borderBoxSizeSignature,
  borderBoxWidth,
  emptyBorderBoxSignature,
  hasBorderBoxEntrySignatureChange,
  listenForFontLoads,
  observedBorderBoxSizeSnapshot,
} from "../src/layout.ts";

const mounted = new Set<HTMLElement>();
const subpixelBoxStyle = "width:120.25px;height:40px";
const transformedSubpixelBoxStyle = `${subpixelBoxStyle};transform:scale(0.5);transform-origin:0 0`;

function mountBox(style: string): HTMLElement {
  const box = document.createElement("div");
  box.style.cssText = style;
  document.body.append(box);
  mounted.add(box);

  return box;
}

function mountSubpixelBox(): HTMLElement {
  return mountBox(subpixelBoxStyle);
}

function mountTransformedSubpixelBox(): HTMLElement {
  return mountBox(transformedSubpixelBoxStyle);
}

function expectSubpixelWidth(width: number, box: HTMLElement): void {
  expect(width).toBe(box.getBoundingClientRect().width);
  expect(Number.isInteger(width)).toBe(false);
  expect(width).not.toBe(box.offsetWidth);
}

function hasEntrySignatureChange(
  entry: ResizeObserverEntry,
  element: HTMLElement,
  previousSignature: string,
): boolean {
  return hasBorderBoxEntrySignatureChange([entry], (target) =>
    target === element ? previousSignature : null,
  );
}

function nextResizeEntry(element: HTMLElement): Promise<ResizeObserverEntry> {
  return new Promise((resolve) => {
    const observer = new ResizeObserver((entries) => {
      const entry = entries.find((entry) => entry.target === element);
      if (!entry) {
        return;
      }

      observer.disconnect();
      resolve(entry);
    });

    observer.observe(element, borderBoxObserverOptions);
  });
}

afterEach(() => {
  for (const element of mounted) {
    element.remove();
  }

  mounted.clear();
});

describe("layout helpers", () => {
  it("stops pending font-load callbacks", async () => {
    let calls = 0;
    const stop = listenForFontLoads(() => {
      calls += 1;
    });

    stop();
    await document.fonts?.ready;
    await Promise.resolve();
    document.fonts?.dispatchEvent(new Event("loadingdone"));

    expect(calls).toBe(0);
  });

  it("preserves subpixel border-box signature changes", () => {
    const box = mountSubpixelBox();
    const previousOffsetWidth = box.offsetWidth;
    const previousSignature = borderBoxSizeSignature(box);

    box.style.width = "120.49px";

    expect(box.offsetWidth).toBe(previousOffsetWidth);
    expect(borderBoxSizeSignature(box)).not.toBe(previousSignature);
  });

  it("preserves subpixel border-box width reads", () => {
    const box = mountSubpixelBox();

    expectSubpixelWidth(borderBoxWidth(box), box);
  });

  it("preserves subpixel border-box snapshot widths", () => {
    const box = mountSubpixelBox();
    const snapshot = borderBoxSizeSnapshot(box);

    expect(snapshot).toEqual({
      signature: borderBoxSizeSignature(box),
      width: box.getBoundingClientRect().width,
    });
    expectSubpixelWidth(snapshot.width, box);
  });

  it("reports subpixel ResizeObserver entry changes", async () => {
    const box = mountSubpixelBox();
    const previousOffsetWidth = box.offsetWidth;
    const previousSignature = borderBoxSizeSignature(box);

    box.style.width = "120.49px";
    const entry = await nextResizeEntry(box);

    expect(box.offsetWidth).toBe(previousOffsetWidth);
    expect(hasEntrySignatureChange(entry, box, previousSignature)).toBe(true);
  });

  it("compares transformed ResizeObserver entries against visual border boxes", async () => {
    const box = mountTransformedSubpixelBox();
    const previousSignature = borderBoxSizeSignature(box);
    const entry = await nextResizeEntry(box);

    expect(hasEntrySignatureChange(entry, box, previousSignature)).toBe(false);
  });

  it("uses visual snapshots for transformed subpixel ResizeObserver entries", async () => {
    const box = mountTransformedSubpixelBox();
    const entry = await nextResizeEntry(box);
    const snapshot = observedBorderBoxSizeSnapshot(entry, emptyBorderBoxSignature);
    if (!snapshot) {
      throw new Error("Expected transformed ResizeObserver border-box snapshot");
    }

    expect(snapshot).toEqual({
      signature: borderBoxSizeSignature(box),
      width: box.getBoundingClientRect().width,
    });
    expectSubpixelWidth(snapshot.width, box);
  });

  it("uses entry snapshots for ordinary ResizeObserver entries", async () => {
    const box = mountBox("width:120px;height:40px");
    const entry = await nextResizeEntry(box);
    const snapshot = observedBorderBoxSizeSnapshot(entry, emptyBorderBoxSignature);

    expect(snapshot).toEqual({
      signature: borderBoxSizeSignature(box),
      width: 120,
    });
  });

  it("preserves subpixel ResizeObserver snapshot widths", async () => {
    const box = mountSubpixelBox();
    const entry = await nextResizeEntry(box);
    const snapshot = observedBorderBoxSizeSnapshot(entry, emptyBorderBoxSignature);
    if (!snapshot) {
      throw new Error("Expected ResizeObserver border-box snapshot");
    }

    expect(snapshot).toEqual({
      signature: borderBoxSizeSignature(box),
      width: box.getBoundingClientRect().width,
    });
    expectSubpixelWidth(snapshot.width, box);
  });

  it("still reports transformed ResizeObserver entries when visual size changes", async () => {
    const box = mountBox("width:120px;height:40px;transform:scale(0.5);transform-origin:0 0");
    const previousSignature = borderBoxSizeSignature(box);

    box.style.width = "160px";
    const entry = await nextResizeEntry(box);

    expect(hasEntrySignatureChange(entry, box, previousSignature)).toBe(true);
  });

  it("does not cache an untransformed comparison across a later transform change", async () => {
    const box = mountBox("width:120px;height:40px;transform-origin:0 0");
    const entry = await nextResizeEntry(box);

    expect(hasBorderBoxEntrySignatureChange([entry], () => emptyBorderBoxSignature)).toBe(true);

    box.style.transform = "scale(0.5)";
    const transformedSignature = borderBoxSizeSignature(box);

    expect(hasEntrySignatureChange(entry, box, transformedSignature)).toBe(false);
  });
});
