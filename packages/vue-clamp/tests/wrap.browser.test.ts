import { afterEach, describe, expect, it } from "vite-plus/test";
import { Comment, createApp, defineComponent, h, nextTick, ref } from "vue";
import { WrapClamp } from "../src/index.ts";
import { frame } from "./browser.ts";

import type { App, DefineComponent, Ref, VNodeChild } from "vue";
import type {
  WrapClampExposed,
  WrapClampItemSlotProps,
  WrapClampProps,
  WrapClampSlotProps,
} from "../src/index.ts";

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
type MixedHeightAlignment = "baseline" | "center" | "flex-end";

const mounted = new Set<MountedWrapClamp>();
const StringWrapClamp = WrapClamp as unknown as DefineComponent<WrapClampProps<string>>;

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

function mixedHeightAlignmentItemStyle(alignment: MixedHeightAlignment, index: number): string {
  const common = [
    "width:64px",
    "border:1px solid currentColor",
    "box-sizing:border-box",
    "white-space:nowrap",
  ];

  if (alignment === "baseline") {
    return [
      "display:inline-block",
      ...common,
      `font-size:${index === 0 ? 30 : 12}px`,
      `line-height:${index === 0 ? 34 : 14}px`,
    ].join(";");
  }

  return [
    "display:inline-flex",
    `align-items:${alignment}`,
    "justify-content:center",
    ...common,
    `height:${index === 0 ? 44 : 18}px`,
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
        const props: WrapClampProps<string> & Record<string, unknown> = {
          ref: exposed,
          ...options.props,
          items: items.value,
          style: hostStyle(width.value, options.style),
        };

        if (options.as) {
          props.as = options.as;
        }

        return h(StringWrapClamp, props, {
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
  let lineCount = 0;
  let lineTop = 0;
  let lineBottom = 0;

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

    if (lineCount === 0) {
      lineCount = 1;
      lineTop = rect.top;
      lineBottom = rect.bottom;
    } else {
      const verticalOverlap = Math.min(rect.bottom, lineBottom) - Math.max(rect.top, lineTop);
      const smallerHeight = Math.min(rect.height, lineBottom - lineTop);

      if (verticalOverlap <= Math.min(0.5, smallerHeight / 2)) {
        lineCount += 1;
        lineTop = rect.top;
        lineBottom = rect.bottom;
      } else {
        lineTop = Math.min(lineTop, rect.top);
        lineBottom = Math.max(lineBottom, rect.bottom);
      }
    }
  }

  return lineCount;
}

function expectVisibleAtomicBoxesWithinRoot(root: HTMLElement): void {
  const rootRect = root.getBoundingClientRect();
  const visibleBottom = rootRect.top + root.clientTop + root.clientHeight;

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

    expect(rect.bottom).toBeLessThanOrEqual(visibleBottom + 0.5);
  }
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

  it("restores a no-affix multiline prefix after a width jump", async () => {
    const items = ["One", "Two", "Three", "Four", "Five", "Six", "Seven"];
    const mountedClamp = mountWrapClamp({
      items,
      props: {
        maxLines: 2,
      },
      width: 340,
      item: ({ item }) => h("span", { style: fixedBadgeStyle(68) }, item),
    });

    await settle(5);

    expect(wrapSnapshot(rootElement(mountedClamp.container))).toEqual({
      after: null,
      items,
    });

    mountedClamp.width.value = 150;
    await settle(6);

    const shrunkSnapshot = wrapSnapshot(rootElement(mountedClamp.container));
    expect(shrunkSnapshot.after).toBeNull();
    expect(shrunkSnapshot.items.length).toBeLessThan(items.length);
    expect(shrunkSnapshot.items).toEqual(items.slice(0, shrunkSnapshot.items.length));

    mountedClamp.width.value = 340;
    await settle(6);

    expect(wrapSnapshot(rootElement(mountedClamp.container))).toEqual({
      after: null,
      items,
    });
  });

  it("does not leave materialized no-affix probe items after hidden grow", async () => {
    const items = Array.from({ length: 24 }, (_, index) => `I${index + 1}`);
    const mountedClamp = mountWrapClamp({
      items,
      props: {
        maxLines: 2,
      },
      width: 120,
      item: ({ item }) => h("span", { style: fixedBadgeStyle(40) }, item),
    });

    await settle(5);

    const initialVisibleCount = wrapItems(rootElement(mountedClamp.container)).length;
    expect(initialVisibleCount).toBeLessThan(items.length);

    mountedClamp.width.value = 520;
    await settle(8);

    const root = rootElement(mountedClamp.container);
    const visibleItems = wrapItems(root);
    expect(visibleItems.length).toBeGreaterThan(initialVisibleCount);
    expect(visibleItems.map((item) => item.textContent?.trim())).toEqual(
      items.slice(0, visibleItems.length),
    );
    expect(root.querySelector('[data-part="item"][aria-hidden="true"]')).toBeNull();
  });

  it("restores a wide no-affix grow frontier above the old fixed budget", async () => {
    const items = Array.from({ length: 120 }, (_, index) => `I${index + 1}`);
    const mountedClamp = mountWrapClamp({
      items,
      props: {
        maxLines: 2,
      },
      width: 120,
      item: ({ item }) => h("span", { style: fixedBadgeStyle(16) }, item),
    });

    await settle(5);

    const initialVisibleCount = wrapItems(rootElement(mountedClamp.container)).length;
    expect(initialVisibleCount).toBeLessThan(32);

    mountedClamp.width.value = 960;
    await settle(8);

    const root = rootElement(mountedClamp.container);
    const visibleItems = wrapItems(root);
    expect(visibleItems.length).toBeGreaterThan(32);
    expect(visibleItems.map((item) => item.textContent?.trim())).toEqual(
      items.slice(0, visibleItems.length),
    );
    expect(root.querySelector('[data-part="item"][aria-hidden="true"]')).toBeNull();
  });

  it("continues settling after fallback-budget materialized grow starts without measured widths", async () => {
    const initialItems = Array.from({ length: 60 }, (_, index) => `Wide${index + 1}`);
    const nextItems = Array.from({ length: 60 }, (_, index) => `N${index + 1}`);
    const mountedClamp = mountWrapClamp({
      items: initialItems,
      props: {
        maxLines: 2,
      },
      width: 120,
      item: ({ item }) =>
        h("span", { style: fixedBadgeStyle(item.startsWith("Wide") ? 96 : 16) }, item),
    });

    await settle(5);

    const initialVisibleCount = wrapItems(rootElement(mountedClamp.container)).length;
    expect(initialVisibleCount).toBeGreaterThan(0);
    expect(initialVisibleCount).toBeLessThan(32);

    mountedClamp.items.value = nextItems;
    mountedClamp.width.value = 520;
    await settle(12);

    const root = rootElement(mountedClamp.container);
    const visibleItems = wrapItems(root);
    expect(visibleItems.length).toBeGreaterThan(32);
    expect(visibleItems.map((item) => item.textContent?.trim())).toEqual(
      nextItems.slice(0, visibleItems.length),
    );
    expect(wrapLineCount(root)).toBeLessThanOrEqual(2);
    expect(root.querySelector('[data-part="item"][aria-hidden="true"]')).toBeNull();
  });

  it("restores a before-only grow frontier when the before geometry is stable", async () => {
    const items = Array.from({ length: 24 }, (_, index) => `I${index + 1}`);
    const mountedClamp = mountWrapClamp({
      items,
      props: {
        maxLines: 2,
      },
      width: 120,
      before: () => h("span", { style: fixedBadgeStyle(72) }, "Lead"),
      item: ({ item }) => h("span", { style: fixedBadgeStyle(40) }, item),
    });

    await settle(5);

    const initialVisibleCount = wrapItems(rootElement(mountedClamp.container)).length;
    expect(initialVisibleCount).toBeLessThan(items.length);

    mountedClamp.width.value = 520;
    await settle(8);

    const root = rootElement(mountedClamp.container);
    const visibleItems = wrapItems(root);
    expect(wrapBefore(root)?.textContent?.trim()).toBe("Lead");
    expect(visibleItems.length).toBeGreaterThan(initialVisibleCount);
    expect(visibleItems.map((item) => item.textContent?.trim())).toEqual(
      items.slice(0, visibleItems.length),
    );
    expect(root.querySelector('[data-part="item"][aria-hidden="true"]')).toBeNull();
  });

  it("falls back when a before slot changes geometry after grow", async () => {
    const items = Array.from({ length: 20 }, (_, index) => `I${index + 1}`);
    const mountedClamp = mountWrapClamp({
      items,
      props: {
        maxLines: 2,
      },
      width: 120,
      before: ({ hiddenItems }) =>
        h("span", { style: fixedBadgeStyle(hiddenItems.length >= 10 ? 160 : 40) }, "Lead"),
      item: ({ item }) => h("span", { style: fixedBadgeStyle(40) }, item),
    });

    await settle(5);

    mountedClamp.width.value = 520;
    await settle(10);

    const root = rootElement(mountedClamp.container);
    const visibleItems = wrapItems(root);
    const hiddenCount = items.length - visibleItems.length;
    expect(hiddenCount).toBeGreaterThanOrEqual(0);
    expect(hiddenCount).toBeLessThan(10);
    expect(visibleItems.map((item) => item.textContent?.trim())).toEqual(
      items.slice(0, visibleItems.length),
    );
    expect(wrapLineCount(root)).toBeLessThanOrEqual(2);
    expect(root.querySelector('[data-part="item"][aria-hidden="true"]')).toBeNull();
  });

  it("jumps from a static before and dynamic after hint back to a verified live-DOM result", async () => {
    const items = Array.from({ length: 24 }, (_, index) => `I${index + 1}`);
    const mountedClamp = mountWrapClamp({
      items,
      props: {
        maxLines: 2,
      },
      width: 120,
      before: () => h("span", { style: fixedBadgeStyle(72) }, "Lead"),
      item: ({ item }) => h("span", { style: fixedBadgeStyle(40) }, item),
      after: ({ clamped, hiddenItems }) =>
        clamped
          ? h(
              "span",
              { style: fixedBadgeStyle(hiddenItems.length >= 10 ? 68 : 32) },
              `+${hiddenItems.length}`,
            )
          : null,
    });

    await settle(5);

    const initialVisibleCount = wrapItems(rootElement(mountedClamp.container)).length;
    expect(initialVisibleCount).toBeLessThan(items.length);

    mountedClamp.width.value = 520;
    await settle(10);

    const root = rootElement(mountedClamp.container);
    const grownSnapshot = wrapSnapshot(root);
    const hiddenCount = items.length - grownSnapshot.items.length;
    expect(grownSnapshot.items.length).toBeGreaterThan(initialVisibleCount);
    expect(grownSnapshot.items).toEqual(items.slice(0, grownSnapshot.items.length));
    expect(grownSnapshot.after).toBe(hiddenCount > 0 ? `+${hiddenCount}` : null);
    expect(wrapBefore(root)?.textContent?.trim()).toBe("Lead");
    expect(wrapLineCount(root)).toBeLessThanOrEqual(2);
    expect(root.querySelector('[data-part="item"][aria-hidden="true"]')).toBeNull();
  });

  it("falls back when a before slot changes geometry after shrink", async () => {
    const items = Array.from({ length: 20 }, (_, index) => `I${index + 1}`);
    const mountedClamp = mountWrapClamp({
      items,
      props: {
        maxLines: 2,
      },
      width: 520,
      before: ({ hiddenItems }) =>
        h("span", { style: fixedBadgeStyle(hiddenItems.length >= 10 ? 160 : 40) }, "Lead"),
      item: ({ item }) => h("span", { style: fixedBadgeStyle(40) }, item),
    });

    await settle(5);

    mountedClamp.width.value = 120;
    await settle(10);

    const root = rootElement(mountedClamp.container);
    const visibleItems = wrapItems(root);
    expect(visibleItems.map((item) => item.textContent?.trim())).toEqual(
      items.slice(0, visibleItems.length),
    );
    expect(wrapLineCount(root)).toBeLessThanOrEqual(2);
    expect(root.querySelector('[data-part="item"][aria-hidden="true"]')).toBeNull();
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

  it("settles across a hiddenItems digit boundary when shrink changes after width", async () => {
    const items = Array.from({ length: 20 }, (_, index) => `I${index + 1}`);
    const mountedClamp = mountWrapClamp({
      items,
      props: {
        maxLines: 1,
      },
      width: 420,
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

    await settle(8);

    const initialSnapshot = wrapSnapshot(rootElement(mountedClamp.container));
    expect(items.length - initialSnapshot.items.length).toBeLessThan(10);

    mountedClamp.width.value = 324;
    await settle(8);

    const root = rootElement(mountedClamp.container);
    expect(wrapSnapshot(root)).toEqual({
      after: "+11",
      items: items.slice(0, 9),
    });
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

  it("shrinks a no-after maxHeight clamp from the current visible prefix", async () => {
    const items = Array.from({ length: 24 }, (_, index) => `I${index + 1}`);
    const mountedClamp = mountWrapClamp({
      items,
      props: {
        maxHeight: "60px",
      },
      width: 520,
      item: ({ item }) => h("span", { style: fixedBadgeStyle(40) }, item),
    });

    await settle(5);

    const initialCount = wrapItems(rootElement(mountedClamp.container)).length;
    expect(initialCount).toBeGreaterThan(0);

    mountedClamp.width.value = 120;
    await settle(8);

    const root = rootElement(mountedClamp.container);
    const visibleItems = wrapItems(root);
    expect(root.clientHeight).toBeLessThanOrEqual(60);
    expect(visibleItems.length).toBeLessThan(initialCount);
    expect(visibleItems.map((item) => item.textContent?.trim())).toEqual(
      items.slice(0, visibleItems.length),
    );
    expect(root.querySelector('[data-part="item"][aria-hidden="true"]')).toBeNull();
  });

  it("grows a no-after maxHeight clamp without leaving materialized probe items", async () => {
    const items = Array.from({ length: 24 }, (_, index) => `I${index + 1}`);
    const mountedClamp = mountWrapClamp({
      items,
      props: {
        maxHeight: "60px",
      },
      width: 120,
      item: ({ item }) => h("span", { style: fixedBadgeStyle(40) }, item),
    });

    await settle(5);

    const initialCount = wrapItems(rootElement(mountedClamp.container)).length;
    expect(initialCount).toBeGreaterThan(0);
    expect(initialCount).toBeLessThan(items.length);

    mountedClamp.width.value = 520;
    await settle(8);

    const root = rootElement(mountedClamp.container);
    const visibleItems = wrapItems(root);
    expect(root.clientHeight).toBeLessThanOrEqual(60);
    expect(visibleItems.length).toBeGreaterThan(initialCount);
    expect(visibleItems.map((item) => item.textContent?.trim())).toEqual(
      items.slice(0, visibleItems.length),
    );
    expectVisibleAtomicBoxesWithinRoot(root);
    expect(root.querySelector('[data-part="item"][aria-hidden="true"]')).toBeNull();
  });

  it("clamps wrapped items when content has CSS gap", async () => {
    const style = document.createElement("style");
    style.textContent = `
      [data-wrap-gap] [data-part="content"] {
        column-gap: 8px;
        row-gap: 6px;
      }
    `;
    document.head.append(style);

    try {
      const items = Array.from({ length: 24 }, (_, index) => `I${index + 1}`);
      const mountedClamp = mountWrapClamp({
        items,
        props: {
          "data-wrap-gap": "",
          maxLines: 2,
        },
        width: 120,
        item: ({ item }) => h("span", { style: fixedBadgeStyle(40) }, item),
      });

      await settle(5);

      const initialCount = wrapItems(rootElement(mountedClamp.container)).length;
      expect(initialCount).toBeGreaterThan(0);
      expect(wrapLineCount(rootElement(mountedClamp.container))).toBeLessThanOrEqual(2);

      mountedClamp.width.value = 520;
      await settle(8);

      const root = rootElement(mountedClamp.container);
      const visibleItems = wrapItems(root);
      expect(visibleItems.length).toBeGreaterThan(initialCount);
      expect(wrapLineCount(root)).toBeLessThanOrEqual(2);
      expect(visibleItems.map((item) => item.textContent?.trim())).toEqual(
        items.slice(0, visibleItems.length),
      );
      expect(root.querySelector('[data-part="item"][aria-hidden="true"]')).toBeNull();
    } finally {
      style.remove();
    }
  });

  it("keeps aligned mixed-height items on the same wrap line", async () => {
    const style = document.createElement("style");
    style.textContent = `
      [data-wrap-align] [data-part="content"] {
        gap: 0;
      }
      [data-wrap-align="center"] [data-part="content"] { align-items: center; }
      [data-wrap-align="flex-end"] [data-part="content"] { align-items: flex-end; }
      [data-wrap-align="baseline"] [data-part="content"] { align-items: baseline; }
    `;
    document.head.append(style);

    try {
      const cases: Array<{ alignment: MixedHeightAlignment; items: readonly string[] }> = [
        {
          alignment: "center",
          items: ["Tall", "Short", "Next"],
        },
        {
          alignment: "flex-end",
          items: ["Tall", "Short", "Next"],
        },
        {
          alignment: "baseline",
          items: ["Large", "Small", "Next"],
        },
      ];

      for (const { alignment, items } of cases) {
        const mountedClamp = mountWrapClamp({
          items,
          props: {
            "data-wrap-align": alignment,
            maxLines: 1,
          },
          width: 150,
          item: ({ index, item }) =>
            h("span", { style: mixedHeightAlignmentItemStyle(alignment, index) }, item),
        });

        await settle(6);

        const root = rootElement(mountedClamp.container);
        const visibleItems = wrapItems(root);
        expect(visibleItems.map((item) => item.textContent?.trim())).toEqual(items.slice(0, 2));
        expect(wrapLineCount(root)).toBe(1);

        const [first, second] = visibleItems;
        if (!first || !second) {
          throw new Error(`Expected two visible ${alignment} mixed-height items.`);
        }
        expect(
          Math.abs(first.getBoundingClientRect().top - second.getBoundingClientRect().top),
        ).toBeGreaterThan(0.5);
      }
    } finally {
      style.remove();
    }
  });

  it("settles when item slot widths change without replacing the item array", async () => {
    const wide = ref(false);
    const items = Array.from({ length: 16 }, (_, index) => `I${index + 1}`);
    const mountedClamp = mountWrapClamp({
      items,
      props: {
        maxLines: 2,
      },
      width: 260,
      item: ({ item }) => h("span", { style: fixedBadgeStyle(wide.value ? 72 : 32) }, item),
    });

    await settle(6);

    const initialRoot = rootElement(mountedClamp.container);
    const initialCount = wrapItems(initialRoot).length;
    expect(initialCount).toBeGreaterThan(0);
    expect(wrapLineCount(initialRoot)).toBeLessThanOrEqual(2);

    wide.value = true;
    await settle(10);

    const widerRoot = rootElement(mountedClamp.container);
    const widerItems = wrapItems(widerRoot);
    expect(widerItems.length).toBeLessThan(initialCount);
    expect(wrapLineCount(widerRoot)).toBeLessThanOrEqual(2);
    expect(widerItems.map((item) => item.textContent?.trim())).toEqual(
      items.slice(0, widerItems.length),
    );
    expect(widerRoot.querySelector('[data-part="item"][aria-hidden="true"]')).toBeNull();

    wide.value = false;
    await settle(10);

    const narrowRoot = rootElement(mountedClamp.container);
    const narrowItems = wrapItems(narrowRoot);
    expect(narrowItems.length).toBeGreaterThan(widerItems.length);
    expect(wrapLineCount(narrowRoot)).toBeLessThanOrEqual(2);
    expect(narrowItems.map((item) => item.textContent?.trim())).toEqual(
      items.slice(0, narrowItems.length),
    );
    expect(narrowRoot.querySelector('[data-part="item"][aria-hidden="true"]')).toBeNull();
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
