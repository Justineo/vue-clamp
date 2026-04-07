import { fileURLToPath, URL } from "node:url";

import {
  PlaywrightBrowserProvider,
  playwright as createPlaywrightProvider,
} from "vite-plus/test/browser-playwright";

import type { PlaywrightProviderOptions } from "vite-plus/test/browser-playwright";

const resizeObserverFilterScript = fileURLToPath(
  new URL("./resize-observer-error-filter.ts", import.meta.url),
);

class FilteredPlaywrightBrowserProvider extends PlaywrightBrowserProvider {
  constructor(
    project: ConstructorParameters<typeof PlaywrightBrowserProvider>[0],
    options: ConstructorParameters<typeof PlaywrightBrowserProvider>[1],
  ) {
    super(project, options);
    this.initScripts = [...this.initScripts, resizeObserverFilterScript];
  }
}

export function playwright(options: PlaywrightProviderOptions = {}) {
  const provider = createPlaywrightProvider(options);

  return {
    ...provider,
    providerFactory(project: ConstructorParameters<typeof PlaywrightBrowserProvider>[0]) {
      return new FilteredPlaywrightBrowserProvider(project, options);
    },
  };
}
