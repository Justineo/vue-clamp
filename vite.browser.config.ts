import { defineConfig } from "vite-plus";
import { PlaywrightBrowserProvider, playwright } from "vite-plus/test/browser-playwright";
import websiteConfig from "./packages/website/vite.config.ts";

import type { PluginOption } from "vite-plus";

const resizeObserverLoopError = "ResizeObserver loop completed with undelivered notifications.";

type PatchedPlaywrightProvider = {
  __vueClampResizeObserverFilterPatched__?: boolean;
  openBrowserPage(
    sessionId: string,
    options: { parallel: boolean },
  ): Promise<{
    addInitScript(
      script: (args: { message: string }) => void,
      arg: { message: string },
    ): Promise<void>;
  }>;
};

const providerPrototype =
  PlaywrightBrowserProvider.prototype as unknown as PatchedPlaywrightProvider;

if (!providerPrototype.__vueClampResizeObserverFilterPatched__) {
  const openBrowserPage = Object.getOwnPropertyDescriptor(providerPrototype, "openBrowserPage")
    ?.value as PatchedPlaywrightProvider["openBrowserPage"];

  providerPrototype.openBrowserPage = async function (sessionId, options) {
    const page = await Reflect.apply(openBrowserPage, this, [sessionId, options]);
    await page.addInitScript(
      ({ message }) => {
        window.addEventListener(
          "error",
          (event) => {
            if (event.message !== message) {
              return;
            }

            event.preventDefault();
            event.stopImmediatePropagation();
          },
          { capture: true },
        );
      },
      { message: resizeObserverLoopError },
    );
    return page;
  };

  providerPrototype.__vueClampResizeObserverFilterPatched__ = true;
}

const websiteVuePlugin = websiteConfig.plugins?.[0] as PluginOption | undefined;

const config = {
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  plugins: websiteVuePlugin ? [websiteVuePlugin] : undefined,
  resolve: websiteConfig.resolve,
  test: {
    include: ["packages/vue-clamp/tests/**/*.browser.test.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      ui: false,
      screenshotFailures: false,
      viewport: {
        width: 1280,
        height: 900,
      },
      instances: [{ browser: "chromium" }],
    },
  },
};

export default defineConfig(config);
