import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";
import websiteConfig from "./packages/website/vite.config.ts";

export default defineConfig({
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  plugins: websiteConfig.plugins,
  resolve: websiteConfig.resolve,
  test: {
    include: ["packages/vue-clamp/tests/**/*.browser.benchmark.ts"],
    fileParallelism: false,
    testTimeout: 120000,
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
});
