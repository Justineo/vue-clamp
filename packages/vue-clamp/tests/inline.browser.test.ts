import { afterEach, describe, expect, it } from "vite-plus/test";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { InlineClamp } from "../src/index.ts";
import { frame } from "./browser.ts";

import type { App, Ref } from "vue";
import type { InlineClampSplit } from "../src/index.ts";

type MountedInlineClamp = {
  app: App;
  container: HTMLElement;
  text: Ref<string>;
};

type MountInlineOptions = {
  text: string;
  width?: number;
  as?: string;
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
          split?: InlineClampSplit;
        } = {
          style: hostStyle(options.width ?? 180, options.style),
          text: text.value,
        };

        if (typeof options.as === "string") {
          props.as = options.as;
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

  it("keeps the end segment visible while the body uses native ellipsis", async () => {
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

    expect(body.textContent).toBe("very-long-generated-types");
    expect(end.textContent).toBe(".d.ts");
    expect(root.textContent).toBe("very-long-generated-types.d.ts");
    expect(getComputedStyle(body).textOverflow).toBe("ellipsis");
    expect(body.scrollWidth).toBeGreaterThan(body.clientWidth);
  });

  it("recomputes start, body, and end segments when the source text changes", async () => {
    const mountedClamp = mountInlineClamp({
      text: "/Users/justineo/really-long-report.pdf",
      width: 180,
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
});
