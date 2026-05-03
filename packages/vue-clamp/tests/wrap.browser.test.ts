import { afterEach, describe, expect, it } from "vite-plus/test";
import { Comment, createApp, defineComponent, h, nextTick, ref } from "vue";
import { WrapClamp } from "../src/index.ts";
import { frame } from "./browser.ts";

import type { App, Ref, VNodeChild } from "vue";
import type { WrapClampExposed, WrapClampItemSlotProps, WrapClampSlotProps } from "../src/index.ts";

type MountedWrapClamp = {
  app: App;
  container: HTMLElement;
  exposed: Ref<WrapClampExposed | null>;
  items: Ref<readonly string[]>;
  width: Ref<number>;
};

type MountWrapOptions = {
  items: readonly string[];
  width?: number;
  as?: string;
  dir?: "ltr" | "rtl";
  props?: Record<string, unknown>;
  style?: string;
  item?: (props: WrapClampItemSlotProps<string>) => VNodeChild;
  before?: (props: WrapClampSlotProps<string>) => VNodeChild;
  after?: (props: WrapClampSlotProps<string>) => VNodeChild;
};

const mounted = new Set<MountedWrapClamp>();

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

const badgeStyle = [
  "display:inline-flex",
  "align-items:center",
  "padding:0 8px",
  "height:24px",
  "border:1px solid currentColor",
  "border-radius:999px",
  "margin-inline-end:6px",
  "margin-block-end:6px",
  "white-space:nowrap",
].join(";");

function fixedBadgeStyle(width: number): string {
  return [
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    `width:${width}px`,
    "height:24px",
    "border:1px solid currentColor",
    "border-radius:999px",
    "margin-inline-end:6px",
    "margin-block-end:6px",
    "white-space:nowrap",
  ].join(";");
}

async function settle(frames = 3): Promise<void> {
  for (let index = 0; index < frames; index += 1) {
    await nextTick();
    await frame();
  }
}

function mountWrapClamp(options: MountWrapOptions): MountedWrapClamp {
  const items = ref(options.items);
  const exposed = ref<WrapClampExposed | null>(null);
  const width = ref(options.width ?? 200);
  const container = document.createElement("div");
  if (options.dir) {
    container.dir = options.dir;
  }
  document.body.append(container);

  const Host = defineComponent({
    setup() {
      return () => {
        const props: Record<string, unknown> = {
          ref: exposed,
          ...options.props,
          items: items.value,
          style: hostStyle(width.value, options.style),
        };

        if (options.as) {
          props.as = options.as;
        }

        return h(WrapClamp, props, {
          item: options.item,
          before: options.before,
          after: options.after,
        });
      };
    },
  });

  const app = createApp(Host);
  app.mount(container);

  const mountedClamp = {
    app,
    container,
    exposed,
    items,
    width,
  };
  mounted.add(mountedClamp);
  return mountedClamp;
}

function rootElement(container: HTMLElement): HTMLElement {
  const root = container.firstElementChild;
  if (!(root instanceof HTMLElement)) {
    throw new Error("Expected wrap clamp root element.");
  }

  return root;
}

function wrapItems(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll('[data-part="item"]')).filter(
    (item): item is HTMLElement => item instanceof HTMLElement,
  );
}

function wrapContent(root: HTMLElement): HTMLElement {
  const content = root.querySelector('[data-part="content"]');
  if (!(content instanceof HTMLElement)) {
    throw new Error("Expected wrap clamp content element.");
  }

  return content;
}

function wrapBefore(root: HTMLElement): HTMLElement | null {
  const element = root.querySelector('[data-part="before"]');
  return element instanceof HTMLElement ? element : null;
}

function wrapAfter(root: HTMLElement): HTMLElement | null {
  const element = root.querySelector('[data-part="after"]');
  return element instanceof HTMLElement ? element : null;
}

function wrapSnapshot(root: HTMLElement): { after: string | null; items: string[] } {
  return {
    after: wrapAfter(root)?.textContent?.trim() ?? null,
    items: wrapItems(root).map((item) => item.textContent?.trim() ?? ""),
  };
}

function wrapLineCount(root: HTMLElement): number {
  const tops: number[] = [];

  for (const child of wrapContent(root).children) {
    if (!(child instanceof HTMLElement)) {
      continue;
    }

    const part = child.dataset.part;
    if (part !== "before" && part !== "item" && part !== "after") {
      continue;
    }

    const rect = child.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      continue;
    }

    if (!tops.some((top) => Math.abs(top - rect.top) <= 0.5)) {
      tops.push(rect.top);
    }
  }

  return tops.length;
}

afterEach(() => {
  for (const mountedClamp of mounted) {
    mountedClamp.app.unmount();
    mountedClamp.container.remove();
  }

  mounted.clear();
});

describe("WrapClamp browser contract", () => {
  it("renders the requested root tag and falls back to stringified items", async () => {
    const mountedClamp = mountWrapClamp({
      items: ["Alpha", "Beta", "Gamma"],
      as: "article",
    });

    await settle();

    const root = rootElement(mountedClamp.container);
    expect(root.tagName).toBe("ARTICLE");
    expect(root.getAttribute("data-part")).toBe("root");
    expect(getComputedStyle(wrapContent(root)).display).toBe("inline-flex");
    expect(getComputedStyle(wrapContent(root)).flexWrap).toBe("wrap");
    expect(wrapItems(root).map((item) => item.textContent?.trim())).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);
  });

  it("clamps wrapped items by lines and exposes hidden counts to the after slot", async () => {
    const items = ["Design", "Docs", "Testing", "Accessibility", "Performance"] as const;
    const mountedClamp = mountWrapClamp({
      items,
      props: {
        maxLines: 1,
      },
      width: 190,
      item: ({ item }) => h("span", { style: badgeStyle }, item),
      after: ({ clamped, hiddenItems }) =>
        clamped ? h("span", { style: badgeStyle }, `+${hiddenItems.length}`) : null,
    });

    await settle(5);

    const root = rootElement(mountedClamp.container);
    const renderedItems = wrapItems(root);
    const after = wrapAfter(root);

    if (!after) {
      throw new Error("Expected the wrap clamp after slot.");
    }

    expect(renderedItems.length).toBeGreaterThan(0);
    expect(renderedItems.length).toBeLessThan(items.length);
    expect(after.textContent).toBe(`+${items.length - renderedItems.length}`);
    expect(renderedItems.map((item) => item.textContent?.trim())).toEqual(
      items.slice(0, renderedItems.length),
    );
  });

  it("grows the visible prefix when a multiline clamp gets more width", async () => {
    const mountedClamp = mountWrapClamp({
      items: ["One", "Two", "Three", "Four", "Five", "Six"],
      props: {
        maxLines: 2,
      },
      width: 140,
      item: ({ item }) => h("span", { style: fixedBadgeStyle(72) }, item),
      after: ({ clamped, hiddenItems }) =>
        clamped ? h("span", { style: fixedBadgeStyle(72) }, `+${hiddenItems.length}`) : null,
    });

    await settle(5);

    const initialVisibleCount = wrapItems(rootElement(mountedClamp.container)).length;
    expect(initialVisibleCount).toBeLessThan(6);

    mountedClamp.width.value = 240;
    await settle(8);

    expect(wrapItems(rootElement(mountedClamp.container)).length).toBeGreaterThan(
      initialVisibleCount,
    );
  });

  it("uses the one-line calculation path when the after width depends on hiddenItems length", async () => {
    const mountedClamp = mountWrapClamp({
      items: ["Alpha", "Beta", "Gamma"],
      props: {
        maxLines: 1,
      },
      width: 140,
      item: ({ item }) => h("span", { style: fixedBadgeStyle(48) }, item),
      after: ({ clamped, hiddenItems }) =>
        clamped
          ? h(
              "span",
              { style: fixedBadgeStyle(hiddenItems.length === 2 ? 60 : 28) },
              `+${hiddenItems.length}`,
            )
          : null,
    });

    await settle(5);
    expect(wrapSnapshot(rootElement(mountedClamp.container))).toEqual({
      after: "+2",
      items: ["Alpha"],
    });

    mountedClamp.width.value = 160;
    await settle(5);
    expect(wrapSnapshot(rootElement(mountedClamp.container))).toEqual({
      after: "+1",
      items: ["Alpha", "Beta"],
    });
  });

  it("settles across a hiddenItems digit boundary when grow changes after width", async () => {
    const items = Array.from({ length: 20 }, (_, index) => `I${index + 1}`);
    const mountedClamp = mountWrapClamp({
      items,
      props: {
        maxLines: 1,
      },
      width: 324,
      item: ({ item }) => h("span", { style: fixedBadgeStyle(20) }, item),
      after: ({ clamped, hiddenItems }) =>
        clamped
          ? h(
              "span",
              { style: fixedBadgeStyle(hiddenItems.length >= 10 ? 64 : 32) },
              `+${hiddenItems.length}`,
            )
          : null,
    });

    await settle(5);
    expect(wrapSnapshot(rootElement(mountedClamp.container))).toEqual({
      after: "+11",
      items: items.slice(0, 9),
    });

    mountedClamp.width.value = 420;
    await settle(8);

    const root = rootElement(mountedClamp.container);
    const grownSnapshot = wrapSnapshot(root);
    const hiddenCount = items.length - grownSnapshot.items.length;
    expect(hiddenCount).toBeGreaterThan(0);
    expect(hiddenCount).toBeLessThan(10);
    expect(grownSnapshot.after).toBe(`+${hiddenCount}`);
    expect(grownSnapshot.items).toEqual(items.slice(0, grownSnapshot.items.length));
    expect(wrapLineCount(root)).toBeLessThanOrEqual(1);
  });

  it("falls back cleanly when a single item is wider than the container", async () => {
    const mountedClamp = mountWrapClamp({
      items: ["Oversized", "Two", "Three"],
      props: {
        maxLines: 1,
      },
      width: 170,
      item: ({ item }) =>
        h("span", { style: fixedBadgeStyle(item === "Oversized" ? 220 : 72) }, item),
    });

    await settle(5);
    expect(wrapSnapshot(rootElement(mountedClamp.container))).toEqual({
      after: null,
      items: ["Oversized"],
    });
  });

  it("recomputes from live DOM when a hidden item changes width", async () => {
    function itemWidth(item: string): number {
      if (item === "BetaBetaBetaBeta") {
        return 112;
      }

      if (item === "B") {
        return 28;
      }

      return 72;
    }

    const mountedClamp = mountWrapClamp({
      items: ["Alpha", "BetaBetaBetaBeta", "Gamma"],
      props: {
        maxLines: 1,
      },
      width: 260,
      item: ({ item }) => h("span", { style: fixedBadgeStyle(itemWidth(item)) }, item),
      after: ({ clamped, hiddenItems }) =>
        clamped ? h("span", { style: fixedBadgeStyle(40) }, `+${hiddenItems.length}`) : null,
    });

    await settle(5);

    expect(
      wrapItems(rootElement(mountedClamp.container)).map((item) => item.textContent?.trim()),
    ).toEqual(["Alpha", "BetaBetaBetaBeta"]);

    mountedClamp.width.value = 170;
    await settle(5);

    expect(
      wrapItems(rootElement(mountedClamp.container)).map((item) => item.textContent?.trim()),
    ).toEqual(["Alpha"]);

    mountedClamp.items.value = ["Alpha", "B", "Gamma"];
    await settle(5);

    const root = rootElement(mountedClamp.container);
    expect(wrapItems(root).map((item) => item.textContent?.trim())).toEqual(["Alpha", "B"]);
    expect(wrapAfter(root)?.textContent?.trim()).toBe("+1");
  });

  it("emits update:expanded and lets after render More/Less controls", async () => {
    const values: boolean[] = [];
    const mountedClamp = mountWrapClamp({
      items: ["Alpha", "Beta", "Gamma", "Delta"],
      props: {
        maxLines: 1,
        "onUpdate:expanded"(value: boolean) {
          values.push(value);
        },
      },
      width: 170,
      item: ({ item }) => h("span", { style: badgeStyle }, item),
      after: ({ clamped, expanded, toggle }) =>
        expanded || clamped
          ? h(
              "button",
              { style: badgeStyle, type: "button", onClick: toggle },
              expanded ? "Less" : "More",
            )
          : null,
    });

    await settle(5);

    const root = rootElement(mountedClamp.container);
    expect(wrapAfter(root)?.textContent?.trim()).toBe("More");

    (mountedClamp.exposed.value as WrapClampExposed).toggle();
    await settle(5);

    expect(values.at(-1)).toBe(true);
    expect(wrapItems(rootElement(mountedClamp.container)).length).toBe(4);
    expect(wrapAfter(rootElement(mountedClamp.container))?.textContent?.trim()).toBe("Less");
  });

  it("clamps by maxHeight when wrapped items exceed the visible block size", async () => {
    const mountedClamp = mountWrapClamp({
      items: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"],
      props: {
        maxHeight: "30px",
      },
      width: 190,
      item: ({ item }) => h("span", { style: badgeStyle }, item),
      after: ({ clamped, hiddenItems }) =>
        clamped ? h("span", { style: badgeStyle }, `+${hiddenItems.length}`) : null,
    });

    await settle(5);

    const root = rootElement(mountedClamp.container);
    expect(root.clientHeight).toBeLessThanOrEqual(30);
    expect(wrapItems(root).length).toBeLessThan(5);
    expect(wrapAfter(root)?.textContent).not.toBeNull();
  });

  it("keeps the after slot at logical inline-end in RTL mode", async () => {
    const mountedClamp = mountWrapClamp({
      dir: "rtl",
      items: ["Alpha", "Beta", "Gamma", "Delta"],
      props: {
        maxLines: 1,
      },
      width: 170,
      item: ({ item }) => h("span", { style: badgeStyle }, item),
      after: ({ clamped, hiddenItems }) =>
        clamped ? h("span", { style: badgeStyle }, `+${hiddenItems.length}`) : null,
    });

    await settle(5);

    const root = rootElement(mountedClamp.container);
    const firstItem = wrapItems(root).at(0);
    const after = wrapAfter(root);

    if (!firstItem || !after) {
      throw new Error("Expected visible wrap items and an after slot.");
    }

    const itemRect = firstItem.getBoundingClientRect();
    const afterRect = after.getBoundingClientRect();

    expect(Math.abs(itemRect.top - afterRect.top)).toBeLessThan(1);
    expect(afterRect.left).toBeLessThan(itemRect.left);
  });

  it("renders a before slot as an atomic wrapper", async () => {
    const mountedClamp = mountWrapClamp({
      items: ["Alpha", "Beta", "Gamma"],
      props: {
        maxLines: 1,
      },
      width: 170,
      item: ({ item }) => h("span", { style: badgeStyle }, item),
      before: ({ clamped }) => (clamped ? h("span", { style: badgeStyle }, "Before") : null),
    });

    await settle(5);

    expect(wrapBefore(rootElement(mountedClamp.container))?.textContent?.trim()).toBe("Before");
  });

  it("does not render before and after wrappers for empty slot output", async () => {
    const mountedClamp = mountWrapClamp({
      items: ["Alpha", "Beta", "Gamma"],
      props: {
        maxLines: 1,
      },
      width: 170,
      item: ({ item }) => h("span", { style: badgeStyle }, item),
      before: () => [],
      after: () => h(Comment),
    });

    await settle(5);

    const root = rootElement(mountedClamp.container);
    expect(wrapBefore(root)).toBeNull();
    expect(wrapAfter(root)).toBeNull();
  });

  it("settles instead of continuously rerendering after clamping", async () => {
    let slotRenderCount = 0;

    const mountedClamp = mountWrapClamp({
      items: ["Design", "Docs", "Testing", "Accessibility", "Performance"],
      props: {
        maxLines: 1,
      },
      width: 190,
      item: ({ item }) => {
        slotRenderCount += 1;
        return h("span", { style: badgeStyle }, item);
      },
      after: ({ clamped, hiddenItems }) => {
        slotRenderCount += 1;
        return clamped ? h("span", { style: badgeStyle }, `+${hiddenItems.length}`) : null;
      },
    });

    await settle(5);

    const stableCount = slotRenderCount;
    expect(wrapItems(rootElement(mountedClamp.container)).length).toBeLessThan(5);

    await settle(5);

    expect(slotRenderCount).toBe(stableCount);
  });
});
