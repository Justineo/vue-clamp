import { createApp, defineComponent, h, ref } from "vue";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { LineClamp as StandardLineClamp } from "../src/index.ts";
import { LineClamp } from "../src/pretext.ts";
import {
  bodyElement,
  cleanupMounted,
  frame,
  mountClamp,
  rootElement,
  settle as settleBrowser,
  textElement,
  unmountClamp,
} from "./browser.ts";

import type { MountedClamp } from "./browser.ts";
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

describe("Pretext LineClamp", () => {
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

  it("uses Pretext only for its accelerated contract", async () => {
    const text =
      "Release dashboards keep customer impact and regional mitigation visible while cards resize.";
    const predicted = mountPretext(text, "16px Georgia", 180);
    const custom = mountPretext(text, "16px Georgia", 180, { ellipsis: "..." });
    const customBrowser = mountLineClamp(StandardLineClamp, text, "16px Georgia", 180, {
      ellipsis: "...",
    });
    const empty = mountPretext(text, "16px Georgia", 180, { ellipsis: "" });
    const measured = mountPretext(text, "16px Georgia", 180, { ellipsis: "more\n..." });
    const affixed = mountClamp({
      after: () => h("button", { type: "button" }, "More"),
      component: LineClamp,
      font: "16px Georgia",
      lineHeight: "22px",
      props: { boundary: "word", maxLines: 3 },
      text,
      width: 180,
    });
    await settle();

    expect(rootFor(predicted).querySelector('[data-part="content"]')).toBeNull();
    expect(rootFor(custom).querySelector('[data-part="content"]')).toBeNull();
    expect(visibleText(custom)).toBe(visibleText(customBrowser));
    expect(rootFor(empty).querySelector('[data-part="content"]')).toBeNull();
    expect(empty.exposed.value?.clamped).toBe(true);
    expect(visibleText(empty)).not.toContain("…");
    expect(rootFor(measured).querySelector('[data-part="content"]')).toBeInstanceOf(HTMLElement);
    expect(rootFor(affixed).querySelector('[data-part="after"]')?.textContent).toBe("More");
  });

  it("keeps custom-ellipsis grapheme predictions within the requested lines", async () => {
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
      const predicted = mountPretext(scenario.text, scenario.font, 180, {
        boundary: "grapheme",
        ellipsis: "...",
      });

      for (const width of [180, 220, 260, 300]) {
        predicted.width.value = width;
        await settle();

        const root = rootFor(predicted);
        const body = bodyFor(predicted);
        const output = visibleText(predicted);
        const prefix = output.endsWith("...") ? output.slice(0, -3) : output;

        expect(root.querySelector('[data-part="content"]')).toBeNull();
        expect(prefixes.has(prefix), `${scenario.font} at ${width}px`).toBe(true);
        expect(body.scrollHeight, `${scenario.font} at ${width}px`).toBeLessThanOrEqual(
          body.clientHeight + 0.5,
        );
      }

      unmountClamp(predicted);
    }
  });

  it("reads the rendered font for prediction", async () => {
    const text =
      "Release dashboards keep customer impact and regional mitigation visible while cards resize.";
    const browser = mountBrowser(text, "16px Georgia", 180);
    const predicted = mountPretext(text, "16px Georgia", 180);
    await settle();

    expect(rootFor(predicted).querySelector('[data-part="content"]')).toBeNull();
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
        font: "16px Arial",
        style: "word-break:keep-all",
        text: "国际响应团队需要保留 customer impact 和 mitigation context，同时避免错误断行。",
        width: 180,
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
        text: "observabilityPlatformBoundaryWithoutBreaks".repeat(7),
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

  it("updates from ResizeObserver data without geometry reads", async () => {
    const text =
      "Release dashboards keep customer impact and regional mitigation visible while cards resize.";
    const clamp = mountPretext(text, "16px Georgia", 180);
    await settle();
    expect(clamp.exposed.value?.clamped).toBe(true);

    const root = rootFor(clamp);
    const body = bodyFor(clamp);
    let geometryReads = 0;
    let typographyReads = 0;
    for (const element of [root, body]) {
      Object.defineProperties(element, {
        getBoundingClientRect: {
          configurable: true,
          value: () => {
            geometryReads += 1;
            return new DOMRect();
          },
        },
        getClientRects: {
          configurable: true,
          value: () => {
            geometryReads += 1;
            return [];
          },
        },
      });
    }

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

    expect(geometryReads).toBe(0);
    expect(typographyReads).toBe(0);
    expect(clamp.exposed.value?.clamped).toBe(false);
    expect(visibleText(clamp)).toBe(text);
  });

  it("commits predictions inside ResizeObserver delivery without replacing text nodes", async () => {
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
      const textNode = visible?.firstChild;

      expect(source?.textContent).toBe(text);
      expect(visible?.textContent).toBe(text);
      expect((visible as HTMLElement | undefined)?.style.visibility).toBe("hidden");
      await settle();
      expect(deliveredText.at(-1)).not.toBe(text);
      expect((visible as HTMLElement | undefined)?.style.visibility).toBe("");
      expect(body.children[0]).toBe(source);
      expect(body.children[1]).toBe(visible);
      expect(visible?.firstChild).toBe(textNode);

      clamp.width.value = 700;
      await settle();
      expect(deliveredText.at(-1)).toBe(text);
      expect(body.children[0]).toBe(source);
      expect(body.children[1]).toBe(visible);
      expect(visible?.firstChild).toBe(textNode);
    } finally {
      globalThis.ResizeObserver = OriginalResizeObserver;
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
