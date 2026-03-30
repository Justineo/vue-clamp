import { afterEach, describe, expect, it } from "vite-plus/test";
import { h } from "vue";
import {
  afterElement,
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

afterEach(() => {
  cleanupMounted();
});

describe("Clamp browser contract", () => {
  it("renders the plain-text slot content and mirrors it to aria-label", async () => {
    const mounted = mountClamp({
      text: "abcdefghijklmno",
    });

    await settle();

    const textNode = textElement(rootElement(mounted.container));
    expect(textNode.getAttribute("role")).toBe("text");
    expect(textNode.textContent).toBe("abcdefghijklmno");
    expect(textNode.getAttribute("aria-label")).toBe("abcdefghijklmno");
  });

  it("collects plain-text slot content across multiple text nodes", async () => {
    const mounted = mountClamp({
      defaultSlot: () => ["alpha", " ", "beta"],
    });

    await settle();

    const textNode = textElement(rootElement(mounted.container));
    expect(textNode.textContent).toBe("alpha beta");
    expect(textNode.getAttribute("aria-label")).toBe("alpha beta");
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

  it("hides collapsed content until the first measured clamp result is ready", async () => {
    const mounted = mountClamp({
      text: "abcdefghijklmnopqrstuvwxyz",
      props: {
        maxLines: 1,
      },
    });

    const root = rootElement(mounted.container);
    expect(root.style.visibility).toBe("hidden");

    await waitUntilVisible(root);

    expect(root.style.visibility).toBe("");
    expect(textElement(root).textContent).toContain("…");
  });

  it("stays hidden until a hidden zero-width mount becomes measurable", async () => {
    const mounted = mountClamp({
      text: "abcdefghijklmnopqrstuvwxyz",
      width: 0,
      props: {
        maxLines: 1,
      },
    });

    const root = rootElement(mounted.container);
    await settle();
    expect(root.style.visibility).toBe("hidden");

    mounted.width.value = 160;
    await waitUntilVisible(root);

    expect(root.style.visibility).toBe("");
    expect(textElement(root).textContent).toContain("…");
  });

  it("clips collapsed max-lines content with a measured max-height", async () => {
    const mounted = mountClamp({
      text: "abcdefghijklmnopqrstuvwxyz",
      props: {
        maxLines: 2,
      },
    });

    await waitUntilVisible(rootElement(mounted.container));

    expect(rootElement(mounted.container).style.maxHeight).toBe("40px");
  });

  it("adds vertical border-box chrome to the derived max-height", async () => {
    const mounted = mountClamp({
      text: "abcdefghijklmnopqrstuvwxyz",
      style: "box-sizing:border-box;padding-top:8px;padding-bottom:12px",
      props: {
        maxLines: 2,
      },
    });

    await waitUntilVisible(rootElement(mounted.container));

    expect(rootElement(mounted.container).style.maxHeight).toBe("60px");
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

  it("emits only the real initial clamp state once it is known", async () => {
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

    expect(values).toEqual([true]);
  });
});
