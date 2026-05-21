import vue from "@vitejs/plugin-vue";
import { playwright } from "vite-plus/test/browser-playwright";
import { websiteCodeHighlightPlugin } from "./packages/website/vite.highlight.ts";
import { websitePublicDir, websiteResolve } from "./packages/website/vite.shared.ts";

import type { Plugin } from "vite";

const mutedBrowserLogs = ["ResizeObserver loop completed with undelivered notifications."];

const browserLogFilter: Plugin = {
  name: "vue-clamp:browser-log-filter",
  apply: "serve",
  configureServer(server) {
    const loggers = [
      server.config.logger,
      ...Object.values(server.environments).map((environment) => environment.config.logger),
    ];

    for (const logger of loggers) {
      const error = logger.error.bind(logger);
      logger.error = (message, options) => {
        if (!mutedBrowserLogs.some((log) => message.includes(log))) {
          error(message, options);
        }
      };
    }
  },
};

export default {
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  publicDir: websitePublicDir,
  plugins: [browserLogFilter, websiteCodeHighlightPlugin(), vue()],
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
