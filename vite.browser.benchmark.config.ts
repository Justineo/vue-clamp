import vue from "@vitejs/plugin-vue";
import defineRender from "@vue-macros/define-render/vite";
import { playwright } from "vite-plus/test/browser-playwright";
import { websitePublicDir, websiteResolve } from "./packages/website/vite.shared.ts";
import { browserLogFilter } from "./scripts/browser-log-filter.ts";

export default {
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  publicDir: websitePublicDir,
  plugins: [browserLogFilter, vue(), defineRender()],
  resolve: websiteResolve,
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
};
