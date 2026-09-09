import { afterEach, describe, expect, it } from "vite-plus/test";
import { createApp, h, nextTick, ref } from "vue";
import { LineClamp } from "../src/index.ts";
import { displayTextForKeptCount, prepareText } from "../src/text.ts";
import { accessibleTextElement, naturalLineCount, settle, textElement } from "./browser.ts";
import type { App } from "vue";
import type { LineClampSlotProps } from "../src/index.ts";

const mounted: { app: App; container: HTMLElement }[] = [];
afterEach(() => {
  for (const { app, container } of mounted.splice(0)) {
    app.unmount();
    container.remove();
  }
});

function exhaustive(
  root: HTMLElement,
  source: string,
  maxLines?: number,
  maxHeight?: number,
): string {
  const probe = root.cloneNode(true) as HTMLElement;
  probe.style.width = `${root.getBoundingClientRect().width}px`;
  probe.style.font = getComputedStyle(root).font;
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  root.after(probe);
  try {
    const prepared = prepareText(source, "word");
    let best = "…";
    let kept = 0;
    for (const offsets of [prepared.boundaryOffsets, prepared.fallbackBoundaryOffsets]) {
      if (!offsets || kept > 0) break;
      for (let rank = 0; rank < offsets.length; rank++) {
        const text = displayTextForKeptCount(
          { ...prepared, boundaryOffsets: offsets },
          1,
          "…",
          rank,
        );
        textElement(probe).textContent = text;
        if (maxLines !== undefined && naturalLineCount(probe) > maxLines) continue;
        if (maxHeight !== undefined) {
          const content = probe.querySelector('[data-part="content"]')!.getBoundingClientRect();
          const top = probe.getBoundingClientRect().top + probe.clientTop;
          if (content.top < top - 0.5 || content.bottom > top + probe.clientHeight + 0.5) continue;
        }
        best = text;
        kept = rank;
      }
    }
    return best;
  } finally {
    probe.remove();
  }
}

function host({ external = false, conditional = false } = {}) {
  const width = ref(180);
  const short = ref(false);
  const before = ref(true);
  const after = ref(true);
  const affixWidth = ref(32);
  const fontSize = ref(16);
  const rootTag = ref("div");
  const expanded = ref(false);
  const copy =
    "Operational dashboards keep ownership and incident context visible while panels change width. ";
  const source = (index: number) => (short.value ? `Short ${index}` : copy.repeat(1 + (index % 3)));
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp({
    render: () =>
      h(
        "div",
        { style: `display:grid;width:${width.value}px;gap:3px` },
        Array.from({ length: 12 }, (_, index) =>
          h(
            LineClamp,
            {
              key: index,
              as: rootTag.value,
              text: source(index),
              boundary: "word",
              expanded: expanded.value,
              ...(index % 3 === 0 ? { maxHeight: 48 } : { maxLines: (index % 3) + 1 }),
              style: `display:block;width:${external ? "100%" : `${width.value + index}px`};font:${fontSize.value}px Arial;line-height:24px`,
            },
            {
              before: () => (before.value ? h("b", { style: "font:inherit" }, "Tag ") : []),
              after: ({ clamped, expanded, toggle }: LineClampSlotProps) =>
                after.value && (!conditional || clamped || expanded)
                  ? h(
                      "button",
                      {
                        onClick: toggle,
                        style: `display:inline-block;vertical-align:baseline;padding:0;border:0;font:inherit;line-height:20px;width:${clamped ? affixWidth.value : 20}px`,
                      },
                      expanded ? "Less" : clamped ? "More" : "All",
                    )
                  : [],
            },
          ),
        ),
      ),
  });
  mounted.push({ app, container });
  app.mount(container);
  function verify() {
    const roots = [...container.firstElementChild!.children] as HTMLElement[];
    const actual = roots.map((root) => textElement(root).textContent);
    for (const [index, root] of roots.entries()) {
      const expected = expanded.value
        ? source(index)
        : exhaustive(
            root,
            source(index),
            index % 3 === 0 ? undefined : (index % 3) + 1,
            index % 3 === 0 ? 48 : undefined,
          );
      expect(
        actual[index],
        `${index}/${width.value}/${affixWidth.value}/font${fontSize.value}/slots${before.value},${after.value}/short${short.value}/expanded${expanded.value}`,
      ).toBe(expected);
      if (expected !== source(index))
        expect(accessibleTextElement(root)?.textContent).toBe(source(index));
    }
  }
  return {
    container,
    width,
    short,
    before,
    after,
    affixWidth,
    fontSize,
    rootTag,
    expanded,
    verify,
  };
}

describe("batched LineClamp slots", () => {
  it("settles cold mounts with conditional slots before the next animation frame", async () => {
    let view: ReturnType<typeof host>;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => {
        view = host({ conditional: true });
        requestAnimationFrame(() => resolve());
      }),
    );
    view!.verify();
  });

  it("keeps maximal text with mixed line and height limits as sibling heights change", async () => {
    const view = host();
    await settle(2);
    view.verify();
    for (const width of [260, 140, 800, 190, 310]) {
      view.width.value = width;
      await settle(2);
      view.verify();
    }
  });

  it("settles slot state, affix sizes, source, font, roots, and expansion transitions", async () => {
    const view = host({ conditional: true });
    await settle(2);
    const updates = [
      () => {
        view.width.value = 140;
      },
      () => {
        view.affixWidth.value = 68;
      },
      () => {
        view.before.value = false;
        view.after.value = false;
      },
      () => {
        view.before.value = true;
        view.after.value = true;
        view.rootTag.value = "section";
      },
      () => {
        view.short.value = true;
      },
      () => {
        view.short.value = false;
        view.fontSize.value = 19;
        view.width.value = 220;
      },
      () => {
        view.expanded.value = true;
      },
      () => {
        view.expanded.value = false;
        view.width.value = 270;
      },
    ];
    for (const update of updates) {
      update();
      await settle(3);
      view.verify();
    }
  });

  it("settles conditional slots after source changes before the next animation frame", async () => {
    const view = host({ conditional: true });
    await settle(2);
    for (const [short, width] of [
      [true, 260],
      [false, 190],
      [true, 310],
      [false, 220],
    ] as const) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => {
          view.short.value = short;
          view.width.value = width;
          requestAnimationFrame(() => resolve());
        }),
      );
      view.verify();
    }
  });

  it("settles an external resize before the next animation frame with live affixes", async () => {
    const view = host({ external: true, conditional: true });
    await settle(2);
    for (const width of [260, 140, 800, 190]) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => {
          (view.container.firstElementChild as HTMLElement).style.width = `${width}px`;
          requestAnimationFrame(() => resolve());
        }),
      );
      await nextTick();
      view.verify();
    }
  });
});
