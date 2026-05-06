import type { ObjectDirective } from "vue";
import { OverlayScrollbars } from "overlayscrollbars";
import type {
  OverlayScrollbars as OverlayScrollbarsInstance,
  PartialOptions,
} from "overlayscrollbars";
import "overlayscrollbars/overlayscrollbars.css";

const instances = new WeakMap<HTMLElement, OverlayScrollbarsInstance>();
const initAttr = "data-overlayscrollbars-initialize";

const scrollbars = {
  autoHide: "leave",
  autoHideDelay: 240,
  theme: "os-theme-light",
} satisfies NonNullable<PartialOptions["scrollbars"]>;

const xOptions = { overflow: { x: "scroll", y: "hidden" }, scrollbars } satisfies PartialOptions;
const yOptions = { overflow: { x: "hidden", y: "scroll" }, scrollbars } satisfies PartialOptions;

function mark(element: HTMLElement): void {
  element.setAttribute(initAttr, "");
}

function mount(element: HTMLElement, options: PartialOptions): void {
  mark(element);

  const current = instances.get(element);
  if (current) {
    current.options(options);
    return;
  }

  instances.set(element, OverlayScrollbars(element, options));
}

function destroy(element: HTMLElement): void {
  instances.get(element)?.destroy();
  instances.delete(element);
}

export function initBodyOverlayScrollbars(): () => void {
  const { body, documentElement: html } = document;

  mark(html);
  mark(body);

  const instance = OverlayScrollbars(
    {
      cancel: {
        body: false,
      },
      target: body,
    },
    yOptions,
  );

  return () => {
    instance.destroy();
  };
}

export const overlayScrollbarsDirective: ObjectDirective<HTMLElement> = {
  beforeMount: mark,
  mounted(element, binding) {
    mount(element, binding.modifiers.y ? yOptions : xOptions);
  },
  unmounted(element) {
    destroy(element);
  },
};
