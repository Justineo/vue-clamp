import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { LineClamp } from "../src/index.ts";
import { displayTextForKeptCount, prepareText } from "../src/text.ts";

import type { App, Component, Ref, VNodeChild } from "vue";
import type {
  LineClampExposed,
  LineClampLocation,
  LineClampProps,
  LineClampSlotProps,
} from "../src/index.ts";

type MountOptions = {
  text?: string;
  width?: number;
  applyWidthToComponent?: boolean;
  containerStyle?: string;
  props?: Partial<LineClampProps> & Record<string, unknown>;
  style?: string;
  before?: (props: LineClampSlotProps) => VNodeChild;
  after?: (props: LineClampSlotProps) => VNodeChild;
};

export type MountedClamp = {
  app: App;
  container: HTMLElement;
  text: Ref<string>;
  width: Ref<number>;
  exposed: Ref<LineClampExposed | null>;
};

const mounted = new Set<MountedClamp>();

function hostStyle(width: number, extra: string | undefined, includeWidth = true): string {
  return [
    "display:block",
    includeWidth ? `width:${width}px` : undefined,
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

function textContainerElement(root: HTMLElement): HTMLElement {
  const content = contentElement(root);

  if (content.children.length === 1 && content.firstElementChild instanceof HTMLElement) {
    return content.firstElementChild;
  }

  const textContainer = Array.from(content.children).find(
    (child) =>
      child instanceof HTMLElement &&
      (child.style.position === "relative" || child.style.flexGrow === "1"),
  );

  if (!(textContainer instanceof HTMLElement)) {
    throw new Error("Expected clamp text container element.");
  }

  return textContainer;
}

function textContainerChildren(root: HTMLElement): HTMLElement[] {
  return Array.from(textContainerElement(root).children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );
}

export function textElement(root: HTMLElement): HTMLElement {
  const children = textContainerChildren(root);
  const text =
    children.find((child) => child.getAttribute("aria-hidden") === "true") ?? children.at(-1);

  if (!(text instanceof HTMLElement)) {
    throw new Error("Expected clamp text element.");
  }

  return text;
}

export function accessibleTextElement(root: HTMLElement): HTMLElement | null {
  const children = textContainerChildren(root);
  const [accessibleText, visibleText] = children;

  return visibleText?.getAttribute("aria-hidden") === "true" ? (accessibleText ?? null) : null;
}

export function beforeElement(root: HTMLElement): HTMLElement | null {
  const content = contentElement(root);
  const textContainer = textContainerElement(root);
  return content.firstElementChild === textContainer
    ? null
    : (content.firstElementChild as HTMLElement | null);
}

export function afterElement(root: HTMLElement): HTMLElement | null {
  const content = contentElement(root);
  const textContainer = textContainerElement(root);
  return content.lastElementChild === textContainer
    ? null
    : (content.lastElementChild as HTMLElement | null);
}

function countLines(root: HTMLElement, clipToRoot: boolean): number {
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

      if (clipToRoot && (rect.bottom <= rootRect.top + 0.5 || rect.top >= rootRect.bottom - 0.5)) {
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

export function visibleLineCount(root: HTMLElement): number {
  return countLines(root, true);
}

export function naturalLineCount(root: HTMLElement): number {
  return countLines(root, false);
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

function normalizeLocationRatio(location: LineClampLocation): number {
  if (location === "start") {
    return 0;
  }

  if (location === "middle") {
    return 0.5;
  }

  if (location === "end") {
    return 1;
  }

  return Math.max(0, Math.min(1, location));
}

export function bestBrowserFitText(
  root: HTMLElement,
  sourceText: string,
  maxLines: number,
  location: LineClampLocation = "end",
  ellipsis = "…",
): string {
  const clone = root.cloneNode(true);
  if (!(clone instanceof HTMLElement)) {
    throw new Error("Expected clamp clone element.");
  }

  const cloneText = textElement(clone);

  clone.style.position = "absolute";
  clone.style.left = "-99999px";
  clone.style.top = "0";
  clone.style.visibility = "hidden";
  clone.style.maxHeight = "none";
  clone.style.overflow = "visible";
  document.body.append(clone);

  try {
    const prepared = prepareText(sourceText);
    const ratio = normalizeLocationRatio(location);
    let low = 0;
    let high = Math.max(0, prepared.boundaryOffsets.length - 2);
    let best = 0;

    while (low <= high) {
      const kept = Math.floor((low + high) / 2);
      cloneText.textContent = displayTextForKeptCount(prepared, ratio, ellipsis, kept);

      if (naturalLineCount(clone) <= maxLines) {
        best = kept;
        low = kept + 1;
      } else {
        high = kept - 1;
      }
    }

    return displayTextForKeptCount(prepared, ratio, ellipsis, best);
  } finally {
    clone.remove();
  }
}

export function mountClampWithComponent(component: Component, options: MountOptions): MountedClamp {
  const text = ref(options.text ?? "");
  const width = ref(options.width ?? 160);
  const exposed = ref<LineClampExposed | null>(null);
  const container = document.createElement("div");
  if (options.containerStyle) {
    container.setAttribute("style", options.containerStyle);
  }
  document.body.append(container);

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          component,
          {
            ref: exposed,
            ...options.props,
            text: text.value,
            style: hostStyle(width.value, options.style, options.applyWidthToComponent ?? true),
          },
          {
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

export function mountClamp(options: MountOptions): MountedClamp {
  return mountClampWithComponent(LineClamp, options);
}

export function cleanupMounted(): void {
  for (const mountedClamp of mounted) {
    mountedClamp.app.unmount();
    mountedClamp.container.remove();
  }

  mounted.clear();
}
