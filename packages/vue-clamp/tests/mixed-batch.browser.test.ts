import { afterEach, describe, expect, it } from "vite-plus/test";
import { createApp, h, ref } from "vue";
import { InlineClamp, LineClamp, RichLineClamp, WrapClamp } from "../src/index.ts";
import { LineClamp as PretextLineClamp } from "../src/pretext.ts";
import { settle } from "./browser.ts";
import type { App, Component } from "vue";
import type { ClampSlotProps } from "../src/types.ts";
import type { WrapClampItemSlotProps, WrapClampSlotProps } from "../src/index.ts";

const mounted: { app: App; container: HTMLElement }[] = [];
afterEach(() => {
  for (const { app, container } of mounted.splice(0)) {
    app.unmount();
    container.remove();
  }
});

const kinds = ["inline", "wrap", "line", "rich", "pretext"] as const;
type Kind = (typeof kinds)[number];
const components: Record<Kind, Component> = {
  inline: InlineClamp,
  line: LineClamp,
  rich: RichLineClamp,
  wrap: WrapClamp as Component,
  pretext: PretextLineClamp,
};
const split = (text: string) => ({ start: "/src/", body: text, end: ".vue" });
const copy =
  "Operational dashboards preserve incident context while surrounding panels change their layout. ";

function fixture({ coupling }: { coupling?: "wrap" | "rich" } = {}) {
  const width = ref(260);
  const revision = ref(0);
  const rootTag = ref("div");
  const fontSize = ref(16);
  const expanded = ref(false);
  const dynamicAfter = ref(true);
  const count = ref(15);
  const container = document.createElement("div");
  document.body.append(container);
  function renderClamp(index: number, style: string) {
    const kind = kinds[index % kinds.length]!;
    const source =
      revision.value % 3 === 1 ? `Short ${index}` : `${copy.repeat(2)}${revision.value}/${index}`;
    const props = { as: rootTag.value, style, class: kind, expanded: expanded.value };
    const slots = {
      before: () => h("b", { style: "font:inherit" }, "Tag "),
      after: ({ clamped }: ClampSlotProps) =>
        h(
          kind === "rich" ? "span" : "button",
          {
            style: `display:inline-block;font:inherit;border:0;padding:0;line-height:20px;width:${clamped ? 40 : 24}px`,
          },
          clamped ? "More" : "All",
        ),
    };
    if (kind === "wrap")
      return h(
        components.wrap,
        {
          ...props,
          items: Array.from(
            { length: revision.value % 3 === 1 ? 3 : 24 },
            (_, item) => `${revision.value}-${item}`,
          ),
          maxLines: 2,
        },
        {
          item: ({ item, index }: WrapClampItemSlotProps<string>) =>
            h(
              "span",
              {
                style: `display:inline-block;white-space:nowrap;width:${46 + (index % 4) * 11}px;height:20px;margin-right:4px`,
              },
              item,
            ),
          ...(dynamicAfter.value
            ? {
                after: ({ hiddenItems }: WrapClampSlotProps<string>) =>
                  h(
                    "span",
                    {
                      style: "display:inline-block;line-height:20px;white-space:nowrap",
                    },
                    `+${hiddenItems.length}`,
                  ),
              }
            : {}),
        },
      );
    if (kind === "inline")
      return h(InlineClamp, {
        as: rootTag.value,
        style,
        class: kind,
        text: source,
        location: "middle",
        split,
      });
    if (kind === "rich")
      return h(
        RichLineClamp,
        {
          ...props,
          html: `Release <strong>notes</strong>: <em>${source}</em>`,
          boundary: "word",
          maxLines: 3,
        },
        slots,
      );
    return h(
      components[kind],
      {
        ...props,
        text: source,
        boundary: "word",
        ...(kind === "pretext" ? { maxHeight: 60 } : { maxLines: 3 }),
      },
      slots,
    );
  }
  const app = createApp({
    render: () =>
      h("div", [
        coupling
          ? h(
              "style",
              coupling === "rich"
                ? ".mixed-clamp-scene:has(.rich > [aria-hidden=true] [data-part=body] strong) .line {font-size:22px !important;line-height:28px !important}"
                : ".mixed-clamp-scene:has(.wrap > [data-part=content] > [data-part=item]:nth-child(7)) .line {font-size:22px !important}",
            )
          : null,
        h(
          "div",
          {
            class: "mixed-clamp-scene",
            style: `display:grid;gap:3px;width:${width.value}px;font:${fontSize.value}px Arial;line-height:24px`,
          },
          Array.from({ length: count.value }, (_, index) =>
            h("div", { key: index, style: `width:${width.value}px` }, [
              renderClamp(index, "display:block;width:100%;font:inherit;line-height:24px"),
            ]),
          ),
        ),
      ]),
  });
  mounted.push({ app, container });
  app.mount(container);
  const roots = () =>
    [...container.querySelector(".mixed-clamp-scene")!.children].map(
      (element) => element.firstElementChild as HTMLElement,
    );
  function snapshot(root: HTMLElement, index: number) {
    return kinds[index % kinds.length] === "inline"
      ? root.innerHTML
      : root.firstElementChild!.innerHTML;
  }
  async function verify() {
    const currentRoots = roots();
    const actual = currentRoots.map(snapshot);
    const styles = currentRoots.map(
      (root) =>
        `display:block;width:${root.getBoundingClientRect().width}px;font:${getComputedStyle(root).font};line-height:${getComputedStyle(root).lineHeight}`,
    );
    // Mount each reference separately after capturing every live result. Each uses
    // the current root's font/width, including styles affected by other Clamp types.
    for (let index = 0; index < currentRoots.length; index++) {
      const reference = document.createElement("div");
      document.body.append(reference);
      const referenceApp = createApp({ render: () => renderClamp(index, styles[index]!) });
      referenceApp.mount(reference);
      try {
        await settle(2);
        expect(
          actual[index],
          `${kinds[index % kinds.length]}/${index}/width${width.value}/revision${revision.value}`,
        ).toBe(snapshot(reference.firstElementChild as HTMLElement, index));
      } finally {
        referenceApp.unmount();
        reference.remove();
      }
    }
  }
  return {
    container,
    width,
    revision,
    rootTag,
    fontSize,
    expanded,
    dynamicAfter,
    count,
    roots,
    verify,
  };
}

describe("mixed Clamp measurement batches", () => {
  it("preserves output across type mixtures, source changes, fonts, slots, roots, and teardown", async () => {
    const view = fixture();
    await settle(2);
    await view.verify();
    const updates = [
      () => {
        view.width.value = 180;
      },
      () => {
        view.width.value = 320;
        view.dynamicAfter.value = false;
      },
      () => {
        view.revision.value++;
        view.rootTag.value = "section";
      },
      () => {
        view.revision.value++;
        view.dynamicAfter.value = true;
        view.fontSize.value = 18;
      },
      () => {
        view.expanded.value = true;
      },
      () => {
        view.expanded.value = false;
        view.width.value = 220;
        view.count.value = 5;
      },
    ];
    for (const update of updates) {
      update();
      await settle(3);
      await view.verify();
    }
  });

  it("settles all component types after external CSS resizing by the following frame", async () => {
    const view = fixture();
    await settle(2);
    for (const width of [180, 320, 210]) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => {
          for (const root of view.roots()) root.parentElement!.style.width = `${width}px`;
          requestAnimationFrame(() => resolve());
        }),
      );
      await view.verify();
    }
  });

  it("remeasures text after structural Wrap updates change an ancestor selector", async () => {
    const view = fixture({ coupling: "wrap" });
    await settle(2);
    for (const width of [180, 440, 210]) {
      view.width.value = width;
      await settle(3);
      await view.verify();
    }
  });
  it("preserves current-font results when Rich search crosses text leaves and changes a selector", async () => {
    const view = fixture({ coupling: "rich" });
    view.count.value = 5;
    await settle(2);
    for (const width of [220, 204, 188, 172, 156, 140, 124, 108, 92, 76, 92, 108, 140, 172, 204]) {
      view.width.value = width;
      await settle(3);
      await view.verify();
    }
  });

  it("preserves intrinsic flex allocation when Wrap instances receive a shared resize", async () => {
    const width = ref(420);
    const items = Array.from({ length: 24 }, (_, index) => `Tag ${index}`);
    function renderWrap(style: string) {
      return h(
        components.wrap,
        { items, maxLines: 2, style },
        {
          item: ({ item, index }: WrapClampItemSlotProps<string>) =>
            h(
              "span",
              {
                style: `display:inline-block;width:${35 + (index % 3) * 17}px;height:20px;margin-right:4px`,
              },
              item,
            ),
          after: ({ hiddenItems }: WrapClampSlotProps<string>) =>
            h("span", { style: "white-space:nowrap" }, `+${hiddenItems.length}`),
        },
      );
    }
    const container = document.createElement("div");
    document.body.append(container);
    const app = createApp({
      render: () =>
        h(
          "div",
          { style: `display:flex;width:${width.value}px;gap:7px` },
          Array.from({ length: 4 }, () =>
            renderWrap("flex:0 1 auto;min-width:0;font:16px Arial;line-height:20px"),
          ),
        ),
    });
    mounted.push({ app, container });
    app.mount(container);
    for (const nextWidth of [420, 270, 650, 180, 420, 800, 330]) {
      width.value = nextWidth;
      await settle(3);
      const actual = [...container.firstElementChild!.children].map((element) => ({
        width: element.getBoundingClientRect().width,
        html: element.firstElementChild!.innerHTML,
      }));
      for (const result of actual) {
        const reference = document.createElement("div");
        document.body.append(reference);
        const referenceApp = createApp({
          render: () => renderWrap(`width:${result.width}px;font:16px Arial;line-height:20px`),
        });
        referenceApp.mount(reference);
        try {
          await settle(2);
          expect(result.html, `${nextWidth}px`).toBe(
            reference.firstElementChild!.firstElementChild!.innerHTML,
          );
        } finally {
          referenceApp.unmount();
          reference.remove();
        }
      }
    }
  });
});
