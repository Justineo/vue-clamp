import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { LineClamp as BrowserLineClamp } from "../src/index.ts";
import { LineClamp } from "../src/pretext.ts";

import type { App, Component, Ref } from "vue";
import type { LineClampExposed } from "../src/pretext.ts";

type MountedClamp = {
  readonly app: App;
  readonly container: HTMLElement;
  readonly exposed: Ref<LineClampExposed | null>;
  readonly width: Ref<number>;
};

const mounted = new Set<MountedClamp>();

function frame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function settle(): Promise<void> {
  for (let index = 0; index < 4; index += 1) {
    await nextTick();
    await frame();
  }
}

function mountClamp(
  component: Component,
  text: string,
  font: string,
  initialWidth: number,
  props: Record<string, unknown>,
): MountedClamp {
  const container = document.createElement("div");
  const exposed = ref<LineClampExposed | null>(null);
  const width = ref(initialWidth);
  const app = createApp(
    defineComponent(
      () => () =>
        h(component, {
          maxLines: 3,
          ...props,
          ref: exposed,
          style: {
            font,
            lineHeight: "22px",
            overflowWrap: "break-word",
            width: `${width.value}px`,
          },
          text,
        }),
    ),
  );

  document.body.append(container);
  app.mount(container);
  const result = { app, container, exposed, width };
  mounted.add(result);
  return result;
}

function mountBrowser(text: string, font: string, width: number): MountedClamp {
  return mountClamp(BrowserLineClamp, text, font, width, { boundary: "word" });
}

function mountPretext(
  text: string,
  font: string,
  width: number,
  props: Record<string, unknown> = {},
): MountedClamp {
  return mountClamp(LineClamp, text, font, width, { font, ...props });
}

function unmountClamp(clamp: MountedClamp): void {
  clamp.app.unmount();
  clamp.container.remove();
  mounted.delete(clamp);
}

function rootElement(mountedClamp: MountedClamp): HTMLElement {
  const root = mountedClamp.container.firstElementChild;
  if (!(root instanceof HTMLElement)) throw new Error("Expected clamp root.");
  return root;
}

function bodyElement(mountedClamp: MountedClamp): HTMLElement {
  const body = rootElement(mountedClamp).querySelector('[data-part="body"]');
  if (!(body instanceof HTMLElement)) throw new Error("Expected clamp body.");
  return body;
}

function visibleText(mountedClamp: MountedClamp): string {
  const body = bodyElement(mountedClamp);
  const visible = [...body.children].find((child) => child.getAttribute("aria-hidden") === "true");
  return visible?.textContent ?? body.textContent ?? "";
}

describe("Pretext LineClamp", () => {
  it("matches browser-authoritative word clamping in its supported contract", async () => {
    const scenarios = [
      {
        font: "16px Georgia",
        text: "Release dashboards keep customer impact, regional mitigation, and ownership visible while responsive cards change width.",
      },
      {
        font: "16px Arial",
        text: "国际响应团队需要在多区域故障期间保留客户沟通缓解措施和后续责任，同时避免关键短语被截断。",
      },
      {
        font: "16px Arial",
        text: "ทีมตอบสนองเหตุการณ์ต้องรักษาบริบทของลูกค้าและข้อมูลการแก้ไขปัญหาให้มองเห็นได้อย่างชัดเจน",
      },
      {
        font: "16px Georgia",
        text: "observabilityPlatformBoundaryWithoutBreaks".repeat(7),
      },
    ];
    const widths = [180, 190, 200, 220, 240, 260, 300, 400, 440, 460, 480, 500, 520];

    for (const scenario of scenarios) {
      for (const width of widths) {
        const browser = mountBrowser(scenario.text, scenario.font, width);
        const predicted = mountPretext(scenario.text, scenario.font, width);
        await settle();

        expect(visibleText(predicted), `${scenario.font} at ${width}px`).toBe(visibleText(browser));
        unmountClamp(browser);
        unmountClamp(predicted);
      }
    }
  });

  it("updates from ResizeObserver data without geometry reads", async () => {
    const text =
      "Release dashboards keep customer impact and regional mitigation visible while cards resize.";
    const clamp = mountPretext(text, "16px Georgia", 180);
    await settle();
    expect(clamp.exposed.value?.clamped).toBe(true);

    const root = rootElement(clamp);
    const body = bodyElement(clamp);
    let geometryReads = 0;
    for (const element of [root, body]) {
      Object.defineProperties(element, {
        getBoundingClientRect: {
          configurable: true,
          value: () => {
            geometryReads += 1;
            return new DOMRect();
          },
        },
        getClientRects: {
          configurable: true,
          value: () => {
            geometryReads += 1;
            return [];
          },
        },
      });
    }

    clamp.width.value = 700;
    await settle();

    expect(geometryReads).toBe(0);
    expect(clamp.exposed.value?.clamped).toBe(false);
    expect(visibleText(clamp)).toBe(text);
  });

  it("keeps the full source available when predicted text is visible", async () => {
    const text = "Customer incident summaries preserve complete words while widths change.";
    const clamp = mountPretext(text, "16px Arial", 150);
    await settle();

    const [source, visible] = [...bodyElement(clamp).children];
    expect(source?.textContent).toBe(text);
    expect(visible?.getAttribute("aria-hidden")).toBe("true");
    expect(visible?.textContent?.endsWith("…")).toBe(true);
  });

  it("shares the standard expansion controls and clamp event", async () => {
    const changes: boolean[] = [];
    const text = "Customer incident summaries preserve complete words while widths change.";
    const clamp = mountPretext(text, "16px Arial", 150, {
      onClampchange: (value: boolean) => changes.push(value),
    });
    await settle();

    expect(changes).toEqual([true]);
    clamp.exposed.value?.expand();
    await settle();
    expect(clamp.exposed.value?.expanded).toBe(true);
    expect(visibleText(clamp)).toBe(text);
    expect(changes).toEqual([true, false]);

    clamp.exposed.value?.collapse();
    await settle();
    expect(clamp.exposed.value?.expanded).toBe(false);
    expect(changes).toEqual([true, false, true]);
  });

  it("shares active resize observation and releases it when idle", async () => {
    const OriginalResizeObserver = globalThis.ResizeObserver;
    let observerInstances = 0;
    globalThis.ResizeObserver = new Proxy(OriginalResizeObserver, {
      construct(Target, argumentsList: ConstructorParameters<typeof ResizeObserver>) {
        observerInstances += 1;
        return new Target(...argumentsList);
      },
    });

    try {
      const text = "Customer impact and mitigation stay visible while dashboards resize.";
      const first = mountPretext(text, "16px Arial", 180);
      const second = mountPretext(text, "16px Arial", 220);
      mountPretext(text, "16px Arial", 220, { expanded: true });
      await settle();
      expect(observerInstances).toBe(1);

      unmountClamp(first);
      unmountClamp(second);
      mountPretext(text, "16px Arial", 260);
      await settle();
      expect(observerInstances).toBe(2);
    } finally {
      globalThis.ResizeObserver = OriginalResizeObserver;
    }
  });
});

afterEach(() => {
  for (const clamp of mounted) {
    unmountClamp(clamp);
  }
});
