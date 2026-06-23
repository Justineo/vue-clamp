import { afterEach, describe, expect, it } from "vite-plus/test";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { InlineClamp } from "../src/index.ts";
import { frame } from "./browser.ts";

import type { App, Ref } from "vue";
import type { ClampBoundary, InlineClampSplit, LineClampLocation } from "../src/index.ts";

type MountedInlineClamp = {
  app: App;
  container: HTMLElement;
  text: Ref<string>;
};

type MountedResizableInlineClamp = MountedInlineClamp & {
  width: Ref<number>;
};

type MountedStyledInlineClamp = MountedResizableInlineClamp & {
  fontSize: Ref<number>;
};

type MountedSpacingInlineClamp = MountedResizableInlineClamp & {
  letterSpacing: Ref<number>;
};

type MountedPercentInlineClamp = MountedInlineClamp & {
  outerWidth: Ref<number>;
};

type MountInlineOptions = {
  text: string;
  width?: number;
  as?: string;
  ellipsis?: string;
  location?: LineClampLocation;
  boundary?: ClampBoundary;
  split?: InlineClampSplit;
  style?: string;
};

const mounted = new Set<MountedInlineClamp>();

function hostStyle(width: number, extra?: string): string {
  return [
    "display:block",
    `width:${width}px`,
    "font:16px Georgia, serif",
    "line-height:20px",
    extra,
  ]
    .filter(Boolean)
    .join(";");
}

async function settle(frames = 3): Promise<void> {
  for (let index = 0; index < frames; index += 1) {
    await nextTick();
    await frame();
  }
}

function mountInlineClamp(options: MountInlineOptions): MountedInlineClamp {
  const text = ref(options.text);
  const container = document.createElement("div");
  document.body.append(container);

  const Host = defineComponent({
    setup() {
      return () => {
        const props: {
          text: string;
          style: string;
          as?: string;
          ellipsis?: string;
          location?: LineClampLocation;
          boundary?: ClampBoundary;
          split?: InlineClampSplit;
        } = {
          style: hostStyle(options.width ?? 180, options.style),
          text: text.value,
        };

        if (typeof options.as === "string") {
          props.as = options.as;
        }

        if (typeof options.ellipsis === "string") {
          props.ellipsis = options.ellipsis;
        }

        if (typeof options.location !== "undefined") {
          props.location = options.location;
        }

        if (typeof options.boundary !== "undefined") {
          props.boundary = options.boundary;
        }

        if (typeof options.split === "function") {
          props.split = options.split;
        }

        return h(InlineClamp, props);
      };
    },
  });

  const app = createApp(Host);
  app.mount(container);

  const mountedClamp = {
    app,
    container,
    text,
  };
  mounted.add(mountedClamp);
  return mountedClamp;
}

function mountResizableInlineClamp(options: MountInlineOptions): MountedResizableInlineClamp {
  const text = ref(options.text);
  const width = ref(options.width ?? 180);
  const container = document.createElement("div");
  document.body.append(container);

  const Host = defineComponent({
    setup() {
      return () => {
        const props: {
          text: string;
          ellipsis?: string;
          location?: LineClampLocation;
          boundary?: ClampBoundary;
          split?: InlineClampSplit;
        } = {
          text: text.value,
        };

        if (typeof options.ellipsis === "string") {
          props.ellipsis = options.ellipsis;
        }

        if (typeof options.location !== "undefined") {
          props.location = options.location;
        }

        if (typeof options.boundary !== "undefined") {
          props.boundary = options.boundary;
        }

        if (typeof options.split === "function") {
          props.split = options.split;
        }

        return h(
          "div",
          {
            style: hostStyle(width.value, options.style),
          },
          h(InlineClamp, props),
        );
      };
    },
  });

  const app = createApp(Host);
  app.mount(container);

  const mountedClamp = {
    app,
    container,
    text,
    width,
  };
  mounted.add(mountedClamp);
  return mountedClamp;
}

function mountStyledInlineClamp(options: MountInlineOptions): MountedStyledInlineClamp {
  const text = ref(options.text);
  const width = ref(options.width ?? 180);
  const fontSize = ref(16);
  const container = document.createElement("div");
  document.body.append(container);

  const Host = defineComponent({
    setup() {
      return () => {
        const props: {
          text: string;
          style: string;
          split?: InlineClampSplit;
        } = {
          style: hostStyle(width.value, `font:${fontSize.value}px Georgia, serif`),
          text: text.value,
        };

        if (typeof options.split === "function") {
          props.split = options.split;
        }

        return h(InlineClamp, props);
      };
    },
  });

  const app = createApp(Host);
  app.mount(container);

  const mountedClamp = {
    app,
    container,
    fontSize,
    text,
    width,
  };
  mounted.add(mountedClamp);
  return mountedClamp;
}

function mountVariableFontInlineClamp(options: MountInlineOptions): MountedStyledInlineClamp {
  const text = ref(options.text);
  const width = ref(options.width ?? 180);
  const fontSize = ref(16);
  const container = document.createElement("div");
  document.body.append(container);

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          "div",
          {
            style: `--inline-font-size:${fontSize.value}px`,
          },
          h(InlineClamp, {
            split: options.split,
            style: [
              `width:${width.value}px`,
              "font-family:Georgia, serif",
              "font-size:var(--inline-font-size)",
            ].join(";"),
            text: text.value,
          }),
        );
    },
  });

  const app = createApp(Host);
  app.mount(container);

  const mountedClamp = {
    app,
    container,
    fontSize,
    text,
    width,
  };
  mounted.add(mountedClamp);
  return mountedClamp;
}

function mountVariableSpacingInlineClamp(options: MountInlineOptions): MountedSpacingInlineClamp {
  const text = ref(options.text);
  const width = ref(options.width ?? 180);
  const letterSpacing = ref(2);
  const container = document.createElement("div");
  document.body.append(container);

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          "div",
          {
            style: `--inline-letter-spacing:${letterSpacing.value}px`,
          },
          h(InlineClamp, {
            split: options.split,
            style: [
              `width:${width.value}px`,
              "font:16px Georgia, serif",
              "letter-spacing:var(--inline-letter-spacing)",
            ].join(";"),
            text: text.value,
          }),
        );
    },
  });

  const app = createApp(Host);
  app.mount(container);

  const mountedClamp = {
    app,
    container,
    letterSpacing,
    text,
    width,
  };
  mounted.add(mountedClamp);
  return mountedClamp;
}

function mountPercentInlineClamp(
  options: MountInlineOptions,
  rootStyle = "width:100%",
): MountedPercentInlineClamp {
  const text = ref(options.text);
  const outerWidth = ref(options.width ?? 180);
  const container = document.createElement("div");
  document.body.append(container);

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          "div",
          {
            style: hostStyle(outerWidth.value, options.style),
          },
          h(
            "span",
            {
              style: "display:inline-block;max-width:100%;vertical-align:top",
            },
            h(InlineClamp, {
              split: options.split,
              style: rootStyle,
              text: text.value,
            }),
          ),
        );
    },
  });

  const app = createApp(Host);
  app.mount(container);

  const mountedClamp = {
    app,
    container,
    outerWidth,
    text,
  };
  mounted.add(mountedClamp);
  return mountedClamp;
}

function rootElement(container: HTMLElement): HTMLElement {
  const root = container.firstElementChild;
  if (!(root instanceof HTMLElement)) {
    throw new Error("Expected inline clamp root element.");
  }

  return root;
}

function segment(root: HTMLElement, name: "start" | "body" | "end"): HTMLElement | null {
  const element = root.querySelector(`[data-part="${name}"]`);
  return element instanceof HTMLElement ? element : null;
}

function measureReferenceWidth(text: string): number {
  return measureStyledTextWidth(text, "font:16px Georgia, serif");
}

function measureStyledTextWidth(text: string, style: string): number {
  const reference = document.createElement("span");
  reference.style.cssText = `${style};position:absolute;visibility:hidden;white-space:pre`;
  reference.textContent = text;
  document.body.append(reference);
  const width = reference.getBoundingClientRect().width;
  reference.remove();
  return width;
}

afterEach(() => {
  for (const mountedClamp of mounted) {
    mountedClamp.app.unmount();
    mountedClamp.container.remove();
  }

  mounted.clear();
});

describe("InlineClamp browser contract", () => {
  it("renders plain text as a single shrinkable body by default", async () => {
    const mountedClamp = mountInlineClamp({
      text: "alpha beta gamma",
    });

    await settle();

    const root = rootElement(mountedClamp.container);
    expect(root.tagName).toBe("SPAN");
    expect(root.getAttribute("data-part")).toBe("root");
    expect(segment(root, "start")).toBeNull();
    expect(segment(root, "body")?.textContent).toBe("alpha beta gamma");
    expect(segment(root, "end")).toBeNull();
  });

  it("keeps the end segment visible while the body is measured into inline text", async () => {
    const mountedClamp = mountInlineClamp({
      text: "very-long-generated-types.d.ts",
      width: 120,
      split(text) {
        return {
          body: text.slice(0, -5),
          end: ".d.ts",
        };
      },
    });

    await settle();

    const root = rootElement(mountedClamp.container);
    const body = segment(root, "body");
    const end = segment(root, "end");

    if (!body || !end) {
      throw new Error("Expected inline clamp body and end segments.");
    }

    expect(getComputedStyle(root).display).toBe("inline-block");
    expect(getComputedStyle(body).display).toBe("inline");
    expect(getComputedStyle(body).textOverflow).toBe("clip");
    expect(body.textContent).not.toBe("very-long-generated-types");
    expect(body.textContent?.endsWith("…")).toBe(true);
    expect(end.textContent).toBe(".d.ts");
    expect(root.textContent).toContain(".d.ts");
    expect(root.getBoundingClientRect().width).toBeLessThanOrEqual(121);
  });

  it("supports a custom ellipsis without native text-overflow", async () => {
    const mountedClamp = mountInlineClamp({
      text: "very-long-generated-types.d.ts",
      width: 150,
      ellipsis: " [...] ",
      split(text) {
        return {
          body: text.slice(0, -5),
          end: ".d.ts",
        };
      },
    });

    await settle();

    const root = rootElement(mountedClamp.container);
    const body = segment(root, "body");

    if (!body) {
      throw new Error("Expected inline clamp body segment.");
    }

    expect(body.textContent).toContain(" [...] ");
    expect(getComputedStyle(body).textOverflow).toBe("clip");
    expect(root.textContent).toContain(".d.ts");
    expect(root.getBoundingClientRect().width).toBeLessThanOrEqual(151);
  });

  it("preserves split boundary spacing when the body is clamped", async () => {
    const start = "The only";
    const bodySource = " line clamp body";
    const end = " for Vue.";
    const targetText = " line…";
    const targetWidth = measureReferenceWidth(`${start}${targetText}${end}`);
    const mountedClamp = mountInlineClamp({
      text: `${start}${bodySource}${end}`,
      width: Math.ceil(targetWidth),
      split() {
        return {
          start,
          body: bodySource,
          end,
        };
      },
    });

    await settle();

    const root = rootElement(mountedClamp.container);
    const body = segment(root, "body");

    if (!body) {
      throw new Error("Expected inline clamp body segment.");
    }

    expect(body.textContent?.startsWith(" ")).toBe(true);
    expect(body.textContent).toContain("…");
    expect(root.textContent).toContain("The only ");
    expect(root.textContent).toContain(" for Vue.");
  });

  it("places the ellipsis inside the body at the requested location", async () => {
    const start = "/workspace/";
    const bodySource = "abcdefghijklmnop";
    const end = ".vue";
    const targetText = "abcd…mnop";
    const targetWidth = measureReferenceWidth(`${start}${targetText}${end}`);
    const mountedClamp = mountInlineClamp({
      text: `${start}${bodySource}${end}`,
      width: Math.ceil(targetWidth),
      location: "middle",
      split() {
        return {
          start,
          body: bodySource,
          end,
        };
      },
    });

    await settle();

    const root = rootElement(mountedClamp.container);
    const body = segment(root, "body");

    if (!body) {
      throw new Error("Expected inline clamp body segment.");
    }

    expect(body.textContent).toContain("…");
    expect(body.textContent?.startsWith("abcd")).toBe(true);
    expect(body.textContent?.endsWith("mnop")).toBe(true);
    expect(segment(root, "start")?.textContent).toBe(start);
    expect(segment(root, "end")?.textContent).toBe(end);
    expect(root.getBoundingClientRect().width).toBeLessThanOrEqual(Math.ceil(targetWidth) + 1);
  });

  it("can clamp the shrinkable body at word boundaries", async () => {
    const start = "Status: ";
    const bodySource = "alpha beta gamma delta";
    const mountedClamp = mountInlineClamp({
      text: `${start}${bodySource}`,
      width: Math.ceil(measureReferenceWidth(`${start}alpha beta…`)),
      boundary: "word",
      split() {
        return {
          start,
          body: bodySource,
        };
      },
    });

    await settle();

    const root = rootElement(mountedClamp.container);
    const body = segment(root, "body");

    if (!body) {
      throw new Error("Expected inline clamp body segment.");
    }

    const prefix = (body.textContent ?? "").replace(/…$/u, "");
    expect(body.textContent?.endsWith("…")).toBe(true);
    expect(bodySource.startsWith(prefix)).toBe(true);
    expect(prefix.length === 0 || bodySource[prefix.length] === " ").toBe(true);
    expect(segment(root, "start")?.textContent).toBe(start);
  });

  it("supports start-location clamping within the body", async () => {
    const end = "@acme.dev";
    const mountedClamp = mountInlineClamp({
      text: `release.notifications.digest${end}`,
      width: 150,
      location: "start",
      split(text) {
        return {
          body: text.slice(0, -end.length),
          end,
        };
      },
    });

    await settle();

    const root = rootElement(mountedClamp.container);
    const body = segment(root, "body");

    if (!body) {
      throw new Error("Expected inline clamp body segment.");
    }

    expect(body.textContent?.startsWith("…")).toBe(true);
    expect(body.textContent).not.toBe("release.notifications.digest");
    expect(segment(root, "end")?.textContent).toBe(end);
    expect(root.getBoundingClientRect().width).toBeLessThanOrEqual(151);
  });

  it("can reduce the shrinkable body to only the ellipsis", async () => {
    const start = "/Users/justineo/";
    const end = ".pdf";
    const collapsedWidth = measureReferenceWidth(`${start}…${end}`);
    const oneCharacterWidth = measureReferenceWidth(`${start}r…${end}`);
    const mountedClamp = mountInlineClamp({
      text: `${start}really-long-report${end}`,
      width: Math.floor((collapsedWidth + oneCharacterWidth) / 2),
      split() {
        return {
          start,
          body: "really-long-report",
          end,
        };
      },
    });

    await settle();

    const root = rootElement(mountedClamp.container);

    expect(segment(root, "start")?.textContent).toBe(start);
    expect(segment(root, "body")?.textContent).toBe("…");
    expect(segment(root, "end")?.textContent).toBe(end);
  });

  it("restores body text when the parent width grows", async () => {
    const mountedClamp = mountResizableInlineClamp({
      text: "very-long-generated-types.d.ts",
      width: 120,
      split(text) {
        return {
          body: text.slice(0, -5),
          end: ".d.ts",
        };
      },
    });

    await settle();

    const host = mountedClamp.container.firstElementChild;
    if (!(host instanceof HTMLElement)) {
      throw new Error("Expected inline clamp host element.");
    }

    const root = rootElement(host);
    const body = segment(root, "body");

    if (!body) {
      throw new Error("Expected inline clamp body segment.");
    }

    expect(body.textContent).not.toBe("very-long-generated-types");

    mountedClamp.width.value = 360;
    await settle();

    expect(body.textContent).toBe("very-long-generated-types");
  });

  it("does not reuse a repeated-width cache entry after root style changes", async () => {
    const bodySource = "generated-component-props";
    const end = ".d.ts";
    const fullText = `${bodySource}${end}`;
    const width = Math.ceil(measureStyledTextWidth(fullText, "font:10px Georgia, serif") + 1);

    expect(measureStyledTextWidth(fullText, "font:16px Georgia, serif")).toBeGreaterThan(width);

    const mountedClamp = mountStyledInlineClamp({
      text: fullText,
      width,
      split(text) {
        return {
          body: text.slice(0, -end.length),
          end,
        };
      },
    });

    await settle();

    const root = rootElement(mountedClamp.container);
    const body = segment(root, "body");

    if (!body) {
      throw new Error("Expected inline clamp body segment.");
    }

    mountedClamp.width.value = width + 80;
    await settle();
    mountedClamp.width.value = width;
    await settle();

    expect(body.textContent).not.toBe(bodySource);

    mountedClamp.width.value = width + 80;
    await settle();
    mountedClamp.fontSize.value = 10;
    mountedClamp.width.value = width;
    await settle();

    expect(body.textContent).toBe(bodySource);
  });

  it("does not reuse a repeated-width cache entry when root font metrics use CSS variables", async () => {
    const bodySource = "generated-component-props";
    const end = ".d.ts";
    const fullText = `${bodySource}${end}`;
    const width = Math.ceil(measureStyledTextWidth(fullText, "font:10px Georgia, serif") + 1);

    expect(measureStyledTextWidth(fullText, "font:16px Georgia, serif")).toBeGreaterThan(width);

    const mountedClamp = mountVariableFontInlineClamp({
      text: fullText,
      width,
      split(text) {
        return {
          body: text.slice(0, -end.length),
          end,
        };
      },
    });

    await settle();

    const host = mountedClamp.container.firstElementChild;
    if (!(host instanceof HTMLElement)) {
      throw new Error("Expected inline clamp host element.");
    }

    const root = rootElement(host);
    const body = segment(root, "body");

    if (!body) {
      throw new Error("Expected inline clamp body segment.");
    }

    mountedClamp.width.value = width + 80;
    await settle();
    mountedClamp.width.value = width;
    await settle();

    expect(body.textContent).not.toBe(bodySource);

    mountedClamp.width.value = width + 80;
    await settle();
    mountedClamp.fontSize.value = 10;
    mountedClamp.width.value = width;
    await settle();

    expect(body.textContent).toBe(bodySource);
  });

  it("does not reuse a repeated-width cache entry when root spacing uses CSS variables", async () => {
    const bodySource = "generated-component-props";
    const end = ".d.ts";
    const fullText = `${bodySource}${end}`;
    const compactStyle = "font:16px Georgia, serif;letter-spacing:0px";
    const spacedStyle = "font:16px Georgia, serif;letter-spacing:2px";
    const width = Math.ceil(measureStyledTextWidth(fullText, compactStyle) + 1);

    expect(measureStyledTextWidth(fullText, spacedStyle)).toBeGreaterThan(width);

    const mountedClamp = mountVariableSpacingInlineClamp({
      text: fullText,
      width,
      split(text) {
        return {
          body: text.slice(0, -end.length),
          end,
        };
      },
    });

    await settle();

    const host = mountedClamp.container.firstElementChild;
    if (!(host instanceof HTMLElement)) {
      throw new Error("Expected inline clamp host element.");
    }

    const root = rootElement(host);
    const body = segment(root, "body");

    if (!body) {
      throw new Error("Expected inline clamp body segment.");
    }

    mountedClamp.width.value = width + 80;
    await settle();
    mountedClamp.width.value = width;
    await settle();

    expect(body.textContent).not.toBe(bodySource);

    mountedClamp.width.value = width + 80;
    await settle();
    mountedClamp.letterSpacing.value = 0;
    mountedClamp.width.value = width;
    await settle();

    expect(body.textContent).toBe(bodySource);
  });

  it("does not trust percentage root width inside shrink-to-fit parents", async () => {
    const mountedClamp = mountPercentInlineClamp({
      text: "very-long-generated-types.d.ts",
      width: 120,
      split(text) {
        return {
          body: text.slice(0, -5),
          end: ".d.ts",
        };
      },
    });

    await settle();

    const root = mountedClamp.container.querySelector('[data-part="root"]');
    const body = root instanceof HTMLElement ? segment(root, "body") : null;

    if (!body) {
      throw new Error("Expected inline clamp body segment.");
    }

    expect(body.textContent).not.toBe("very-long-generated-types");

    mountedClamp.outerWidth.value = 360;
    await nextTick();
    document.fonts?.dispatchEvent(new Event("loadingdone"));
    await settle();

    expect(body.textContent).toBe("very-long-generated-types");
  });

  it("does not trust CSS-variable percentage root width inside shrink-to-fit parents", async () => {
    const mountedClamp = mountPercentInlineClamp(
      {
        text: "very-long-generated-types.d.ts",
        width: 120,
        style: "--inline-clamp-width:100%",
        split(text) {
          return {
            body: text.slice(0, -5),
            end: ".d.ts",
          };
        },
      },
      "width:calc(var(--inline-clamp-width))",
    );

    await settle();

    const root = mountedClamp.container.querySelector('[data-part="root"]');
    const body = root instanceof HTMLElement ? segment(root, "body") : null;

    if (!body) {
      throw new Error("Expected inline clamp body segment.");
    }

    expect(body.textContent).not.toBe("very-long-generated-types");

    mountedClamp.outerWidth.value = 360;
    await nextTick();
    document.fonts?.dispatchEvent(new Event("loadingdone"));
    await settle();

    expect(body.textContent).toBe("very-long-generated-types");
  });

  it("recomputes start, body, and end segments when the source text changes", async () => {
    const mountedClamp = mountInlineClamp({
      text: "/Users/justineo/really-long-report.pdf",
      width: 640,
      split(text) {
        const slashIndex = text.lastIndexOf("/") + 1;
        const dotIndex = text.lastIndexOf(".");
        return {
          start: text.slice(0, slashIndex),
          body: text.slice(slashIndex, dotIndex),
          end: text.slice(dotIndex),
        };
      },
    });

    await settle();

    mountedClamp.text.value = "/Users/justineo/screenshots/interface-preview.png";
    await settle();

    const root = rootElement(mountedClamp.container);
    expect(segment(root, "start")?.textContent).toBe("/Users/justineo/screenshots/");
    expect(segment(root, "body")?.textContent).toBe("interface-preview");
    expect(segment(root, "end")?.textContent).toBe(".png");
  });

  it("keeps normal inline spacing across split segments", async () => {
    const mountedClamp = mountInlineClamp({
      text: "The only line clamp you need for Vue.",
      width: 640,
      style: "display:inline-block;width:auto",
      split() {
        return {
          start: "The only ",
          body: "line",
          end: " clamp you need for Vue.",
        };
      },
    });

    await settle();

    const root = rootElement(mountedClamp.container);
    const renderedWidth = root.getBoundingClientRect().width;
    const expectedWidth = measureReferenceWidth("The only line clamp you need for Vue.");
    const collapsedWidth = measureReferenceWidth("The onlylineclamp you need for Vue.");

    expect(Math.abs(renderedWidth - expectedWidth)).toBeLessThan(1.5);
    expect(Math.abs(renderedWidth - expectedWidth)).toBeLessThan(
      Math.abs(renderedWidth - collapsedWidth),
    );
  });
});
