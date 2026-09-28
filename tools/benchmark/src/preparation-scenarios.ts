import { expect } from "vite-plus/test";
import { createApp, defineComponent, h, ref } from "vue";
import { flushVueUpdates } from "./helpers.ts";

import type { ComponentName, PublicScenario } from "./scenario-types.ts";

const instances = 16;
const cjk =
  "跨区域响应团队需要保留客户沟通、缓解措施和后续责任。Dashboard ownership keeps context visible. ";
const latin =
  "Operational dashboards keep ownership and incident context visible across regional updates. ";
const emoji = "👨‍👩‍👧‍👦 family 👩🏽‍💻 developer 🇨🇳 flag ❤️ heart café élan dashboard ";
const sizedText = (source: string, length: number) =>
  source.repeat(Math.ceil(length / source.length)).slice(0, length);

type SourceFixture = {
  component: Exclude<ComponentName, "WrapClamp">;
  full?: boolean;
  identical?: boolean;
  name: string;
  text: string;
  width?: number;
};

function sourceScenario(fixture: SourceFixture): PublicScenario {
  const rich = fixture.component === "RichLineClamp";
  const inline = fixture.component === "InlineClamp";
  return {
    beforeStep: (mounted) => mounted.advanceContent!(),
    component: fixture.component,
    group: rich ? "rich" : inline ? "inline" : "line",
    minVersion: "1.3.0",
    name: fixture.name,
    widths: Array.from({ length: 7 }, () => fixture.width ?? 300),
    mount: async (component, initialWidth) => {
      const width = ref(initialWidth);
      const revision = ref(0);
      const container = document.createElement("div");
      document.body.append(container);
      const prefix = (index: number) =>
        `Revision ${revision.value}: ${fixture.identical ? "" : `Row ${index}: `}`;
      const source = (index: number) => prefix(index) + fixture.text;
      const app = createApp(
        defineComponent({
          setup: () => () =>
            h(
              "div",
              { style: "display:grid;gap:4px;align-items:start" },
              Array.from({ length: instances }, (_, index) =>
                h(component, {
                  key: index,
                  "data-bench-instance": index,
                  boundary: "word",
                  ...(inline ? { location: "middle" } : { maxLines: fixture.full ? 120 : 3 }),
                  ...(rich
                    ? { html: `<strong>${prefix(index)}</strong><em>${fixture.text}</em>` }
                    : { text: source(index) }),
                  style: `display:block;width:${width.value}px;font:16px Georgia,serif;line-height:20px;overflow-wrap:break-word`,
                }),
              ),
            ),
        }),
      );
      app.mount(container);
      await flushVueUpdates();
      return {
        app,
        container,
        root: container,
        setWidth: (value) => {
          width.value = value;
        },
        advanceContent: () => {
          revision.value += 1;
        },
        collectExtraMetrics: () => ({
          componentInstances: instances,
          sourceLength: fixture.text.length,
        }),
        // Validation happens after timing and counter collection. Full-fit rows
        // must really fit, and update rows must display the final source revision.
        validate: () => {
          const roots = container.querySelectorAll('[data-part="root"]');
          expect(roots.length).toBe(instances);
          roots.forEach((root, index) => {
            const body = root.querySelector('[data-part="body"]')!;
            const visible = (body.querySelector('[aria-hidden="true"]') ?? body).textContent ?? "";
            expect(visible.startsWith(`Revision ${revision.value}:`)).toBe(true);
            if (fixture.full) expect(visible).toBe(source(index));
            else {
              expect(visible).toContain("…");
              expect(visible.length).toBeLessThan(source(index).length);
            }
          });
        },
      };
    },
  };
}

function denseWrapScenario(): PublicScenario {
  return {
    component: "WrapClamp",
    group: "wrap",
    minVersion: "1.5.0",
    name: "wrap-dense-markers-height-batch-grow-shrink",
    widths: [64, 1200, 64, 2000, 120, 480, 64],
    maxStableFrames: 120,
    mount: async (component, initialWidth) => {
      const width = ref(initialWidth);
      const items = Array.from({ length: 1000 }, (_, index) => index);
      let itemSlotCalls = 0;
      const clampStyle = () => `width:${width.value}px;font:16px/20px Georgia,serif`;
      const marker = (item: number) =>
        h(
          "span",
          {
            "data-bench-index": item,
            style: `display:inline-block;width:${item % 2 ? 3 : 5}px;height:16px;font-size:0`,
          },
          String(item),
        );
      const container = document.createElement("div");
      document.body.append(container);
      const app = createApp(
        defineComponent({
          setup: () => () =>
            h(
              "div",
              { style: "display:grid;gap:4px" },
              Array.from({ length: 4 }, (_, index) =>
                h(
                  component,
                  {
                    key: index,
                    items,
                    maxHeight: 48,
                    style: clampStyle(),
                  },
                  {
                    item: ({ item }: { item: number }) => {
                      itemSlotCalls += 1;
                      return marker(item);
                    },
                  },
                ),
              ),
            ),
        }),
      );
      app.mount(container);
      await flushVueUpdates();
      return {
        app,
        container,
        root: container,
        setWidth: (value) => {
          width.value = value;
        },
        resetExtraMetrics: () => {
          itemSlotCalls = 0;
        },
        collectExtraMetrics: () => ({ componentInstances: 4, itemSlotCalls }),
        validate: () => {
          // An expanded public component supplies the real physical row oracle.
          // Mount it only after collecting metrics, so validation is not measured.
          const reference = document.createElement("div");
          reference.style.cssText = "position:absolute;top:0;left:0;visibility:hidden";
          document.body.append(reference);
          const referenceApp = createApp({
            render: () =>
              h(
                component,
                { items, maxHeight: 48, expanded: true, style: clampStyle() },
                {
                  item: ({ item }: { item: number }) => marker(item),
                },
              ),
          });
          let expectedCount: number;
          try {
            referenceApp.mount(reference);
            const root = reference.querySelector('[data-part="root"]')!;
            const bottom = root.getBoundingClientRect().top + 48.5;
            const renderedItems = root.querySelectorAll('[data-part="item"]');
            expect(renderedItems.length).toBe(items.length);
            expectedCount = Array.from(renderedItems).filter(
              (item) => item.getBoundingClientRect().bottom <= bottom,
            ).length;
          } finally {
            referenceApp.unmount();
            reference.remove();
          }
          const roots = container.querySelectorAll('[data-part="root"]');
          expect(roots.length).toBe(4);
          for (const root of roots) {
            expect(root.getBoundingClientRect().height).toBeLessThanOrEqual(48.5);
            const visible = Array.from(root.querySelectorAll('[data-part="item"]')).filter(
              (item) => item.getAttribute("aria-hidden") !== "true",
            );
            expect(visible.length).toBe(expectedCount);
            expect(
              visible.map((item) =>
                Number(item.querySelector("[data-bench-index]")?.getAttribute("data-bench-index")),
              ),
            ).toEqual(items.slice(0, visible.length));
          }
        },
      };
    },
  };
}

export function preparationScenarios(): PublicScenario[] {
  const fixtures: SourceFixture[] = [
    ...[true, false].map((identical): SourceFixture => ({
      component: "LineClamp",
      identical,
      name: `line-long-cjk-${identical ? "identical" : "distinct"}-text-update-batch-same-width`,
      text: sizedText(cjk, 6000),
    })),
    {
      component: "LineClamp",
      full: true,
      name: "line-long-full-fit-text-update-batch-same-width",
      text: sizedText(latin, 6000),
      width: 960,
    },
    {
      component: "LineClamp",
      full: true,
      name: "line-short-full-fit-text-update-batch-same-width",
      text: "Ready",
    },
    ...[true, false].map((identical): SourceFixture => ({
      component: "InlineClamp",
      identical,
      name: `inline-long-emoji-${identical ? "identical" : "distinct"}-text-update-batch-same-width`,
      text: sizedText(emoji, 6000),
    })),
    {
      component: "InlineClamp",
      full: true,
      name: "inline-short-full-fit-text-update-batch-same-width",
      text: "Ready",
    },
    ...[true, false].map((identical): SourceFixture => ({
      component: "RichLineClamp",
      identical,
      name: `rich-long-${identical ? "identical" : "distinct"}-html-update-batch-same-width`,
      text: sizedText(latin, 6000),
    })),
    {
      component: "RichLineClamp",
      name: "rich-very-long-html-update-batch-same-width",
      text: sizedText(latin, 30000),
    },
    {
      component: "RichLineClamp",
      full: true,
      name: "rich-long-full-fit-html-update-batch-same-width",
      text: sizedText(latin, 6000),
      width: 960,
    },
    {
      component: "RichLineClamp",
      full: true,
      name: "rich-short-full-fit-html-update-batch-same-width",
      text: "Ready",
    },
  ];
  return [...fixtures.map(sourceScenario), denseWrapScenario()];
}

export function nativeFontScenario(
  fixture: Pick<PublicScenario, "component" | "group" | "mount">,
): PublicScenario {
  return {
    ...fixture,
    name: `${fixture.group}-native-font-load-batch-same-width`,
    minVersion: fixture.component === "WrapClamp" ? "1.5.0" : "1.3.0",
    widths: [300, 300, 300, 300, 300, 300, 300],
    beforeStep: async (mounted) => {
      await mounted.loadFont!();
    },
    mount: async (component, width) => {
      const mounted = await fixture.mount(component, width);
      const faces: FontFace[] = [];
      let trustedFontEvents = 0;
      return {
        ...mounted,
        loadFont: async () => {
          const family = `VueClampBenchmarkFont${faces.length}`;
          const face = new FontFace(
            family,
            faces.length % 2
              ? 'local("Arial"), local("Liberation Sans"), local("DejaVu Sans")'
              : 'local("Courier New"), local("Liberation Mono"), local("DejaVu Sans Mono")',
          );
          faces.push(face);
          const before = trustedFontEvents;
          const onLoad = (event: Event) => {
            if (event.isTrusted && (event as FontFaceSetLoadEvent).fontfaces.includes(face))
              trustedFontEvents += 1;
          };
          document.fonts.addEventListener("loadingdone", onLoad);
          try {
            document.fonts.add(face);
            for (const root of mounted.container.querySelectorAll<HTMLElement>(
              '[data-part="root"]',
            ))
              root.style.fontFamily = `"${family}", Georgia, serif`;
            await face.load();
            await document.fonts.ready;
            expect(trustedFontEvents - before).toBe(1);
          } finally {
            document.fonts.removeEventListener("loadingdone", onLoad);
          }
        },
        collectExtraMetrics: () => ({ ...mounted.collectExtraMetrics?.(), trustedFontEvents }),
        dispose: () => {
          for (const face of faces) document.fonts.delete(face);
          mounted.dispose?.();
        },
      };
    },
  };
}
