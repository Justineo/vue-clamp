import { describe, expect, it, vi } from "vite-plus/test";
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { InlineClamp, LineClamp, RichLineClamp } from "../src/index.ts";
import { prepareSharedText, prepareText } from "../src/text.ts";
import { frame, rootElement, textElement } from "./browser.ts";

import type { Component } from "vue";

async function settle(): Promise<void> {
  await nextTick();
  await frame();
  await frame();
  await nextTick();
}

describe("deferred search preparation", () => {
  it("preserves eager word cuts around emoji and UTF-16 surrogate boundaries", () => {
    const text = "1: 👨‍👩‍👧‍👦 family 👩🏽‍💻 developer 🇨🇳 flag ❤️ heart café élan ".repeat(80);
    const eager = prepareText(text, "word");
    const deferred = prepareSharedText(text, "word");
    expect(deferred.boundaryOffsets).toEqual(eager.boundaryOffsets);
    expect(deferred.fallbackBoundaryOffsets).toEqual(eager.fallbackBoundaryOffsets);
  });

  it("remeasures a previously full-fit line when font metrics and width grow together", async () => {
    const family = "Clamp full-fit font growth";
    const face = new FontFace(
      family,
      'local("Courier New"), local("Liberation Mono"), local("DejaVu Sans Mono")',
    );
    await face.load();
    const width = ref(140);
    const source = "i".repeat(28);
    const container = document.createElement("div");
    document.body.append(container);
    const app = createApp(
      defineComponent({
        setup: () => () =>
          h(LineClamp, {
            text: source,
            maxLines: 1,
            boundary: "word",
            style: {
              width: `${width.value}px`,
              fontFamily: `"${family}", Arial, sans-serif`,
              fontSize: "16px",
              lineHeight: "24px",
              overflowWrap: "anywhere",
            },
          }),
      }),
    );
    try {
      app.mount(container);
      await settle();
      expect(textElement(rootElement(container)).textContent).toBe(source);
      // The loaded face changes glyph metrics without changing computed font CSS.
      document.fonts.add(face);
      width.value = 180;
      document.fonts.dispatchEvent(new Event("loadingdone"));
      await settle();
      expect(textElement(rootElement(container)).textContent).not.toBe(source);
      expect(textElement(rootElement(container)).textContent).toContain("…");
      expect(
        container.querySelector('[data-part="root"]')!.getBoundingClientRect().height,
      ).toBeLessThanOrEqual(25);
    } finally {
      app.unmount();
      container.remove();
      document.fonts.delete(face);
    }
  });

  it.each([{ maxLines: 2 }, { maxHeight: 48 }])(
    "preserves serial Rich slot and text settlement while updating measured peers: %j",
    async (limits) => {
      const source = ref(
        "A long source with enough words to overflow the available space. ".repeat(12),
      );
      const width = ref(220);
      const container = document.createElement("div");
      document.body.append(container);
      const app = createApp({
        setup: () => () =>
          h(
            "div",
            { style: { width: `${width.value}px` } },
            Array.from({ length: 5 }, (_, index) =>
              h(
                RichLineClamp,
                {
                  key: index,
                  html: source.value,
                  boundary: "word",
                  ...limits,
                  // The last sibling has the same physical width but no declared width,
                  // so it remains a serial reference for the four eligible peers.
                  style: {
                    display: "block",
                    font: "16px/24px Arial",
                    ...(index < 4 ? { width: `${width.value}px` } : {}),
                  },
                },
                {
                  after: ({ clamped }: { clamped: boolean }) =>
                    h(
                      "span",
                      {
                        "data-clamped": String(clamped),
                        style: "display:inline-block;width:40px",
                      },
                      "More",
                    ),
                },
              ),
            ),
          ),
      });
      const snapshots = () =>
        [...container.querySelectorAll('[data-part="root"]')].map((root) => ({
          text: root.querySelector('[data-part="body"]')!.textContent,
          clamped: root.querySelector("[data-clamped]")!.getAttribute("data-clamped"),
        }));
      const expectSame = () => {
        const states = snapshots();
        expect(states).toHaveLength(5);
        for (const state of states.slice(0, 4)) expect(state).toEqual(states[4]);
      };
      try {
        app.mount(container);
        await settle();
        for (const text of [
          "Ready",
          "A changed long source. ".repeat(50),
          "Another long source. ".repeat(60),
          "Done",
        ]) {
          source.value = text;
          await nextTick();
          expectSame();
          await settle();
          for (const state of snapshots()) {
            const clamped = text.length > 100;
            expect(state.clamped).toBe(String(clamped));
            if (clamped) expect(state.text).toContain("…");
            else expect(state.text).toBe(text);
          }
        }
        source.value = "Warm remeasurement of a plain text source. ".repeat(6);
        await settle();
        for (const nextWidth of [150, 3000, 180, 260]) {
          width.value = nextWidth;
          await settle();
          expectSame();
        }
      } finally {
        app.unmount();
        container.remove();
      }
    },
  );

  for (const [name, component] of Object.entries({ LineClamp, InlineClamp, RichLineClamp })) {
    it(`${name} segments a full-fit source only when a later shrink needs a cut`, async () => {
      const width = ref(1000);
      const source = ref(`Initial title for ${name}`);
      const container = document.createElement("div");
      document.body.append(container);
      const Host = defineComponent({
        setup: () => () =>
          h(component as Component, {
            ...(name === "RichLineClamp"
              ? { html: `<span>${source.value}</span>` }
              : { text: source.value }),
            maxLines: 1,
            boundary: "word",
            style: { display: "block", width: `${width.value}px`, font: "16px/24px Arial" },
          }),
      });
      const app = createApp(Host);
      app.mount(container);
      await settle();
      const segment = vi.spyOn(Intl.Segmenter.prototype, "segment");
      try {
        source.value = `é 👩🏽‍💻 中英文 ${name} observabilityPlatformTelemetryPipeline`;
        await settle();
        const fullText =
          container.querySelector('[data-part="text"]') ??
          container.querySelector('[data-part="body"]');
        expect(fullText?.textContent).toBe(source.value);
        expect(segment).not.toHaveBeenCalled();

        width.value = 55;
        await settle();
        expect(segment).toHaveBeenCalled();
        const root = container.querySelector<HTMLElement>('[data-part="root"]')!;
        expect(root.getAttribute("aria-label") ?? root.textContent).toContain("é");
        expect(
          root.querySelector('[data-part="text"]')?.textContent ??
            root.querySelector('[data-part="body"]')?.textContent,
        ).not.toBe(source.value);

        width.value = 1000;
        await settle();
        expect(
          (
            container.querySelector('[data-part="text"]') ??
            container.querySelector('[data-part="body"]')
          )?.textContent,
        ).toBe(source.value);
      } finally {
        segment.mockRestore();
        app.unmount();
        container.remove();
      }
    });
  }
});
