import type { ObjectDirective } from "vue";
import {
  OverlayScrollbars,
  type OverlayScrollbars as OverlayScrollbarsInstance,
  type PartialOptions,
} from "overlayscrollbars";
import "overlayscrollbars/overlayscrollbars.css";

const INSTANCE_KEY = Symbol("overlayScrollbars");

type OverlayScrollbarsTarget = HTMLElement & {
  [INSTANCE_KEY]?: OverlayScrollbarsInstance;
};

const defaultScrollbarOptions = {
  autoHide: "leave",
  autoHideDelay: 240,
  theme: "os-theme-light",
} satisfies NonNullable<PartialOptions["scrollbars"]>;

export const horizontalOverlayScrollbarsOptions = {
  overflow: {
    x: "scroll",
    y: "hidden",
  },
} satisfies PartialOptions;

const bodyOverlayScrollbarsOptions = {
  overflow: {
    x: "hidden",
    y: "scroll",
  },
} satisfies PartialOptions;

function withDefaultOptions(options?: PartialOptions): PartialOptions {
  return {
    ...options,
    scrollbars: {
      ...defaultScrollbarOptions,
      ...options?.scrollbars,
    },
  };
}

function setInitializeAttribute(element: HTMLElement): void {
  element.setAttribute("data-overlayscrollbars-initialize", "");
}

export function initOverlayScrollbars(
  element: HTMLElement,
  options?: PartialOptions,
): OverlayScrollbarsInstance {
  const target = element as OverlayScrollbarsTarget;
  const nextOptions = withDefaultOptions(options);

  setInitializeAttribute(target);

  const current = target[INSTANCE_KEY];
  if (current) {
    current.options(nextOptions);
    return current;
  }

  const instance = OverlayScrollbars(target, nextOptions);
  target[INSTANCE_KEY] = instance;
  return instance;
}

export function destroyOverlayScrollbars(element: HTMLElement): void {
  const target = element as OverlayScrollbarsTarget;
  target[INSTANCE_KEY]?.destroy();
  delete target[INSTANCE_KEY];
}

export function initBodyOverlayScrollbars(): () => void {
  const html = document.documentElement;
  const body = document.body;

  html.setAttribute("data-overlayscrollbars-initialize", "");
  body.setAttribute("data-overlayscrollbars-initialize", "");

  const instance = OverlayScrollbars(
    {
      cancel: {
        body: false,
      },
      target: body,
    },
    withDefaultOptions(bodyOverlayScrollbarsOptions),
  );

  return () => {
    instance.destroy();
  };
}

export const overlayScrollbarsDirective: ObjectDirective<HTMLElement, PartialOptions | undefined> =
  {
    beforeMount(element) {
      setInitializeAttribute(element);
    },
    mounted(element, binding) {
      initOverlayScrollbars(element, binding.value);
    },
    updated(element, binding) {
      if (binding.value !== binding.oldValue) {
        initOverlayScrollbars(element, binding.value);
      }
    },
    unmounted(element) {
      destroyOverlayScrollbars(element);
    },
  };
