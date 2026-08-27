import vue from "@vitejs/plugin-vue";
import defineRender from "@vue-macros/define-render/vite";
import { browserLogFilter } from "./scripts/browser-log-filter.ts";
import { createPlaywrightProvider } from "./scripts/browser-provider.ts";

export default {
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  plugins: [browserLogFilter, vue(), defineRender()],
  test: {
    include: ["tools/benchmark/src/pretext.browser.benchmark.ts"],
    fileParallelism: false,
    testTimeout: 120000,
    browser: {
      enabled: true,
      provider: createPlaywrightProvider(),
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
