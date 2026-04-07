import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite-plus";
import { websitePublicDir, websiteResolve } from "./vite.shared.ts";
import { playwright } from "./test/playwright-provider.ts";

import type { UserConfig } from "vite-plus";

const config: UserConfig = {
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  publicDir: websitePublicDir,
  plugins: [vue()],
  resolve: websiteResolve,
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
