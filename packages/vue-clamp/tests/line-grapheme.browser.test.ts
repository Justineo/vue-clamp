import { afterEach, describe, expect, it } from "vite-plus/test";
import { h, ref } from "vue";
import { LineClamp } from "../src/index.ts";
import { LineClamp as PretextLineClamp } from "../src/pretext.ts";
import { fitsContent } from "../src/layout.ts";
import { searchLineEndCandidates } from "../src/line/end-search.ts";
import { displayTextForKeptCount, prepareText, setElementText } from "../src/text.ts";
import {
  cleanupMounted,
  mountClamp,
  rootElement,
  settle,
  textElement,
  unmountClamp,
} from "./browser.ts";

const english =
  "Vue Clamp keeps dense application text readable while preserving the full source text for assistive technology. Resize the shared width to force every instance through the same layout change.";
const thai = "ทีมตอบสนองเหตุการณ์ต้องรักษาบริบทของลูกค้าและข้อมูลการแก้ไขปัญหาให้มองเห็นได้อย่างชัดเจน".repeat(2);

function longestPrefix(root: HTMLElement, source: string, marker: string, lines: number): string {
  const probe = root.cloneNode(true) as HTMLElement;
  probe.style.font = getComputedStyle(root).font;
  probe.style.width = `${root.getBoundingClientRect().width}px`;
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  root.after(probe);
  try {
    const target = textElement(probe);
    const content = probe.querySelector<HTMLElement>('[data-part="content"]')!;
    const prepared = prepareText(source);
    setElementText(target, source);
    if (fitsContent(probe, content, lines, undefined)) return source;
    for (let kept = prepared.boundaryOffsets.length - 2; kept >= 0; kept--) {
      const candidate = displayTextForKeptCount(prepared, 1, marker, kept);
      setElementText(target, candidate);
      if (fitsContent(probe, content, lines, undefined) || kept === 0) return candidate;
    }
    return marker;
  } finally {
    probe.remove();
  }
}

afterEach(cleanupMounted);

describe("measured grapheme end clamping", () => {
  it("restores exact inline styles when a wrapping-bound probe is interrupted", () => {
    const container = document.createElement("div");
    container.style.overflowWrap = "break-word";
    const target = document.createElement("span");
    target.textContent = thai;
    container.append(target);
    document.body.append(container);
    try {
      for (const original of [null, "word-break:keep-all!important;color:red"]) {
        if (original === null) target.removeAttribute("style");
        else target.setAttribute("style", original);
        const search = searchLineEndCandidates(
          { prepared: prepareText(thai), ellipsis: "…", ratio: 1 },
          { content: target, target, rootWidth: 84, lineLimit: 3, style: getComputedStyle(target) },
        );
        expect(search.next().done).toBe(false);
        expect(target.style.lineBreak).toBe("anywhere");
        search.return(undefined as never);
        expect(target.getAttribute("style")).toBe(original);
      }
    } finally {
      container.remove();
    }
  });

  it("crosses rejected word and hyphen cuts independently of resize history", async () => {
    for (const component of [LineClamp, PretextLineClamp]) {
      for (const source of [
        english,
        "really?! well-known application ownership stays visible.",
        "observability-platform-boundary-".repeat(20),
        "https://service.example.net/long-path/".repeat(20),
        "response\u200bownership soft\u00adhyphen and emoji 👩🏽‍💻 status stay visible.",
        "中英文混排 dashboard 需要保持正确文字边界，让我们验证真实浏览器的排版行为。".repeat(3),
      ]) {
        const marker = source === english ? "…" : "...";
        const mounted = mountClamp({
          component,
          text: source,
          font: "16px Arial",
          lineHeight: "22px",
          width: 84,
          props: { boundary: "grapheme", maxLines: 3, ellipsis: marker },
          after: () => h("span", { style: "display:inline-block;width:48px;height:18px" }),
        });
        for (const width of [84, 91, 360, 91, 84, 1000, 91, 104.5]) {
          mounted.width.value = width;
          await settle(2);
          const root = rootElement(mounted.container);
          expect(textElement(root).textContent, `${source}/${width}px`).toBe(
            longestPrefix(root, source, marker, 3),
          );
        }
        unmountClamp(mounted);
      }
    }
  });

  it("refines dictionary-based line breaks and restores the authored word-break", async () => {
    for (const component of [LineClamp, PretextLineClamp]) {
      const mounted = mountClamp({
        component,
        text: thai,
        font: "16px Arial",
        lineHeight: "22px",
        width: 84,
        props: { boundary: "grapheme", maxLines: 3 },
        after: () => h("span", { style: "display:inline-block;width:48px;height:18px" }),
      });
      for (const width of [84, 91, 300, 84, 1000, 91]) {
        mounted.width.value = width;
        await settle(2);
        const root = rootElement(mounted.container);
        expect(textElement(root).textContent, `${width}px`).toBe(longestPrefix(root, thai, "…", 3));
        expect(textElement(root).style.wordBreak).toBe("");
        expect(textElement(root).hasAttribute("style")).toBe(false);
        expect(getComputedStyle(textElement(root)).wordBreak).toBe("normal");
      }
      unmountClamp(mounted);
    }
  });

  it("preserves URL prefixes when CSS permits unbroken horizontal overflow", async () => {
    const source = "https://service.example.net/long-path/".repeat(17);
    for (const component of [LineClamp, PretextLineClamp]) {
      const mounted = mountClamp({
        component,
        text: source,
        font: "16px Arial",
        lineHeight: "24px",
        style: "overflow-wrap:normal",
        width: 300,
        props: { boundary: "grapheme", maxLines: 3 },
        after: () => h("span", { style: "display:inline-block;width:48px" }, "More"),
      });
      for (const width of [280, 260, 220, 180, 250, 330, 300, 190, 360, 240, 320, 210]) {
        mounted.width.value = width;
        await settle(2);
        const root = rootElement(mounted.container);
        expect(textElement(root).textContent, `${width}px`).toBe(
          longestPrefix(root, source, "…", 3),
        );
        expect(textElement(root).getAttribute("style")).toBeNull();
      }
      unmountClamp(mounted);
    }
  });

  it("rechecks grapheme cuts after source, marker, font and slot changes at the same width", async () => {
    const marker = ref("...");
    const affix = ref(48);
    const currentFont = ref("16px Arial");
    const mounted = mountClamp({
      component: PretextLineClamp,
      text: english,
      get font() {
        return currentFont.value;
      },
      lineHeight: "22px",
      width: 180,
      props: {
        boundary: "grapheme",
        maxLines: 3,
        get ellipsis() {
          return marker.value;
        },
      },
      after: () => h("span", { style: `display:inline-block;width:${affix.value}px;height:18px` }),
    });
    const family = "MeasuredGraphemeLateFont";
    const font = `24px ${family}, monospace`;
    const face = new FontFace(
      family,
      `url(${new URL("./fixtures/narrow.ttf", import.meta.url).href})`,
    );
    try {
      const changes: (() => void | Promise<void>)[] = [
        () => {},
        () => {
          marker.value = "[more]";
        },
        () => {
          affix.value = 96;
        },
        () => {
          mounted.text.value = "iiiiiiii iiiiiiii iiiiiiii iiiiiiii ".repeat(10);
        },
        () => {
          currentFont.value = font;
        },
        async () => {
          document.fonts.add(face);
          await document.fonts.load(font, "iiiiiiii");
          await document.fonts.ready;
          document.fonts.dispatchEvent(new Event("loadingdone"));
        },
      ];
      for (const change of changes) {
        await change();
        for (const width of [180, 240, 180]) {
          mounted.width.value = width;
          await settle();
          const root = rootElement(mounted.container);
          expect(textElement(root).textContent).toBe(
            longestPrefix(root, mounted.text.value, marker.value, 3),
          );
          expect(mounted.exposed.value!.clamped).toBe(
            textElement(root).textContent !== mounted.text.value,
          );
        }
      }
    } finally {
      document.fonts.delete(face);
    }
  });
});
