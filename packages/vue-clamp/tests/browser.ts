import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { LineClamp, RichLineClamp } from "../src/index.ts";
import { displayTextForKeptCount, normalizeLocationRatio, prepareText } from "../src/text.ts";

import type { App, Ref, VNodeChild } from "vue";
import type {
  LineClampExposed,
  ClampBoundary,
  LineClampLocation,
  LineClampProps,
  LineClampSlotProps,
  RichLineClampExposed,
  RichLineClampProps,
  RichLineClampSlotProps,
} from "../src/index.ts";

type SharedMountOptions<SlotProps> = {
  width?: number;
  applyWidthToComponent?: boolean;
  containerStyle?: string;
  style?: string;
  before?: (props: SlotProps) => VNodeChild;
  after?: (props: SlotProps) => VNodeChild;
};

type LineMountOptions = SharedMountOptions<LineClampSlotProps> & {
  text?: string;
  props?: Partial<LineClampProps> & Record<string, unknown>;
};

type RichMountOptions = SharedMountOptions<RichLineClampSlotProps> & {
  html: string;
  props?: Partial<RichLineClampProps> & Record<string, unknown>;
};

type MountedBase<TExposed> = {
  app: App;
  container: HTMLElement;
  width: Ref<number>;
  exposed: Ref<TExposed | null>;
};

export type MountedClamp = MountedBase<LineClampExposed> & {
  text: Ref<string>;
};

export type MountedRichClamp = MountedBase<RichLineClampExposed> & {
  html: Ref<string>;
};

const mounted = new Set<Pick<MountedBase<unknown>, "app" | "container">>();

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
  const content = root.querySelector('[data-part="content"]');
  if (!(content instanceof HTMLElement)) {
    throw new Error("Expected clamp content element.");
  }

  return content;
}

export function bodyElement(root: HTMLElement): HTMLElement {
  const textContainer = root.querySelector('[data-part="body"]');
  if (!(textContainer instanceof HTMLElement)) {
    throw new Error("Expected clamp text container element.");
  }

  return textContainer;
}

function textContainerChildren(root: HTMLElement): HTMLElement[] {
  return [...bodyElement(root).children].filter(
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

export function richContentElement(root: HTMLElement): HTMLElement {
  return bodyElement(root);
}

export function beforeElement(root: HTMLElement): HTMLElement | null {
  const element = root.querySelector('[data-part="before"]');
  return element instanceof HTMLElement ? element : null;
}

export function afterElement(root: HTMLElement): HTMLElement | null {
  const element = root.querySelector('[data-part="after"]');
  return element instanceof HTMLElement ? element : null;
}

function countLines(root: HTMLElement, clipToRoot: boolean): number {
  const rootRect = root.getBoundingClientRect();
  const lines: Array<{ top: number; bottom: number }> = [];

  for (const child of contentElement(root).children) {
    if (!(child instanceof HTMLElement)) {
      continue;
    }

    for (const rect of child.getClientRects()) {
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

export function bestBrowserFitText(
  root: HTMLElement,
  sourceText: string,
  maxLines: number,
  location: LineClampLocation = "end",
  ellipsis = "…",
  boundary: ClampBoundary = "grapheme",
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
    const prepared = prepareText(sourceText, boundary);
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

export function mountClamp(options: LineMountOptions): MountedClamp {
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
          LineClamp,
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

export function mountRichClamp(options: RichMountOptions): MountedRichClamp {
  const html = ref(options.html);
  const width = ref(options.width ?? 160);
  const exposed = ref<RichLineClampExposed | null>(null);
  const container = document.createElement("div");
  if (options.containerStyle) {
    container.setAttribute("style", options.containerStyle);
  }
  document.body.append(container);

  const Host = defineComponent({
    setup() {
      return () =>
        h(
          RichLineClamp,
          {
            ref: exposed,
            ...options.props,
            html: html.value,
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
    html,
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
