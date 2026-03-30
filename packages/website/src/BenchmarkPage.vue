<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import BenchmarkScenarioPreview from "./BenchmarkScenarioPreview.vue";
import {
  BENCHMARK_BASELINE_ENGINE,
  runAllBenchmarks,
  summarizeGeometricMeanSpeedup,
} from "./benchmark/runBenchmarks.ts";
import type { BenchmarkEngineName, BenchmarkReport } from "./benchmark/runBenchmarks.ts";
import type { BenchmarkScenario } from "./benchmark/runBenchmarks.ts";

declare global {
  interface Window {
    __lastClampBenchmark?: BenchmarkReport;
    __runClampBenchmarks?: () => Promise<BenchmarkReport>;
  }
}

interface Summary {
  engine: BenchmarkEngineName;
  label: string;
  color: string;
  wins: number;
  ratio: number;
}

interface Cell {
  ratio: number;
  tip: string;
  best: boolean;
}

interface Bar {
  engine: BenchmarkEngineName;
  label: string;
  color: string;
  width: number;
  tip: string;
}

interface Row {
  id: string;
  label: string;
  scenario: BenchmarkScenario;
  detail: string;
  facts: string[];
  bars: Bar[];
  pretext: Cell;
  optimized: Cell;
  legacy: Cell;
}

const ORDER: BenchmarkEngineName[] = ["pretext", "optimized-dom", "legacy-dom"];
const BAR_LABELS: Record<BenchmarkEngineName, string> = {
  pretext: "P",
  "optimized-dom": "O",
  "legacy-dom": "L",
};

const META: Record<BenchmarkEngineName, { label: string; color: string }> = {
  pretext: {
    label: "Pretext",
    color: "#7abf8f",
  },
  "optimized-dom": {
    label: "Optimized DOM",
    color: "#e3b35a",
  },
  "legacy-dom": {
    label: "Legacy DOM",
    color: "#88add8",
  },
};

const labRef = ref<HTMLElement | null>(null);
const running = ref(false);
const report = ref<BenchmarkReport | null>(null);
const errorMessage = ref("");
const openId = ref<string | null>(null);

const query = new URLSearchParams(window.location.search);
const autoRun = query.get("autorun") === "1";

function ops(ms: number): number {
  if (ms <= 0) {
    return 0;
  }

  return 1000 / ms;
}

function fmtOps(value: number): string {
  if (value >= 10000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  if (value >= 1000) {
    return `${value.toFixed(0)}`;
  }

  if (value >= 100) {
    return `${value.toFixed(1)}`;
  }

  return `${value.toFixed(2)}`;
}

function fmtX(value: number): string {
  return `${value.toFixed(2)}x`;
}

function ratio(baseMs: number, currentMs: number): number {
  if (baseMs <= 0 || currentMs <= 0) {
    return 0;
  }

  return baseMs / currentMs;
}

function tip(label: string, ms: number): string {
  return `${label}: ${fmtOps(ops(ms))} ops/s`;
}

function barWidth(value: number, max: number): number {
  if (max <= 0) {
    return 0;
  }

  return Math.max((value / max) * 100, 8);
}

function describeOperation(scenario: BenchmarkScenario): string {
  switch (scenario.operation) {
    case "noop":
      return "Re-runs the clamp logic without changing input state.";
    case "resize":
      return `Alternates container width between ${scenario.width}px and ${scenario.nextWidth}px.`;
    case "text-update":
      return "Alternates the source text between two content variants.";
    case "slot-update":
      return "Changes side-slot content while keeping the main text stable.";
    default:
      return "Measures the initial clamp from a cold rendered state.";
  }
}

function describeLimit(scenario: BenchmarkScenario): string {
  if (scenario.maxHeight !== undefined) {
    return `Limit: max-height ${scenario.maxHeight}.`;
  }

  if (scenario.maxLines !== undefined) {
    return `Limit: max-lines ${scenario.maxLines}.`;
  }

  return "Limit: none.";
}

function describeSlots(scenario: BenchmarkScenario): string {
  const parts: string[] = [];

  if (scenario.beforeText) {
    parts.push(`before ${JSON.stringify(scenario.beforeText)}`);
  }
  if (scenario.nextBeforeText) {
    parts.push(`before update ${JSON.stringify(scenario.nextBeforeText)}`);
  }
  if (scenario.afterText) {
    parts.push(`after ${JSON.stringify(scenario.afterText)}`);
  }
  if (scenario.nextAfterText) {
    parts.push(`after update ${JSON.stringify(scenario.nextAfterText)}`);
  }

  if (parts.length === 0) {
    return "No side slots.";
  }

  return `Slots: ${parts.join(", ")}.`;
}

function detail(scenario: BenchmarkScenario): string {
  return [
    describeOperation(scenario),
    `${describeLimit(scenario)} Clamp location: ${scenario.location}.`,
    describeSlots(scenario),
  ].join(" ");
}

function facts(scenario: BenchmarkScenario): string[] {
  const items = [
    `${scenario.batchSize} fixture${scenario.batchSize === 1 ? "" : "s"}`,
    `${scenario.iterations} iterations`,
    `${scenario.warmupIterations} warmup`,
    `${scenario.width}px width`,
  ];

  if (scenario.uniquePerItem) {
    items.push("unique text per item");
  }

  if (scenario.nextWidth !== undefined) {
    items.push(`alt ${scenario.nextWidth}px`);
  }

  if (scenario.nextText) {
    items.push("text swap");
  }

  if (
    scenario.beforeText ||
    scenario.afterText ||
    scenario.nextBeforeText ||
    scenario.nextAfterText
  ) {
    items.push("with slots");
  }

  return items;
}

function toggleRow(id: string): void {
  openId.value = openId.value === id ? null : id;
}

const summaryRows = computed<Summary[]>(() => {
  const data = report.value;
  if (!data) {
    return [];
  }

  return ORDER.map((engine) => ({
    engine,
    label: META[engine].label,
    color: META[engine].color,
    wins: data.summary.wins[engine],
    ratio: summarizeGeometricMeanSpeedup(data, engine, BENCHMARK_BASELINE_ENGINE),
  }));
});

const scenarioRows = computed<Row[]>(() => {
  const data = report.value;
  if (!data) {
    return [];
  }

  return data.scenarios.map((scenario) => {
    const legacyMs = scenario.results["legacy-dom"].medianIterationMs;
    const pretextMs = scenario.results.pretext.medianIterationMs;
    const optimizedMs = scenario.results["optimized-dom"].medianIterationMs;
    const pretextRatio = ratio(legacyMs, pretextMs);
    const optimizedRatio = ratio(legacyMs, optimizedMs);
    const maxRatio = Math.max(pretextRatio, optimizedRatio, 1);

    return {
      id: scenario.scenario.id,
      label: scenario.scenario.label,
      scenario: scenario.scenario,
      detail: detail(scenario.scenario),
      facts: facts(scenario.scenario),
      bars: ORDER.map((engine) => {
        let value = 1;
        let title = tip(META["legacy-dom"].label, legacyMs);

        if (engine === "pretext") {
          value = pretextRatio;
          title = tip(META.pretext.label, pretextMs);
        } else if (engine === "optimized-dom") {
          value = optimizedRatio;
          title = tip(META["optimized-dom"].label, optimizedMs);
        }

        return {
          engine,
          label: BAR_LABELS[engine],
          color: META[engine].color,
          width: barWidth(value, maxRatio),
          tip: `${META[engine].label}: ${fmtX(value)} · ${title}`,
        };
      }),
      pretext: {
        ratio: pretextRatio,
        tip: tip(META.pretext.label, pretextMs),
        best: pretextRatio === maxRatio,
      },
      optimized: {
        ratio: optimizedRatio,
        tip: tip(META["optimized-dom"].label, optimizedMs),
        best: optimizedRatio === maxRatio,
      },
      legacy: {
        ratio: 1,
        tip: tip(META["legacy-dom"].label, legacyMs),
        best: maxRatio === 1,
      },
    };
  });
});

const methodologyText = computed(() => {
  const data = report.value;
  if (!data) {
    return "";
  }

  return [
    `${META[data.methodology.baselineEngine].label} = 1.00x`,
    "higher is faster",
    "hover for ops/s",
    `min ${data.methodology.minimumMacroRuns} macro runs`,
  ].join(" · ");
});

async function runBenchmarks(): Promise<BenchmarkReport> {
  const labElement = labRef.value;
  if (!labElement) {
    throw new Error("Benchmark lab is not mounted.");
  }

  running.value = true;
  errorMessage.value = "";

  try {
    const nextReport = await runAllBenchmarks(labElement);
    report.value = nextReport;
    window.__lastClampBenchmark = nextReport;
    return nextReport;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    running.value = false;
  }
}

onMounted(() => {
  window.__runClampBenchmarks = runBenchmarks;

  if (autoRun) {
    void runBenchmarks();
  }
});

onBeforeUnmount(() => {
  delete window.__runClampBenchmarks;
});
</script>

<template>
  <article class="benchmark-page">
    <header class="benchmark-header">
      <div>
        <h1>Benchmark</h1>
        <p v-if="methodologyText" class="benchmark-meta">{{ methodologyText }}</p>
      </div>

      <div class="benchmark-actions">
        <a class="btn btn-sm" href="/">Demo</a>
        <button class="btn btn-sm btn-primary" :disabled="running" @click="void runBenchmarks()">
          {{ running ? "Running…" : "Run" }}
        </button>
      </div>
    </header>

    <p v-if="errorMessage" class="benchmark-error" role="alert">{{ errorMessage }}</p>

    <section v-if="!report" class="benchmark-empty">
      Run the suite to compare the three implementations.
    </section>

    <template v-else>
      <div class="benchmark-table-wrap">
        <table class="table table-striped table-hover benchmark-table">
          <thead>
            <tr>
              <th>Engine</th>
              <th>Wins</th>
              <th>Geo vs Legacy</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in summaryRows" :key="row.engine">
              <th>
                <span class="benchmark-engine-name">
                  <i class="benchmark-engine-dot" :style="{ '--engine-color': row.color }"></i>
                  {{ row.label }}
                </span>
              </th>
              <td class="benchmark-number">{{ row.wins }}</td>
              <td class="benchmark-number">{{ fmtX(row.ratio) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="benchmark-table-wrap">
        <table class="table table-striped table-hover benchmark-table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Bars</th>
              <th>Pretext</th>
              <th>Optimized</th>
              <th>Legacy</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="row in scenarioRows" :key="row.id">
              <tr>
                <th class="benchmark-scenario-cell">
                  <button
                    type="button"
                    class="benchmark-toggle"
                    :aria-expanded="openId === row.id"
                    @click="toggleRow(row.id)"
                  >
                    <span
                      class="benchmark-caret"
                      :class="{ 'benchmark-caret-open': openId === row.id }"
                    >
                      ▸
                    </span>
                    <span>{{ row.label }}</span>
                  </button>
                </th>
                <td class="benchmark-bars-cell">
                  <div class="benchmark-bars">
                    <div v-for="bar in row.bars" :key="bar.engine" class="benchmark-bar-row">
                      <span class="benchmark-bar-label">{{ bar.label }}</span>
                      <span class="benchmark-bar-track" :title="bar.tip">
                        <span
                          class="benchmark-bar-fill"
                          :style="{ backgroundColor: bar.color, width: `${bar.width}%` }"
                        ></span>
                      </span>
                    </div>
                  </div>
                </td>
                <td
                  class="benchmark-number benchmark-ratio"
                  :class="{ 'benchmark-best': row.pretext.best }"
                  :title="row.pretext.tip"
                >
                  {{ fmtX(row.pretext.ratio) }}
                </td>
                <td
                  class="benchmark-number benchmark-ratio"
                  :class="{ 'benchmark-best': row.optimized.best }"
                  :title="row.optimized.tip"
                >
                  {{ fmtX(row.optimized.ratio) }}
                </td>
                <td
                  class="benchmark-number benchmark-ratio"
                  :class="{ 'benchmark-best': row.legacy.best }"
                  :title="row.legacy.tip"
                >
                  {{ fmtX(row.legacy.ratio) }}
                </td>
              </tr>
              <tr v-if="openId === row.id" class="benchmark-detail-row">
                <td colspan="5" class="benchmark-detail-cell">
                  <BenchmarkScenarioPreview :scenario="row.scenario" />
                  <p class="benchmark-detail-text">{{ row.detail }}</p>
                  <p class="benchmark-detail-facts">{{ row.facts.join(" · ") }}</p>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>

    <div ref="labRef" class="benchmark-lab" aria-hidden="true"></div>
  </article>
</template>
