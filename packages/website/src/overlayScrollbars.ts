import type { ObjectDirective } from "vue";
import type {
  OverlayScrollbars as OverlayScrollbarsInstance,
  PartialOptions,
} from "overlayscrollbars";

const INSTANCE_KEY = Symbol("overlayScrollbars");
const REQUEST_KEY = Symbol("overlayScrollbarsRequest");

type OverlayScrollbarsTarget = HTMLElement & {
  [INSTANCE_KEY]?: OverlayScrollbarsInstance;
  [REQUEST_KEY]?: number;
};

type OverlayScrollbarsFactory = typeof import("overlayscrollbars").OverlayScrollbars;

let overlayScrollbarsLoader: Promise<OverlayScrollbarsFactory> | null = null;

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

export const verticalOverlayScrollbarsOptions = {
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

function loadOverlayScrollbars(): Promise<OverlayScrollbarsFactory> {
  overlayScrollbarsLoader ??= Promise.all([
    import("overlayscrollbars/overlayscrollbars.css"),
    import("overlayscrollbars"),
  ]).then(([, module]) => module.OverlayScrollbars);

  return overlayScrollbarsLoader;
}

export async function initOverlayScrollbars(
  element: HTMLElement,
  options?: PartialOptions,
): Promise<OverlayScrollbarsInstance | null> {
  const target = element as OverlayScrollbarsTarget;
  const nextOptions = withDefaultOptions(options);

  setInitializeAttribute(target);

  const current = target[INSTANCE_KEY];
  if (current) {
    current.options(nextOptions);
    return current;
  }

  const requestId = (target[REQUEST_KEY] ?? 0) + 1;
  target[REQUEST_KEY] = requestId;

  const createOverlayScrollbars = await loadOverlayScrollbars();
  if (!target.isConnected || target[REQUEST_KEY] !== requestId) {
    return null;
  }

  const instance = createOverlayScrollbars(target, nextOptions);
  target[INSTANCE_KEY] = instance;
  return instance;
}

export function destroyOverlayScrollbars(element: HTMLElement): void {
  const target = element as OverlayScrollbarsTarget;
  target[REQUEST_KEY] = (target[REQUEST_KEY] ?? 0) + 1;
  target[INSTANCE_KEY]?.destroy();
  delete target[INSTANCE_KEY];
}

export function initBodyOverlayScrollbars(): () => void {
  const { body, documentElement: html } = document;

  html.setAttribute("data-overlayscrollbars-initialize", "");
  body.setAttribute("data-overlayscrollbars-initialize", "");

  let destroyed = false;
  let instance: OverlayScrollbarsInstance | null = null;

  void loadOverlayScrollbars().then((createOverlayScrollbars) => {
    if (destroyed) {
      return;
    }

    instance = createOverlayScrollbars(
      {
        cancel: {
          body: false,
        },
        target: body,
      },
      withDefaultOptions(verticalOverlayScrollbarsOptions),
    );
  });

  return () => {
    destroyed = true;
    instance?.destroy();
    instance = null;
  };
}

export const overlayScrollbarsDirective: ObjectDirective<HTMLElement, PartialOptions | undefined> =
  {
    beforeMount(element) {
      setInitializeAttribute(element);
    },
    mounted(element, binding) {
      void initOverlayScrollbars(element, binding.value);
    },
    updated(element, binding) {
      const { oldValue, value } = binding;
      if (value !== oldValue) {
        void initOverlayScrollbars(element, value);
      }
    },
    unmounted(element) {
      destroyOverlayScrollbars(element);
    },
  };
