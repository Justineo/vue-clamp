import { createApp, defineComponent, h, nextTick, ref } from "vue";
import type { App, Ref, VNodeChild } from "vue";
import Clamp from "../src/index.ts";
import type { ClampExposed, ClampProps, ClampSlotScope } from "../src/index.ts";

type MountOptions = {
  text?: string;
  width?: number;
  props?: Partial<ClampProps> & Record<string, unknown>;
  style?: string;
  defaultSlot?: (text: Ref<string>) => VNodeChild;
  before?: (scope: ClampSlotScope) => VNodeChild;
  after?: (scope: ClampSlotScope) => VNodeChild;
};

export type MountedClamp = {
  app: App;
  container: HTMLElement;
  text: Ref<string>;
  width: Ref<number>;
  exposed: Ref<ClampExposed | null>;
};

const mounted = new Set<MountedClamp>();

function hostStyle(width: number, extra: string | undefined): string {
  return [
    "display:block",
    `width:${width}px`,
    "font:16px Georgia, serif",
    "line-height:20px",
    "white-space:normal",
    "overflow-wrap:break-word",
    extra,
  ]
    .filter(Boolean)
    .join(";");
}

export function frame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export async function settle(frames = 3): Promise<void> {
  for (let index = 0; index < frames; index += 1) {
    await nextTick();
    await frame();
  }
}

export function rootElement(container: HTMLElement): HTMLElement {
  const root = container.firstElementChild;
  if (!(root instanceof HTMLElement)) {
    throw new Error("Expected clamp root element.");
  }

  return root;
}

function contentElement(root: HTMLElement): HTMLElement {
  const content = root.firstElementChild;
  if (!(content instanceof HTMLElement)) {
    throw new Error("Expected clamp content element.");
  }

  return content;
}

export function textElement(root: HTMLElement): HTMLElement {
  const text = Array.from(contentElement(root).children).find(
    (child) => child instanceof HTMLElement && child.getAttribute("role") === "text",
  );

  if (!(text instanceof HTMLElement)) {
    throw new Error("Expected clamp text element.");
  }

  return text;
}

export function beforeElement(root: HTMLElement): HTMLElement | null {
  const content = contentElement(root);
  const text = textElement(root);
  return content.firstElementChild === text
    ? null
    : (content.firstElementChild as HTMLElement | null);
}

export function afterElement(root: HTMLElement): HTMLElement | null {
  const content = contentElement(root);
  const text = textElement(root);
  return content.lastElementChild === text
    ? null
    : (content.lastElementChild as HTMLElement | null);
}

export function visibleLineCount(root: HTMLElement): number {
  const rootRect = root.getBoundingClientRect();
  const lines: Array<{ top: number; bottom: number }> = [];

  for (const child of Array.from(contentElement(root).children)) {
    if (!(child instanceof HTMLElement)) {
      continue;
    }

    for (const rect of Array.from(child.getClientRects())) {
      if (rect.width <= 0 || rect.height <= 0) {
        continue;
      }

      if (rect.bottom <= rootRect.top + 0.5 || rect.top >= rootRect.bottom - 0.5) {
        continue;
      }

      const line = lines.find(
        (current) => rect.top < current.bottom - 1 && rect.bottom > current.top + 1,
      );

      if (line) {
        line.top = Math.min(line.top, rect.top);
        line.bottom = Math.max(line.bottom, rect.bottom);
      } else {
        lines.push({
          top: rect.top,
          bottom: rect.bottom,
        });
      }
    }
  }

  return lines.length;
}

export async function sampleVisibleLineCounts(root: HTMLElement, samples = 3): Promise<number[]> {
  const counts: number[] = [];
  for (let index = 0; index < samples; index += 1) {
    counts.push(visibleLineCount(root));
    if (index < samples - 1) {
      await frame();
    }
  }

  return counts;
}

export async function waitUntilVisible(root: HTMLElement, frames = 12): Promise<void> {
  for (let index = 0; index < frames; index += 1) {
    if (root.style.visibility !== "hidden") {
      return;
    }

    await settle(1);
  }

  throw new Error("Clamp never became visible.");
}

export function mountClamp(options: MountOptions): MountedClamp {
  const text = ref(options.text ?? "");
  const width = ref(options.width ?? 160);
  const exposed = ref<ClampExposed | null>(null);
  const container = document.createElement("div");
  document.body.append(container);

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          Clamp,
          {
            ref: exposed,
            autoresize: true,
            ...options.props,
            style: hostStyle(width.value, options.style),
          },
          {
            default: () => (options.defaultSlot ? options.defaultSlot(text) : text.value),
            before: options.before,
            after: options.after,
          },
        );
    },
  });

  const app = createApp(Host);
  app.mount(container);

  const mountedClamp = {
    app,
    container,
    text,
    width,
    exposed,
  };
  mounted.add(mountedClamp);
  return mountedClamp;
}

export function cleanupMounted(): void {
  for (const mountedClamp of mounted) {
    mountedClamp.app.unmount();
    mountedClamp.container.remove();
  }

  mounted.clear();
}
