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
const virtualTargetsModuleId = "vue-clamp-benchmark-targets";
const resolvedVirtualTargetsModuleId = `\0${virtualTargetsModuleId}`;

if (!targetEntry) {
  throw new Error("Missing VUE_CLAMP_BENCH_ENTRY. Run this config through benchmark#package.");
}

const benchmarkTargets = parseBenchmarkTargets();
const benchmarkScenarioFilter = parseScenarioFilter();

type BenchmarkTargetConfig = {
  entry: string;
  specifier: string;
  version: string;
};

export default {
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
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
    __VUE_CLAMP_BENCH_COUNTERS__: booleanEnv("VUE_CLAMP_BENCH_COUNTERS") ?? true,
    __VUE_CLAMP_BENCH_SCENARIOS__: JSON.stringify(benchmarkScenarioFilter),
    __VUE_CLAMP_BENCH_TARGET__: JSON.stringify({
      entry: targetEntry,
      specifier: targetSpecifier,
      version: targetVersion,
    }),
    __VUE_CLAMP_BENCH_TARGETS__: JSON.stringify(benchmarkTargets),
  },
  plugins: [benchmarkTargetsPlugin(), browserLogFilter, vue()],
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

function isBenchmarkTargetConfig(value: unknown): value is BenchmarkTargetConfig {
  if (!value || typeof value !== "object") {
    return false;
  }

  const target = value as Record<string, unknown>;

  return (
    typeof target.entry === "string" &&
    typeof target.specifier === "string" &&
    typeof target.version === "string"
  );
}

function parseBenchmarkTargets(): BenchmarkTargetConfig[] {
  const targets = process.env.VUE_CLAMP_BENCH_TARGETS;
  if (!targets) {
    return [
      {
        entry: targetEntry!,
        specifier: targetSpecifier,
        version: targetVersion,
      },
    ];
  }

  const parsed = JSON.parse(targets) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("VUE_CLAMP_BENCH_TARGETS must be a non-empty JSON array.");
  }

  return parsed.map((target, index) => {
    if (!isBenchmarkTargetConfig(target)) {
      throw new Error(`Invalid VUE_CLAMP_BENCH_TARGETS entry at index ${index}.`);
    }

    return target;
  });
}

function parseScenarioFilter(): string[] {
  const value = process.env.VUE_CLAMP_BENCH_SCENARIOS;
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function benchmarkTargetsPlugin() {
  return {
    name: "vue-clamp-benchmark-targets",
    resolveId(id: string) {
      return id === virtualTargetsModuleId ? resolvedVirtualTargetsModuleId : null;
    },
    load(id: string) {
      if (id !== resolvedVirtualTargetsModuleId) {
        return null;
      }

      const imports = benchmarkTargets
        .map((target, index) => `import * as target${index} from ${JSON.stringify(target.entry)};`)
        .join("\n");
      const entries = benchmarkTargets
        .map(
          (target, index) =>
            `{ entry: ${JSON.stringify(target.entry)}, specifier: ${JSON.stringify(
              target.specifier,
            )}, version: ${JSON.stringify(target.version)}, module: target${index} }`,
        )
        .join(",\n");

      return `${imports}\nexport const benchmarkTargets = [${entries}];\n`;
    },
  };
}

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

function booleanEnv(name: string): boolean | undefined {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) {
    return undefined;
  }

  if (["1", "true", "yes", "on"].includes(value)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value)) {
    return false;
  }

  throw new Error(`${name} must be a boolean value.`);
}
