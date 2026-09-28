import { afterEach, describe, expect, it } from "vite-plus/test";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { InlineClamp, LineClamp } from "../src/index.ts";
import { displayTextForKeptCount, prepareText } from "../src/text.ts";
import { accessibleTextElement, naturalLineCount, settle, textElement } from "./browser.ts";

import type { App } from "vue";

const mounted: { app: App; container: HTMLElement }[] = [];

afterEach(() => {
  for (const { app, container } of mounted.splice(0)) {
    app.unmount();
    container.remove();
  }
});

function exhaustiveInline(
  root: HTMLElement,
  source: string,
  ratio: number,
  boundary: "word" | "grapheme",
): string {
  const probe = root.cloneNode(true) as HTMLElement;
  probe.style.font = getComputedStyle(root).font;
  probe.style.width = `${root.getBoundingClientRect().width}px`;
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  root.after(probe);
  try {
    const body = probe.querySelector('[data-part="body"]')!;
    const prepared = prepareText(source, boundary);
    let best = "…";
    let kept = 0;
    for (const offsets of [prepared.boundaryOffsets, prepared.fallbackBoundaryOffsets]) {
      if (!offsets || kept > 0) break;
      for (let rank = 0; rank < offsets.length; rank += 1) {
        const candidate = displayTextForKeptCount(
          { ...prepared, boundaryOffsets: offsets },
          ratio,
          "…",
          rank,
          "preserve-outer",
        );
        body.textContent = candidate;
        if (probe.scrollWidth <= root.getBoundingClientRect().width + 0.5) {
          best = candidate;
          kept = rank;
        }
      }
    }
    return best;
  } finally {
    probe.remove();
  }
}

function exhaustiveLine(root: HTMLElement, source: string, ratio = 1): string {
  const probe = root.cloneNode(true) as HTMLElement;
  probe.style.font = getComputedStyle(root).font;
  probe.style.width = `${root.getBoundingClientRect().width}px`;
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  root.after(probe);
  try {
    const body = textElement(probe);
    const prepared = prepareText(source, "word");
    let best = "…";
    for (let rank = 0; rank < prepared.boundaryOffsets.length; rank += 1) {
      const candidate = displayTextForKeptCount(prepared, ratio, "…", rank);
      body.textContent = candidate;
      if (naturalLineCount(probe) <= 2) best = candidate;
    }
    return best;
  } finally {
    probe.remove();
  }
}

describe("batched measured updates", () => {
  it("retains the largest fitting Arabic candidate across resize and typography changes", async () => {
    const source = "نحتاج إلى الاحتفاظ بالنص المناسب أثناء تغيير عرض الحاوية باستمرار";
    const width = ref(188);
    const text = ref(source);
    const fontSize = ref(16);
    const boundary = ref<"word" | "grapheme">("grapheme");
    const container = document.createElement("div");
    document.body.append(container);
    const app = createApp({
      render: () =>
        h(InlineClamp, {
          text: text.value,
          location: "middle",
          boundary: boundary.value,
          style: `width:${width.value}px;font:${fontSize.value}px Arial,sans-serif;line-height:24px`,
        }),
    });
    mounted.push({ app, container });
    app.mount(container);
    for (const size of [16, 20]) {
      fontSize.value = size;
      for (const mode of ["grapheme", "word"] as const) {
        boundary.value = mode;
        for (const nextWidth of [188, 248, 1000, 188, 80, 248]) {
          width.value = nextWidth;
          text.value = nextWidth === 80 ? `${source} ${source}` : source;
          await nextTick();
          const root = container.firstElementChild as HTMLElement;
          const actual = root.querySelector('[data-part="body"]')!.textContent;
          expect(actual, `${size}px/${mode}/${nextWidth}px`).toBe(
            exhaustiveInline(root, text.value, 0.5, mode),
          );
        }
      }
    }
  });

  it("retains maximal Arabic word candidates in measured multiline layouts", async () => {
    const source = "نحتاج إلى الاحتفاظ بالنص المناسب أثناء تغيير عرض الحاوية باستمرار ".repeat(2);
    const width = ref(188);
    const location = ref<"middle" | "end">("middle");
    const container = document.createElement("div");
    document.body.append(container);
    const app = createApp({
      render: () =>
        h(LineClamp, {
          text: source,
          boundary: "word",
          maxLines: 2,
          location: location.value,
          style: `display:block;width:${width.value}px;font:16px Arial;line-height:24px`,
        }),
    });
    mounted.push({ app, container });
    app.mount(container);
    for (const mode of ["middle", "end"] as const) {
      location.value = mode;
      for (const nextWidth of [188, 248, 1000, 140, 188]) {
        width.value = nextWidth;
        await settle(2);
        const root = container.firstElementChild as HTMLElement;
        expect(textElement(root).textContent, `${mode}/${nextWidth}px`).toBe(
          exhaustiveLine(root, source, mode === "middle" ? 0.5 : 1),
        );
      }
    }
  });

  it("settles consecutive mixed batches with new text and root tags", async () => {
    const width = ref(170);
    const revision = ref(0);
    const rootTag = ref("div");
    const copy =
      "Operational dashboards keep the relevant context visible while the surrounding application changes its layout. ";
    const source = (index: number) =>
      revision.value === 2 ? `Short ${index}` : `${copy}${revision.value}/${index}`;
    const container = document.createElement("div");
    document.body.append(container);
    const Host = defineComponent({
      setup: () => () =>
        h(
          "div",
          Array.from({ length: 12 }, (_, index) =>
            h(index % 2 === 0 ? LineClamp : InlineClamp, {
              key: index,
              as: rootTag.value,
              text: source(index),
              boundary: "word",
              maxLines: 2,
              location: index % 2 === 0 ? "end" : "middle",
              style: `display:block;width:${width.value + index * 3}px;font:16px Arial,sans-serif;line-height:24px`,
            }),
          ),
        ),
    });
    const app = createApp(Host);
    mounted.push({ app, container });
    app.mount(container);
    for (const [step, nextWidth] of [170, 245, 400, 140].entries()) {
      width.value = nextWidth;
      revision.value = step;
      rootTag.value = step % 2 ? "section" : "div";
      await nextTick();
      await settle(2);
      const roots = [...container.firstElementChild!.children] as HTMLElement[];
      for (const [index, root] of roots.entries()) {
        expect(root.tagName.toLowerCase()).toBe(rootTag.value);
        if (index % 2 === 0) {
          const expected = exhaustiveLine(root, source(index));
          expect(textElement(root).textContent, `Line ${step}/${index}`).toBe(expected);
          expect(accessibleTextElement(root)?.textContent ?? source(index)).toBe(source(index));
          if (expected !== source(index))
            expect(textElement(root).getAttribute("aria-hidden")).toBe("true");
        } else {
          expect(
            root.querySelector('[data-part="body"]')!.textContent,
            `Inline ${step}/${index}`,
          ).toBe(exhaustiveInline(root, source(index), 0.5, "word"));
        }
      }
    }
  });

  it("finishes external resize batches before the following animation frame", async () => {
    const source =
      "Operational dashboards keep relevant ownership and incident context visible while surrounding panels change width.";
    const container = document.createElement("div");
    container.style.width = "320px";
    document.body.append(container);
    const app = createApp({
      render: () =>
        h(
          "div",
          Array.from({ length: 12 }, (_, index) =>
            h(index % 2 === 0 ? LineClamp : InlineClamp, {
              text: source,
              boundary: "word",
              location: index % 2 === 0 ? "end" : "middle",
              maxLines: 2,
              style: "display:block;width:100%;font:16px Arial;line-height:24px",
            }),
          ),
        ),
    });
    mounted.push({ app, container });
    app.mount(container);
    await settle(2);
    for (const width of [170, 245, 1000, 140, 320]) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => {
          container.style.width = `${width}px`;
          requestAnimationFrame(() => {
            resolve();
          });
        }),
      );
      const roots = [...container.firstElementChild!.children] as HTMLElement[];
      // Capture the displayed text first. The exhaustive oracle adds hidden
      // probes and must not be what makes a pending clamp settle.
      const actual = roots.map((root, index) =>
        index % 2 === 0
          ? textElement(root).textContent
          : root.querySelector('[data-part="body"]')!.textContent,
      );
      for (const [index, root] of roots.entries()) {
        expect(actual[index], `${width}px/${index}`).toBe(
          index % 2 === 0
            ? exhaustiveLine(root, source)
            : exhaustiveInline(root, source, 0.5, "word"),
        );
      }
    }
  });

  it("retains maximal text in flex children with a fixed basis", async () => {
    const width = ref(380);
    const source = "Operational dashboards keep ownership and incident context visible.";
    const container = document.createElement("div");
    document.body.append(container);
    const app = createApp({
      render: () =>
        h(
          "div",
          { style: `display:flex;width:${width.value}px` },
          Array.from({ length: 3 }, (_, index) =>
            h(InlineClamp, {
              text: source.repeat(index + 1),
              location: "middle",
              style: "width:0px;flex:1 1 0;min-width:0;font:16px Arial;line-height:24px",
            }),
          ),
        ),
    });
    mounted.push({ app, container });
    app.mount(container);
    for (const nextWidth of [380, 230, 570, 310]) {
      width.value = nextWidth;
      await settle(2);
      for (const [index, root] of (
        [...container.firstElementChild!.children] as HTMLElement[]
      ).entries()) {
        expect(root.querySelector('[data-part="body"]')!.textContent).toBe(
          exhaustiveInline(root, source.repeat(index + 1), 0.5, "grapheme"),
        );
        expect(root.scrollWidth, `${nextWidth}px`).toBeLessThanOrEqual(
          root.getBoundingClientRect().width + 0.5,
        );
      }
    }
  });

  it("preserves sibling selectors when an empty marker removes all candidate text", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const source = "Dashboard";
    const app = createApp({
      render: () =>
        h("div", [
          h(
            "style",
            ".batch-empty-first:has([data-part=body]:empty) + .batch-empty-second { font-size:48px !important; }",
          ),
          h(InlineClamp, {
            class: "batch-empty-first",
            text: "a".repeat(512),
            ellipsis: "",
            location: "middle",
            style: "display:block;width:1px;font:12px Arial;line-height:24px",
          }),
          h(InlineClamp, {
            class: "batch-empty-second",
            text: source,
            location: "middle",
            style: "display:block;width:80px;font:12px Arial;line-height:24px",
          }),
        ]),
    });
    mounted.push({ app, container });
    app.mount(container);
    await nextTick();
    const root = container.querySelector<HTMLElement>(".batch-empty-second")!;
    expect(root.querySelector('[data-part="body"]')!.textContent).toBe(
      exhaustiveInline(root, source, 0.5, "grapheme"),
    );
  });

  it("discards queued work when components are unmounted before measurement", async () => {
    for (const component of [LineClamp, InlineClamp]) {
      const container = document.createElement("div");
      document.body.append(container);
      const app = createApp({
        render: () =>
          h(component, {
            text: "Queued measurements must not read or restore a component that has already been removed.",
            maxLines: 2,
            boundary: "word",
            style: "width:160px;font:16px Arial;line-height:24px",
          }),
      });
      app.mount(container);
      const root = container.firstElementChild as HTMLElement;
      app.unmount();
      root.getBoundingClientRect = () => {
        throw new Error("Read an unmounted clamp");
      };
      await nextTick();
      expect(container.childNodes.length).toBe(0);
      container.remove();
    }
  });
});
