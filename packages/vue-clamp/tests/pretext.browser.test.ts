import { createApp, defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { LineClamp as StandardLineClamp } from "../src/index.ts";
import { LineClamp } from "../src/pretext.ts";
import { createPretextLineClampPredictor } from "../src/pretext/predictor.ts";
import {
  afterElement,
  bodyElement,
  beforeElement,
  cleanupMounted,
  frame,
  mountClamp,
  naturalLineCount,
  rootElement,
  sampleVisibleLineCounts,
  settle as settleBrowser,
  textElement,
  unmountClamp,
} from "./browser.ts";

import type { MountedClamp } from "./browser.ts";
import type { ClampBoundary } from "../src/index.ts";
import type { Component } from "vue";

async function settle(): Promise<void> {
  await settleBrowser(4);
}

function mountBrowser(text: string, font: string, width: number): MountedClamp {
  return mountLineClamp(StandardLineClamp, text, font, width);
}

function mountPretext(
  text: string,
  font: string,
  width: number,
  props: Record<string, unknown> = {},
  style?: string,
): MountedClamp {
  return mountLineClamp(LineClamp, text, font, width, props, style);
}

function mountLineClamp(
  component: Component,
  text: string,
  font: string,
  width: number,
  props: Record<string, unknown> = {},
  style?: string,
): MountedClamp {
  return mountClamp({
    component,
    font,
    lineHeight: "22px",
    props: { boundary: "word", maxLines: 3, ...props },
    ...(style === undefined ? {} : { style }),
    text,
    width,
  });
}

function visibleText(mountedClamp: MountedClamp): string {
  return visibleTextIn(mountedClamp.container);
}

function visibleTextIn(container: HTMLElement): string {
  return textElement(rootElement(container)).textContent ?? "";
}

function rootFor(mountedClamp: MountedClamp): HTMLElement {
  return rootElement(mountedClamp.container);
}

function bodyFor(mountedClamp: MountedClamp): HTMLElement {
  return bodyElement(rootFor(mountedClamp));
}

function fixedAffix(width: number) {
  return () => h("span", { style: `display:inline-block;height:18px;width:${width}px` });
}

function trackGeometryReads(elements: readonly unknown[]): () => number {
  let reads = 0;
  for (const element of elements) {
    if (!(element instanceof HTMLElement)) throw new Error("Expected clamp geometry.");
    Object.defineProperties(element, {
      getBoundingClientRect: {
        configurable: true,
        value: () => {
          reads += 1;
          return new DOMRect();
        },
      },
      getClientRects: {
        configurable: true,
        value: () => {
          reads += 1;
          return [];
        },
      },
    });
  }

  return () => reads;
}

describe("Pretext LineClamp", () => {
  it("reuses only bounded preparations with matching text and typography", () => {
    const element = document.createElement("span");
    element.style.font = "16px Arial";
    document.body.append(element);
    const segmentation = vi.spyOn(Intl.Segmenter.prototype, "segment");
    const text =
      "Release  dashboards\n国际响应团队 preserve customer context across regions. ".repeat(5);
    const input = {
      afterWidth: 0,
      beforeWidth: 0,
      ellipsis: "…",
      lineLimit: 3,
      rootWidth: 180,
      text,
      textElement: element,
    };
    try {
      const first = createPretextLineClampPredictor();
      first.invalidate();
      const expected = first.predict(input);
      const calls = segmentation.mock.calls.length;
      const second = createPretextLineClampPredictor();
      expect(second.predict(input)).toEqual(expected);
      second.predict({ ...input, rootWidth: 240 });
      expect(segmentation.mock.calls).toHaveLength(calls);

      for (const change of [
        { style: "font:16px Georgia" },
        { style: "font:16px Arial;letter-spacing:2px" },
        { style: "font:16px Arial;white-space:pre-wrap" },
        { style: "font:16px Arial;word-break:keep-all" },
        { style: "font:16px Arial", ellipsis: "..." },
        { style: "font:16px Arial", text: text + " Updated" },
      ]) {
        // Restore a common preparation so each variant independently changes
        // a cache input instead of relying on the preceding variant's styles.
        element.style.cssText = "font:16px Arial";
        createPretextLineClampPredictor().predict(input);
        element.style.cssText = change.style;
        const previousCalls = segmentation.mock.calls.length;
        createPretextLineClampPredictor().predict({ ...input, ...change });
        expect(segmentation.mock.calls.length).toBeGreaterThan(previousCalls);
      }

      second.invalidate();
      const previousCalls = segmentation.mock.calls.length;
      second.predict(input);
      expect(segmentation.mock.calls.length).toBeGreaterThan(previousCalls);

      const large = { ...input, text: text.repeat(40) };
      createPretextLineClampPredictor().predict(large);
      const largeCalls = segmentation.mock.calls.length;
      createPretextLineClampPredictor().predict(large);
      expect(segmentation.mock.calls.length).toBeGreaterThan(largeCalls);
    } finally {
      segmentation.mockRestore();
      element.remove();
    }
  });

  it("uses the standard native path before considering Pretext", async () => {
    const text =
      "Release dashboards keep customer impact and regional mitigation visible while cards resize.";
    const clamp = mountLineClamp(LineClamp, text, "16px Georgia", 180, {
      boundary: "grapheme",
    });
    await settle();

    const root = rootFor(clamp);
    const content = root.querySelector('[data-part="content"]');
    expect(content).toBeInstanceOf(HTMLElement);
    expect(getComputedStyle(content!).getPropertyValue("-webkit-line-clamp")).toBe("3");
    expect(bodyElement(root).textContent).toBe(text);
  });

  it("does not pass its predictor to LineClamp instances rendered by slots", async () => {
    const clamp = mountClamp({
      after: () =>
        h(StandardLineClamp, {
          boundary: "word",
          class: "nested-standard-clamp",
          maxLines: 2,
          style: "display:block;font:16px Georgia;line-height:22px;width:120px",
          text: "Nested standard clamps keep browser-authoritative measurement.",
        }),
      component: LineClamp,
      font: "16px Georgia",
      lineHeight: "22px",
      props: { boundary: "word", maxLines: 3 },
      text: "The outer Pretext clamp owns only its direct prediction strategy.",
      width: 360,
    });
    await settle();

    const nestedRoot = rootFor(clamp).querySelector(".nested-standard-clamp");
    expect(nestedRoot).toBeInstanceOf(HTMLElement);
    expect(nestedRoot?.firstElementChild?.getAttribute("data-part")).toBe("content");
    expect(
      (nestedRoot?.querySelector('[data-part="content"]') as HTMLElement | null)?.style
        .webkitLineClamp,
    ).toBe("");
  });

  it("uses browser measurement when the ellipsis cannot be predicted", async () => {
    const text =
      "Release dashboards keep customer impact and regional mitigation visible while cards resize.";
    const measured = mountPretext(text, "16px Georgia", 180, { ellipsis: "more\n..." });
    const measuredBrowser = mountLineClamp(StandardLineClamp, text, "16px Georgia", 180, {
      ellipsis: "more\n...",
    });
    await settle();

    expect(visibleText(measured)).toBe(visibleText(measuredBrowser));
  });

  it("uses browser-measured grapheme clamping with custom ellipses", async () => {
    const scenarios = [
      {
        font: "16px Georgia",
        text: "Release dashboards keep customer impact and regional mitigation visible while cards resize.",
      },
      {
        font: "16px Arial",
        text: "国际响应团队需要在多区域故障期间保留客户沟通缓解措施和后续责任。",
      },
      {
        font: "16px Arial",
        text: "e\u0301\ud83d\udc69‍\ud83d\ude80".repeat(24),
      },
    ];
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

    for (const scenario of scenarios) {
      const prefixes = new Set([""]);
      let sourcePrefix = "";
      for (const part of segmenter.segment(scenario.text)) {
        sourcePrefix += part.segment;
        prefixes.add(sourcePrefix.trim());
      }
      const measured = mountPretext(scenario.text, scenario.font, 180, {
        boundary: "grapheme",
        ellipsis: "...",
      });
      const browser = mountLineClamp(StandardLineClamp, scenario.text, scenario.font, 180, {
        boundary: "grapheme",
        ellipsis: "...",
      });

      for (const width of [180, 220, 260, 300]) {
        measured.width.value = width;
        browser.width.value = width;
        await settle();

        const output = visibleText(measured);
        const prefix = output.endsWith("...") ? output.slice(0, -3) : output;

        expect(output, `${scenario.font} at ${width}px`).toBe(visibleText(browser));
        expect(
          (rootFor(measured).querySelector('[data-part="content"]') as HTMLElement).style
            .webkitLineClamp,
        ).toBe("");
        expect(prefixes.has(prefix), `${scenario.font} at ${width}px`).toBe(true);
        expect(
          naturalLineCount(rootFor(measured)),
          `${scenario.font} at ${width}px`,
        ).toBeLessThanOrEqual(3);
      }

      unmountClamp(measured);
      unmountClamp(browser);
    }
  });

  it("preserves measured grapheme cut points as width and after-slot occupancy change", async () => {
    const text =
      "Vue Clamp keeps dense application text readable while preserving the full source text for assistive technology. " +
      "Resize the shared width to force every instance through the same layout change.";
    const afterWidth = ref(48);
    const after = () =>
      h("span", { style: `display:inline-block;height:18px;width:${afterWidth.value}px` });
    function mountAffixed(component: Component, boundary: ClampBoundary): MountedClamp {
      return mountClamp({
        after,
        component,
        font: "16px Arial",
        lineHeight: "22px",
        props: { boundary, maxLines: 3 },
        text,
        width: 180,
      });
    }
    const measured = mountAffixed(LineClamp, "grapheme");
    const browser = mountAffixed(StandardLineClamp, "grapheme");
    const word = mountAffixed(StandardLineClamp, "word");
    let keptPartialWord = false;

    for (const [width, affixWidth] of [
      [180, 48],
      [260, 48],
      [260, 96],
      [360, 96],
      [1000, 48],
      [180, 48],
    ] as const) {
      afterWidth.value = affixWidth;
      for (const clamp of [measured, browser, word]) clamp.width.value = width;
      await settle();

      expect(visibleText(measured), `${width}px with ${affixWidth}px after`).toBe(
        visibleText(browser),
      );
      expect(measured.exposed.value?.clamped).toBe(browser.exposed.value?.clamped);
      expect(naturalLineCount(rootFor(measured))).toBeLessThanOrEqual(3);
      expect(
        (rootFor(measured).querySelector('[data-part="content"]') as HTMLElement).style
          .webkitLineClamp,
      ).toBe("");
      keptPartialWord ||= visibleText(measured) !== visibleText(word);
    }

    expect(keptPartialWord).toBe(true);
  });

  it("keeps native single-line grapheme clamping with an after slot", async () => {
    const text = "Release dashboards keep customer impact visible while cards resize.";
    const clamp = mountClamp({
      after: fixedAffix(48),
      component: LineClamp,
      props: { boundary: "grapheme", maxLines: 1 },
      text,
      width: 180,
    });
    await settle();

    expect(bodyFor(clamp).textContent).toBe(text);
    expect(textElement(rootFor(clamp)).style.textOverflow).toBe("ellipsis");
    expect(afterElement(rootFor(clamp))?.getBoundingClientRect().width).toBeCloseTo(48, 3);
  });

  it("reads the rendered font for prediction", async () => {
    const text =
      "Release dashboards keep customer impact and regional mitigation visible while cards resize.";
    const browser = mountBrowser(text, "16px Georgia", 180);
    const predicted = mountPretext(text, "16px Georgia", 180);
    await settle();

    expect(bodyFor(predicted).style.font).toBe("");
    expect(getComputedStyle(bodyFor(predicted)).fontFamily).toContain("Georgia");
    expect(visibleText(predicted)).toBe(visibleText(browser));
  });

  it("models supported typography from computed style", async () => {
    const scenarios: Array<{
      readonly font: string;
      readonly style: string;
      readonly text: string;
      readonly width: number;
    }> = [
      {
        font: "16px Georgia",
        style: "letter-spacing:1.5px",
        text: "Release dashboards preserve customer context while responsive cards resize.",
        width: 210,
      },
      {
        font: "16px Georgia",
        style: "white-space:pre-wrap",
        text: "Release  dashboards preserve spacing\nwhile cards resize across narrow layouts.",
        width: 180,
      },
    ];

    for (const scenario of scenarios) {
      const browser = mountLineClamp(
        StandardLineClamp,
        scenario.text,
        scenario.font,
        scenario.width,
        {},
        scenario.style,
      );
      const predicted = mountPretext(
        scenario.text,
        scenario.font,
        scenario.width,
        {},
        scenario.style,
      );
      await settle();

      expect(visibleText(predicted)).toBe(visibleText(browser));
      unmountClamp(browser);
      unmountClamp(predicted);
    }
  });

  it("models keep-all with a contained prefix at word boundaries", async () => {
    const text = "国际响应团队需要保留 customer impact 和 mitigation context，同时避免错误断行。";
    const prefixes = new Set(
      Array.from(new Intl.Segmenter(undefined, { granularity: "word" }).segment(text), (part) =>
        text.slice(0, part.index + part.segment.length).trimEnd(),
      ),
    );
    let typographyChangedOutput = false;
    for (const width of [160, 180, 200]) {
      const normal = mountPretext(text, "16px Arial", width, {}, "word-break:normal");
      const keepAll = mountPretext(text, "16px Arial", width, {}, "word-break:keep-all");
      await settle();
      const output = visibleText(keepAll);
      const prefix = output.endsWith("…") ? output.slice(0, -1) : output;
      expect(getComputedStyle(textElement(rootFor(keepAll))).wordBreak).toBe("keep-all");
      expect(prefixes.has(prefix), `${width}px`).toBe(true);
      expect(naturalLineCount(rootFor(keepAll)), `${width}px`).toBeLessThanOrEqual(3);
      typographyChangedOutput ||= visibleText(normal) !== output;
      unmountClamp(normal);
      unmountClamp(keepAll);
    }
    expect(typographyChangedOutput).toBe(true);
  });

  it("refreshes cached font and marker widths after a font loads", async () => {
    const family = "PretextLateFont";
    const text = "iiiiiiii iiiiiiii iiiiiiii iiiiiiii ".repeat(10);
    const font = `24px ${family}, monospace`;
    const predicted = mountPretext(text, font, 180, { ellipsis: "iiii" });
    const second = mountPretext(text, font, 220, { ellipsis: "iiii" });
    await settle();
    const before = visibleText(predicted);
    const face = new FontFace(
      family,
      `url(${new URL("./fixtures/narrow.ttf", import.meta.url).href})`,
    );

    try {
      document.fonts.add(face);
      await document.fonts.load(font, "iiiiiiii");
      await document.fonts.ready;
      document.fonts.dispatchEvent(new Event("loadingdone"));
      await settle();
      const browser = mountLineClamp(StandardLineClamp, text, font, 180, { ellipsis: "iiii" });
      const secondBrowser = mountLineClamp(StandardLineClamp, text, font, 220, {
        ellipsis: "iiii",
      });
      await settle();

      expect(visibleText(browser)).not.toBe(before);
      expect(visibleText(predicted)).toBe(visibleText(browser));
      expect(visibleText(second)).toBe(visibleText(secondBrowser));
    } finally {
      document.fonts.delete(face);
    }
  });

  it("refreshes shared font metrics after every predictor was unmounted", async () => {
    const family = "PretextUnmountedFont";
    const text = "iiiiiiii iiiiiiii iiiiiiii iiiiiiii ".repeat(10);
    const font = `24px ${family}, monospace`;
    const predicted = mountPretext(text, font, 180, { ellipsis: "iiii" });
    await settle();
    const previous = visibleText(predicted);
    unmountClamp(predicted);
    const face = new FontFace(
      family,
      `url(${new URL("./fixtures/narrow.ttf", import.meta.url).href})`,
    );
    try {
      document.fonts.add(face);
      await document.fonts.load(font, "iiiiiiii");
      await document.fonts.ready;
      const remounted = mountPretext(text, font, 180, { ellipsis: "iiii" });
      const browser = mountLineClamp(StandardLineClamp, text, font, 180, { ellipsis: "iiii" });
      await settle();
      expect(visibleText(browser)).not.toBe(previous);
      expect(visibleText(remounted)).toBe(visibleText(browser));
    } finally {
      document.fonts.delete(face);
    }
  });

  it("refreshes retained font metrics when a predictor becomes active again", async () => {
    const family = "PretextInactiveFont";
    const text = "iiiiiiii iiiiiiii iiiiiiii iiiiiiii ".repeat(10);
    const font = `24px ${family}, monospace`;
    const predicted = mountPretext(text, font, 180, { ellipsis: "iiii" });
    await settle();
    const previous = visibleText(predicted);
    predicted.exposed.value!.expand();
    await settle();
    const face = new FontFace(
      family,
      `url(${new URL("./fixtures/narrow.ttf", import.meta.url).href})`,
    );
    try {
      document.fonts.add(face);
      await document.fonts.load(font, "iiiiiiii");
      await document.fonts.ready;
      predicted.exposed.value!.collapse();
      const browser = mountLineClamp(StandardLineClamp, text, font, 180, { ellipsis: "iiii" });
      await settle();
      expect(visibleText(browser)).not.toBe(previous);
      expect(visibleText(predicted)).toBe(visibleText(browser));
    } finally {
      document.fonts.delete(face);
    }
  });

  it("preserves text and visibility when switching runtime modes", async () => {
    const container = document.createElement("div");
    const options = ref<Record<string, unknown>>({ boundary: "word", maxLines: 3 });
    const text =
      "Release dashboards keep customer impact visible as regional cards resize. ".repeat(4);
    const app = createApp(() =>
      h(LineClamp, {
        ...options.value,
        style: "font:16px Arial;line-height:22px;overflow-wrap:break-word;width:180px",
        text,
      }),
    );
    document.body.append(container);

    try {
      app.mount(container);
      for (const props of [
        { boundary: "word", maxLines: 3 },
        { boundary: "grapheme", maxLines: 3 },
        { boundary: "word", maxLines: 3 },
        { boundary: "grapheme", maxLines: 3, ellipsis: "..." },
        { boundary: "word", maxLines: 3, ellipsis: "..." },
        { boundary: "grapheme", maxLines: 1, ellipsis: "..." },
        { boundary: "grapheme", maxLines: 1 },
        { boundary: "word", maxLines: 3 },
        { boundary: "word", maxHeight: 44 },
        { boundary: "word", maxLines: 3 },
        { boundary: "word" },
        { boundary: "word", maxLines: 3 },
        { boundary: "word", maxLines: 3, expanded: true },
        { boundary: "word", maxLines: 3, expanded: false },
      ]) {
        options.value = props;
        await settle();
        const browser = mountLineClamp(StandardLineClamp, text, "16px Arial", 180, {
          maxLines: undefined,
          ...props,
        });
        await settle();
        expect(visibleTextIn(container), JSON.stringify(props)).toBe(visibleText(browser));
        expect(getComputedStyle(textElement(rootElement(container))).visibility).toBe("visible");
        unmountClamp(browser);
      }
    } finally {
      app.unmount();
      container.remove();
    }
  });

  it("matches browser-authoritative word clamping in its supported contract", async () => {
    const scenarios = [
      {
        font: "16px Georgia",
        text: "Release dashboards keep customer impact, regional mitigation, and ownership visible while responsive cards change width.",
      },
      {
        font: "16px Arial",
        text: "国际响应团队需要在多区域故障期间保留客户沟通缓解措施和后续责任，同时避免关键短语被截断。",
      },
      {
        font: "16px Arial",
        text: "ทีมตอบสนองเหตุการณ์ต้องรักษาบริบทของลูกค้าและข้อมูลการแก้ไขปัญหาให้มองเห็นได้อย่างชัดเจน",
      },
      {
        font: "16px Georgia",
        text: "Deploy now... “release-ready?” isn't the same as release ready; punctuation stays attached correctly.",
      },
      {
        font: "16px Arial",
        text: "e\u0301lan and 👩‍🚀 teams keep composed graphemes intact while multilingual dashboards resize.",
      },
      {
        font: "16px Arial",
        text: `Status ${"observabilityPlatformBoundaryWithoutBreaks".repeat(6)}`,
      },
    ];
    const widths = [180, 190, 200, 220, 240, 260, 300, 400, 440, 460, 480, 500, 520];

    for (const scenario of scenarios) {
      for (const width of widths) {
        const browser = mountBrowser(scenario.text, scenario.font, width);
        const predicted = mountPretext(scenario.text, scenario.font, width);
        await settle();

        expect(visibleText(predicted), `${scenario.font} at ${width}px`).toBe(visibleText(browser));
        unmountClamp(browser);
        unmountClamp(predicted);
      }
    }
  });

  it("keeps long-token prediction within one character of browser clamping across platform fonts", async () => {
    const text = "observabilityPlatformBoundaryWithoutBreaks".repeat(7);
    for (const width of [180, 190, 200, 220, 240, 260, 300, 400, 440, 460, 480, 500, 520]) {
      const browser = mountBrowser(text, "16px Georgia", width);
      const predicted = mountPretext(text, "16px Georgia", width);
      await settle();

      const expected = visibleText(browser);
      const actual = visibleText(predicted);
      // Georgia can resolve to a substitute on Linux. Canvas prediction and DOM
      // line breaking can differ by one ASCII character over this long token.
      expect(expected.endsWith("…"), `${width}px`).toBe(true);
      expect(actual.endsWith("…"), `${width}px`).toBe(true);
      expect([expected, expected.slice(0, -2) + "…"], `${width}px`).toContain(actual);
      expect(text.startsWith(actual.slice(0, -1)), `${width}px`).toBe(true);
      expect(naturalLineCount(rootFor(predicted)), `${width}px`).toBeLessThanOrEqual(3);
      unmountClamp(browser);
      unmountClamp(predicted);
    }
  });

  it("updates from ResizeObserver data without geometry reads", async () => {
    const text =
      "Release dashboards keep customer impact and regional mitigation visible while cards resize.";
    const clamp = mountPretext(text, "16px Georgia", 180);
    await settle();
    expect(clamp.exposed.value?.clamped).toBe(true);

    const root = rootFor(clamp);
    const body = bodyFor(clamp);
    const geometryReads = trackGeometryReads([root, body]);
    let typographyReads = 0;

    const originalGetComputedStyle = globalThis.getComputedStyle;
    globalThis.getComputedStyle = (element, pseudoElement) => {
      if (element === body) typographyReads += 1;
      return originalGetComputedStyle(element, pseudoElement);
    };

    try {
      clamp.width.value = 700;
      await settle();
    } finally {
      globalThis.getComputedStyle = originalGetComputedStyle;
    }

    expect(geometryReads()).toBe(0);
    expect(typographyReads).toBe(0);
    expect(clamp.exposed.value?.clamped).toBe(false);
    expect(visibleText(clamp)).toBe(text);
  });

  it("does not rerender affix slots for container resizes while clamp state is stable", async () => {
    for (const component of [StandardLineClamp, LineClamp]) {
      let beforeCalls = 0;
      let afterCalls = 0;
      const clamp = mountClamp({
        after: () => {
          afterCalls += 1;
          return h("span", { style: "display:inline-block;height:18px;width:24px" });
        },
        applyWidthToComponent: false,
        before: () => {
          beforeCalls += 1;
          return h("span", { style: "display:inline-block;height:18px;width:32px" });
        },
        component,
        containerStyle: "width:180px",
        font: "16px Georgia",
        lineHeight: "22px",
        props: { boundary: "word", maxLines: 3 },
        text: "Release dashboards keep customer impact and regional mitigation visible while cards resize.",
      });
      await settle();

      expect(clamp.exposed.value?.clamped).toBe(true);
      const initialBeforeCalls = beforeCalls;
      const initialAfterCalls = afterCalls;

      clamp.container.style.width = "200px";
      await settle();

      expect(clamp.exposed.value?.clamped).toBe(true);
      expect(beforeCalls).toBe(initialBeforeCalls);
      expect(afterCalls).toBe(initialAfterCalls);

      clamp.container.style.width = "900px";
      await settle();

      expect(clamp.exposed.value?.clamped).toBe(false);
      expect(beforeCalls).toBeGreaterThan(initialBeforeCalls);
      expect(afterCalls).toBeGreaterThan(initialAfterCalls);
      const expandedBeforeCalls = beforeCalls;
      const expandedAfterCalls = afterCalls;

      clamp.container.style.width = "850px";
      await settle();

      expect(clamp.exposed.value?.clamped).toBe(false);
      expect(beforeCalls).toBe(expandedBeforeCalls);
      expect(afterCalls).toBe(expandedAfterCalls);
      unmountClamp(clamp);
    }
  });

  it("settles an initially zero-width prediction", async () => {
    const clamp = mountPretext("Hidden until there is room", "16px Georgia", 0);
    await settle();

    const visible = bodyFor(clamp).children[1];
    expect(visible).toBeInstanceOf(HTMLElement);
    expect((visible as HTMLElement).style.visibility).toBe("");
    expect(visible?.textContent).toBe("");
    expect(clamp.exposed.value?.clamped).toBe(true);
  });

  it("reports clipping when a single grapheme exceeds the container", async () => {
    const clamp = mountPretext("W", "16px Arial", 4);
    await settle();

    expect(clamp.exposed.value?.clamped).toBe(true);
    expect(visibleText(clamp)).toBe("");
    clamp.width.value = 180;
    await settle();
    expect(clamp.exposed.value?.clamped).toBe(false);
    expect(visibleText(clamp)).toBe("W");
  });

  it("uses observed affix sizes on the prediction path", async () => {
    const afterWidth = ref(20);
    const text =
      "Release dashboards keep customer impact and regional mitigation visible while cards resize.";
    const clamp = mountClamp({
      after: () =>
        h("span", {
          style: `display:inline-block;height:18px;width:${afterWidth.value}px`,
        }),
      before: () => h("span", { style: "display:inline-block;height:18px;width:36px" }),
      component: LineClamp,
      font: "16px Georgia",
      lineHeight: "22px",
      props: { boundary: "word", maxLines: 2 },
      text,
      width: 170,
    });
    await settle();

    const root = rootFor(clamp);
    const initial = visibleText(clamp);
    expect(beforeElement(root)?.getBoundingClientRect().width).toBeCloseTo(36, 3);
    expect(afterElement(root)?.getBoundingClientRect().width).toBeCloseTo(20, 3);
    expect(initial).not.toBe(text);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);

    afterWidth.value = 110;
    await settleBrowser(8);

    expect(afterElement(root)?.getBoundingClientRect().width).toBeCloseTo(110, 3);
    expect(visibleText(clamp).length).toBeLessThan(initial.length);
    expect(await sampleVisibleLineCounts(root)).toEqual([2, 2, 2]);
  });

  it("keeps varied affix predictions on source boundaries and within the line limit", async () => {
    const scenarios = [
      {
        after: 56,
        before: 0,
        font: "16px Georgia",
        name: "English after",
        text: "Release dashboards keep customer impact, mitigation, and ownership visible while cards resize.",
      },
      {
        after: 0,
        before: 44,
        font: "16px Arial",
        name: "CJK before",
        text: "国际响应团队需要在多区域故障期间保留客户沟通缓解措施和后续责任。",
      },
      {
        after: 60,
        before: 0,
        font: "16px Arial",
        name: "Thai after",
        text: "ทีมตอบสนองเหตุการณ์ต้องรักษาบริบทของลูกค้าและข้อมูลการแก้ไขปัญหาให้มองเห็นได้อย่างชัดเจน",
      },
      {
        after: 56,
        before: 40,
        font: "16px Arial",
        name: "Emoji both",
        text: "Status 👩🏽‍💻 ready, family 👨‍👩‍👧‍👦 notified, flags 🇺🇳🇯🇵 checked, and café e\u0301lan reviewed.",
      },
      {
        after: 64,
        before: 44,
        font: "16px Arial",
        name: "Long token both",
        text: "observabilityPlatformBoundary👩‍🚀e\u0301".repeat(7),
      },
    ] as const;
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

    for (const scenario of scenarios) {
      const clamp = mountClamp({
        ...(scenario.after > 0 ? { after: fixedAffix(scenario.after) } : {}),
        ...(scenario.before > 0 ? { before: fixedAffix(scenario.before) } : {}),
        component: LineClamp,
        font: scenario.font,
        lineHeight: "22px",
        props: { boundary: "word", maxLines: 3 },
        text: scenario.text,
        width: 180,
      });
      const boundaries = new Set([
        0,
        ...[...segmenter.segment(scenario.text)].map((part) => part.index + part.segment.length),
      ]);

      for (const width of [180, 260, 460, 220, 330]) {
        clamp.width.value = width;
        await settle();

        const output = visibleText(clamp);
        const prefix = output === scenario.text ? output : output.slice(0, -1);
        expect(scenario.text.startsWith(prefix), `${scenario.name} at ${width}px`).toBe(true);
        expect(boundaries.has(prefix.length), `${scenario.name} at ${width}px`).toBe(true);
        expect(
          (await sampleVisibleLineCounts(rootFor(clamp), 1))[0],
          `${scenario.name} at ${width}px`,
        ).toBeLessThanOrEqual(3);
      }

      unmountClamp(clamp);
    }
  });

  it("reuses ResizeObserver affix geometry without synchronous reads while resizing", async () => {
    const text =
      "Release dashboards keep customer impact and regional mitigation visible while cards resize.";
    const clamp = mountClamp({
      after: fixedAffix(48),
      before: fixedAffix(36),
      component: LineClamp,
      font: "16px Georgia",
      lineHeight: "22px",
      props: { boundary: "word", maxLines: 2 },
      text,
      width: 170,
    });
    await settle();

    const root = rootFor(clamp);
    const content = root.querySelector('[data-part="content"]');
    const before = beforeElement(root);
    const after = afterElement(root);
    const geometryReads = trackGeometryReads([root, content, bodyFor(clamp), before, after]);
    let styleReads = 0;

    const originalGetComputedStyle = globalThis.getComputedStyle;
    globalThis.getComputedStyle = (...argumentsList) => {
      styleReads += 1;
      return originalGetComputedStyle(...argumentsList);
    };

    try {
      clamp.width.value = 260;
      await settle();
    } finally {
      globalThis.getComputedStyle = originalGetComputedStyle;
    }

    expect(geometryReads()).toBe(0);
    expect(styleReads).toBe(0);
    expect(visibleText(clamp).length).toBeGreaterThan(0);
  });

  it("commits the first prediction inside ResizeObserver delivery before reveal", async () => {
    const OriginalResizeObserver = globalThis.ResizeObserver;
    const deliveredText: string[] = [];
    let clamp: MountedClamp | undefined;
    globalThis.ResizeObserver = new Proxy(OriginalResizeObserver, {
      construct(Target, [callback]: ConstructorParameters<typeof ResizeObserver>) {
        return new Target((entries, observer) => {
          callback(entries, observer);
          if (clamp) deliveredText.push(visibleText(clamp));
        });
      },
    });

    try {
      const text =
        "Release dashboards keep customer impact and regional mitigation visible while cards resize.";
      clamp = mountPretext(text, "16px Georgia", 180);
      const body = bodyFor(clamp);
      const [source, visible] = [...body.children];

      expect(source?.textContent).toBe(text);
      expect(visible?.textContent).toBe(text);
      expect((visible as HTMLElement | undefined)?.style.visibility).toBe("hidden");
      await settle();
      expect(deliveredText.at(-1)).not.toBe(text);
      expect((visible as HTMLElement | undefined)?.style.visibility).toBe("");

      clamp.width.value = 700;
      await settle();
      expect(deliveredText.at(-1)).toBe(text);
    } finally {
      globalThis.ResizeObserver = OriginalResizeObserver;
    }
  });

  it("keeps one visible text node through repeated predictive resizes", async () => {
    const text =
      "Release dashboards keep customer impact and regional mitigation visible while cards resize.";
    const clamp = mountPretext(text, "16px Georgia", 460);
    await settle();

    const visible = bodyFor(clamp).children[1];
    const textNode = visible?.firstChild;
    if (!(visible instanceof HTMLElement) || !(textNode instanceof Text)) {
      throw new Error("Expected a visible text node.");
    }

    const childListRecords: MutationRecord[] = [];
    const characterDataRecords: MutationRecord[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "childList") childListRecords.push(record);
        if (record.type === "characterData") characterDataRecords.push(record);
      }
    });
    observer.observe(visible, { characterData: true, childList: true, subtree: true });

    try {
      for (const width of [420, 360, 300, 240, 180, 260, 340, 440]) {
        clamp.width.value = width;
        await settle();
        expect(visible.firstChild).toBe(textNode);
      }

      childListRecords.push(
        ...observer.takeRecords().filter((record) => record.type === "childList"),
      );
      expect(childListRecords).toHaveLength(0);
      expect(characterDataRecords.length).toBeGreaterThan(0);
    } finally {
      observer.disconnect();
    }
  });

  it("does not approximate line boxes with an lh height cap", async () => {
    const text =
      "Release dashboards keep customer impact and regional mitigation visible while cards resize.";
    const clamp = mountPretext(text, "16px Georgia", 180);
    await settle();
    const body = bodyFor(clamp);
    const visible = body.children[1];
    if (!(visible instanceof HTMLElement)) throw new Error("Expected visible text.");

    const tallInline = document.createElement("span");
    Object.assign(tallInline.style, {
      display: "inline-block",
      height: "80px",
      verticalAlign: "bottom",
      width: "1px",
    });
    visible.append(tallInline);
    await frame();

    expect(body.style.maxHeight).toBe("");
    expect(body.getBoundingClientRect().height).toBeGreaterThan(3 * 22);
  });

  it("contains shaping outside the prediction model by line box", async () => {
    const text =
      "Release dashboards keep customer impact and regional mitigation visible while cards resize.";
    const clamp = mountPretext(text, "16px Georgia", 150, {}, "word-spacing:28px");
    await settle();

    const root = rootFor(clamp);
    const content = root.querySelector('[data-part="content"]');
    expect(content).toBeInstanceOf(HTMLElement);
    expect(getComputedStyle(content!).getPropertyValue("-webkit-line-clamp")).toBe("3");
    expect((await sampleVisibleLineCounts(root)).every((lines) => lines <= 3)).toBe(true);
  });

  it("keeps predictive text current across successive clamped widths", async () => {
    const text = "observabilityPlatformBoundaryWithoutBreaks".repeat(7);
    const browser = mountBrowser(text, "16px Georgia", 180);
    const predicted = mountPretext(text, "16px Georgia", 180);

    for (const width of [180, 220, 260, 300]) {
      browser.width.value = width;
      predicted.width.value = width;
      await settle();

      expect(predicted.exposed.value?.clamped).toBe(true);
      expect(visibleText(predicted), `${width}px`).toBe(visibleText(browser));
    }
  });

  it("recomputes when the source text changes", async () => {
    const longText = "observabilityPlatformBoundaryWithoutBreaks".repeat(7);
    const clamp = mountPretext(longText, "16px Georgia", 180);
    await settle();
    expect(clamp.exposed.value?.clamped).toBe(true);

    clamp.text.value = "Short source";
    await settle();
    expect(clamp.exposed.value?.clamped).toBe(false);
    expect(visibleText(clamp)).toBe("Short source");

    clamp.text.value = longText;
    await settle();
    expect(clamp.exposed.value?.clamped).toBe(true);
  });

  it("recomputes when a custom ellipsis changes", async () => {
    const container = document.createElement("div");
    const ellipsis = ref("...");
    const text =
      "Release dashboards keep customer impact and regional mitigation visible while cards resize.";
    const app = createApp(
      defineComponent(
        () => () =>
          h(LineClamp, {
            boundary: "word",
            ellipsis: ellipsis.value,
            maxLines: 3,
            style: "font:16px Georgia;line-height:22px;overflow-wrap:break-word;width:180px",
            text,
          }),
      ),
    );
    document.body.append(container);

    try {
      app.mount(container);
      await settle();
      expect(visibleTextIn(container).endsWith("...")).toBe(true);

      ellipsis.value = "[more]";
      await settle();
      expect(visibleTextIn(container).endsWith("[more]")).toBe(true);
    } finally {
      app.unmount();
      container.remove();
    }
  });

  it("keeps the full source available when predicted text is visible", async () => {
    const text = "Customer incident summaries preserve complete words while widths change.";
    const clamp = mountPretext(text, "16px Arial", 150);
    await settle();

    const [source, visible] = [...bodyFor(clamp).children];
    expect(source?.textContent).toBe(text);
    expect(visible?.getAttribute("aria-hidden")).toBe("true");
    expect(visible?.textContent?.endsWith("…")).toBe(true);
  });

  it("shares the standard expansion controls and clamp event", async () => {
    const changes: boolean[] = [];
    const text = "Customer incident summaries preserve complete words while widths change.";
    const clamp = mountPretext(text, "16px Arial", 150, {
      onClampchange: (value: boolean) => changes.push(value),
    });
    await settle();

    expect(changes).toEqual([false, true]);
    clamp.exposed.value?.expand();
    await settle();
    expect(clamp.exposed.value?.expanded).toBe(true);
    expect(visibleText(clamp)).toBe(text);
    expect(changes).toEqual([false, true, false]);

    clamp.exposed.value?.collapse();
    await settle();
    expect(clamp.exposed.value?.expanded).toBe(false);
    expect(changes).toEqual([false, true, false, true]);
  });

  it("reports the initial inactive state", async () => {
    const changes: boolean[] = [];
    mountPretext("No active line limit", "16px Arial", 180, {
      maxLines: undefined,
      onClampchange: (value: boolean) => changes.push(value),
    });
    await settle();

    expect(changes).toEqual([false]);
  });

  it("owns resize observation only while active", async () => {
    const OriginalResizeObserver = globalThis.ResizeObserver;
    let observerInstances = 0;
    globalThis.ResizeObserver = new Proxy(OriginalResizeObserver, {
      construct(Target, argumentsList: ConstructorParameters<typeof ResizeObserver>) {
        observerInstances += 1;
        return new Target(...argumentsList);
      },
    });

    try {
      const text = "Customer impact and mitigation stay visible while dashboards resize.";
      const first = mountPretext(text, "16px Arial", 180);
      const second = mountPretext(text, "16px Arial", 220);
      mountPretext(text, "16px Arial", 220, { expanded: true });
      await settle();
      expect(observerInstances).toBe(2);

      unmountClamp(first);
      unmountClamp(second);
      mountPretext(text, "16px Arial", 260);
      await settle();
      expect(observerInstances).toBe(3);
    } finally {
      globalThis.ResizeObserver = OriginalResizeObserver;
    }
  });
});

afterEach(cleanupMounted);
