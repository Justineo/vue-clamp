import { afterEach, describe, expect, it } from "vite-plus/test";
import { h } from "vue";
import { clampRich, prepareRich } from "../src/rich.ts";
import {
  cleanupMounted,
  mountRichClamp,
  richContentElement,
  rootElement,
  settle,
  unmountClamp,
  waitUntilVisible,
} from "./browser.ts";

afterEach(cleanupMounted);

describe("Rich primary grapheme projection", () => {
  it("reports a rank that maps back to the measured primary cut", () => {
    const prepared = prepareRich("<b>Family 👩🏽‍💻</b> dashboard 中文 ".repeat(8), "grapheme")!;
    const root = document.createElement("div");
    root.style.cssText = "width:120px;font:16px Arial;line-height:20px;overflow-wrap:anywhere";
    const content = document.createElement("span");
    const body = document.createElement("span");
    content.append(body);
    root.append(content);
    document.body.append(root);
    try {
      const result = clampRich({
        ellipsis: "…",
        from: null,
        hint: null,
        lineLimit: 2,
        maxHeight: undefined,
        prepared,
        probe: { root, content, body, width: 120 },
      });
      expect(result.state?.kind).toBe("clamped");
      expect(result.textRankSafe).toBe(true);
      expect(result.rank).toBeGreaterThan(0);
      expect(result.rankCount).toBe(result.searchIndex!.data.rankPoints.length);
      expect(result.state).toEqual({
        kind: "clamped",
        point: result.searchIndex!.data.rankPoints.at(result.rank!),
      });
    } finally {
      root.remove();
    }
  });

  it.each([
    [
      "plain",
      "Operational dashboards keep ownership and incident context visible. ".repeat(12),
      false,
    ],
    ["nested", "<b>Family 👩🏽‍💻 <i>dashboard 中文</i></b> context ".repeat(12), false],
    [
      "atomic",
      '<b>Lead</b><span style="display:inline-block;width:36px;height:16px">#</span> details '.repeat(
        12,
      ),
      false,
    ],
    ["height", "<b>这是混合排版测试。</b><i>Dashboard metrics</i> ".repeat(12), true],
  ] as const)(
    "matches fresh layout after width and font changes for %s",
    async (_name, html, height) => {
      const after = () => h("span", { style: "font-size:12px" }, " More");
      const props = {
        boundary: "grapheme" as const,
        ellipsis: " […] ",
        maxLines: 3,
        ...(height ? { maxHeight: 45 } : {}),
      };
      const warm = mountRichClamp({
        html,
        width: 300,
        props,
        after,
        style: "font-size:var(--projection-font,16px)",
      });
      const root = rootElement(warm.container);
      await waitUntilVisible(root);
      await settle(2);

      for (const [index, width] of [162, 418, 253.5, 64, 724, 319].entries()) {
        const fontSize = index < 3 ? 16 : 18;
        warm.container.style.setProperty("--projection-font", `${fontSize}px`);
        warm.width.value = width;
        if (index === 3) document.fonts.dispatchEvent(new Event("loadingdone"));
        await settle(3);
        const cold = mountRichClamp({
          html,
          width,
          props,
          after,
          style: `font-size:${fontSize}px`,
        });
        try {
          const coldRoot = rootElement(cold.container);
          await waitUntilVisible(coldRoot);
          await settle(2);
          expect(richContentElement(root).innerHTML).toBe(richContentElement(coldRoot).innerHTML);
          expect(warm.exposed.value?.clamped).toBe(cold.exposed.value?.clamped);
        } finally {
          unmountClamp(cold);
        }
      }
    },
  );
});
