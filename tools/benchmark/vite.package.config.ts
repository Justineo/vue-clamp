import { createRequire } from "node:module";
import vue from "@vitejs/plugin-vue";
import { browserLogFilter } from "../../scripts/browser-log-filter.ts";
import { createPlaywrightProvider } from "../../scripts/browser-provider.ts";

const require = createRequire(import.meta.url);
const targetEntry = process.env.VUE_CLAMP_BENCH_ENTRY;
const targetSpecifier = process.env.VUE_CLAMP_BENCH_SPECIFIER ?? "unknown";
const targetVersion = process.env.VUE_CLAMP_BENCH_VERSION ?? "unknown";
const vueEntry = require.resolve("vue/dist/vue.runtime.esm-bundler.js");
const testTimeout = numericEnv("VUE_CLAMP_BENCH_TEST_TIMEOUT") ?? 1_800_000;

if (!targetEntry) {
  throw new Error("Missing VUE_CLAMP_BENCH_ENTRY. Run this config through benchmark#package.");
}

export default {
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    __VUE_CLAMP_BENCH_SAMPLING__: JSON.stringify({
      maxScenarioMs: numericEnv("VUE_CLAMP_BENCH_MAX_SCENARIO_MS"),
      maxRuns: numericEnv("VUE_CLAMP_BENCH_MAX_RUNS"),
      minRuns: numericEnv("VUE_CLAMP_BENCH_MIN_RUNS"),
      minScenarioMs: numericEnv("VUE_CLAMP_BENCH_MIN_SCENARIO_MS"),
      mode: process.env.VUE_CLAMP_BENCH_MODE,
      warmupRuns: numericEnv("VUE_CLAMP_BENCH_WARMUP_RUNS"),
    }),
    __VUE_CLAMP_BENCH_TARGET__: JSON.stringify({
      entry: targetEntry,
      specifier: targetSpecifier,
      version: targetVersion,
    }),
  },
  plugins: [browserLogFilter, vue()],
  resolve: {
    alias: [
      {
        find: /^vue-clamp$/,
        replacement: targetEntry,
      },
      {
        find: /^vue$/,
        replacement: vueEntry,
      },
    ],
    dedupe: ["vue"],
  },
  test: {
    include: ["tools/benchmark/src/**/*.browser.benchmark.ts"],
    fileParallelism: false,
    testTimeout,
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

function numericEnv(name: string): number | undefined {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }

  const numberValue = Number.parseFloat(value);
  if (!Number.isFinite(numberValue)) {
    throw new Error(`${name} must be a finite number.`);
  }

  return numberValue;
}
