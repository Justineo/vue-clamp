<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, watch } from "vue";
import { runLegacyDomClamp } from "../../vue-clamp/benchmark/dom/legacy.ts";
import { runOptimizedLegacyDomClamp } from "../../vue-clamp/benchmark/dom/optimized.ts";
import { runPretextDomClamp } from "../../vue-clamp/benchmark/pretext-dom.ts";
import type { BenchmarkClampInput, BenchmarkDomFixture } from "../../vue-clamp/benchmark/types.ts";
import type { BenchmarkEngineName, BenchmarkScenario } from "./benchmark/runBenchmarks.ts";

interface PreviewState {
  id: string;
  label: string;
  width: number;
  text: string;
  beforeText: string | undefined;
  afterText: string | undefined;
}

const props = defineProps<{
  scenario: BenchmarkScenario;
}>();

const ORDER: BenchmarkEngineName[] = ["pretext", "optimized-dom", "legacy-dom"];
const LABELS: Record<BenchmarkEngineName, string> = {
  pretext: "Pretext",
  "optimized-dom": "Optimized DOM",
  "legacy-dom": "Legacy DOM",
};
const COLORS: Record<BenchmarkEngineName, string> = {
  pretext: "#7abf8f",
  "optimized-dom": "#e3b35a",
  "legacy-dom": "#88add8",
};
const RUNNERS: Record<BenchmarkEngineName, (input: BenchmarkClampInput) => void> = {
  "legacy-dom": runLegacyDomClamp,
  "optimized-dom": runOptimizedLegacyDomClamp,
  pretext: runPretextDomClamp,
};

const hosts = new Map<string, HTMLElement>();
const hostWidths = new WeakMap<HTMLElement, number>();
let queued = false;
let resizeObserver: ResizeObserver | null = null;

function setHost(key: string, node: unknown): void {
  const current = hosts.get(key);

  if (node instanceof HTMLElement) {
    if (current === node) {
      return;
    }

    if (current) {
      resizeObserver?.unobserve(current);
      hostWidths.delete(current);
    }

    hosts.set(key, node);
    resizeObserver?.observe(node);
    queueRender();
    return;
  }

  if (current) {
    resizeObserver?.unobserve(current);
    hostWidths.delete(current);
  }
  hosts.delete(key);
}

function queueRender(): void {
  if (queued) {
    return;
  }

  queued = true;
  queueMicrotask(() => {
    queued = false;
    void renderPreviews();
  });
}

function normalizeCssLength(value: number | string | undefined): string {
  if (value === undefined) {
    return "";
  }

  return typeof value === "number" ? `${value}px` : value;
}

function variantText(text: string, uniquePerItem: boolean | undefined): string {
  if (!uniquePerItem) {
    return text;
  }

  return `${text} [0]`;
}

function states(scenario: BenchmarkScenario): PreviewState[] {
  const label = scenario.operation === "initial" || scenario.operation === "noop" ? "Case" : "A";
  const text = variantText(scenario.text, scenario.uniquePerItem);
  const base: PreviewState = {
    id: "a",
    label,
    width: scenario.width,
    text,
    beforeText: scenario.beforeText,
    afterText: scenario.afterText,
  };

  switch (scenario.operation) {
    case "resize":
      if (scenario.nextWidth !== undefined) {
        return [
          base,
          {
            ...base,
            id: "b",
            label: "B",
            width: scenario.nextWidth,
          },
        ];
      }
      break;
    case "text-update":
      if (scenario.nextText) {
        return [
          base,
          {
            ...base,
            id: "b",
            label: "B",
            text: variantText(scenario.nextText, scenario.uniquePerItem),
          },
        ];
      }
      break;
    case "slot-update":
      return [
        base,
        {
          ...base,
          id: "b",
          label: "B",
          beforeText: scenario.nextBeforeText ?? scenario.beforeText,
          afterText: scenario.nextAfterText ?? scenario.afterText,
        },
      ];
    default:
      break;
  }

  return [base];
}

const previewStates = computed(() => states(props.scenario));

function buildFixture(host: HTMLElement, state: PreviewState): BenchmarkDomFixture {
  const rootElement = document.createElement("div");
  rootElement.className = "preview-root";
  rootElement.style.width = `${state.width}px`;
  rootElement.style.maxWidth = "100%";
  rootElement.style.font = "16px Georgia, serif";
  rootElement.style.lineHeight = "24px";
  rootElement.style.overflow = "hidden";
  rootElement.style.whiteSpace = "normal";
  rootElement.style.overflowWrap = "break-word";
  rootElement.style.maxHeight = normalizeCssLength(props.scenario.maxHeight);

  const contentElement = document.createElement("span");
  const textElement = document.createElement("span");
  contentElement.append(textElement);

  let beforeElement: HTMLElement | null = null;
  if (state.beforeText) {
    beforeElement = document.createElement("span");
    beforeElement.className = "preview-slot";
    beforeElement.textContent = state.beforeText;
    contentElement.prepend(beforeElement);
  }

  let afterElement: HTMLElement | null = null;
  if (state.afterText) {
    afterElement = document.createElement("span");
    afterElement.className = "preview-slot";
    afterElement.textContent = state.afterText;
    contentElement.append(afterElement);
  }

  rootElement.append(contentElement);
  host.replaceChildren(rootElement);

  return {
    rootElement,
    contentElement,
    textElement,
    beforeElement,
    afterElement,
  };
}

function buildInput(fixture: BenchmarkDomFixture, state: PreviewState): BenchmarkClampInput {
  const input: BenchmarkClampInput = {
    fixture,
    text: state.text,
    ellipsis: props.scenario.ellipsis,
    location: props.scenario.location,
  };

  if (props.scenario.maxLines !== undefined) {
    input.maxLines = props.scenario.maxLines;
  }

  if (props.scenario.maxHeight !== undefined) {
    input.maxHeight = props.scenario.maxHeight;
  }

  return input;
}

async function renderPreviews(): Promise<void> {
  await nextTick();

  for (const state of previewStates.value) {
    for (const engine of ORDER) {
      const host = hosts.get(`${state.id}:${engine}`);
      if (!host) {
        continue;
      }

      const fixture = buildFixture(host, state);
      RUNNERS[engine](buildInput(fixture, state));
    }
  }
}

onMounted(() => {
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver((entries) => {
      let widthChanged = false;

      for (const entry of entries) {
        if (!(entry.target instanceof HTMLElement)) {
          continue;
        }

        const nextWidth = entry.contentRect.width;
        const lastWidth = hostWidths.get(entry.target);
        if (lastWidth !== nextWidth) {
          hostWidths.set(entry.target, nextWidth);
          widthChanged = true;
        }
      }

      if (widthChanged) {
        queueRender();
      }
    });

    for (const host of hosts.values()) {
      resizeObserver.observe(host);
    }
  }

  queueRender();
});

watch(previewStates, () => {
  queueRender();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});
</script>

<template>
  <div class="preview-list">
    <section v-for="state in previewStates" :key="state.id" class="preview-state">
      <header class="preview-state-header">
        <span class="preview-state-label">{{ state.label }}</span>
        <span class="preview-state-meta">{{ state.width }}px</span>
      </header>

      <div class="preview-grid">
        <article v-for="engine in ORDER" :key="engine" class="preview-card">
          <header class="preview-card-header">
            <span class="preview-engine">
              <i class="preview-dot" :style="{ '--engine-color': COLORS[engine] }"></i>
              {{ LABELS[engine] }}
            </span>
          </header>
          <div :ref="(node) => setHost(`${state.id}:${engine}`, node)" class="preview-host"></div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.preview-list {
  display: grid;
  gap: 0.45rem;
  margin-bottom: 0.42rem;
}

.preview-state {
  display: grid;
  gap: 0.24rem;
}

.preview-state-header {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.preview-state-label {
  font-size: 0.63rem;
  font-weight: 600;
}

.preview-state-meta {
  color: #66758c;
  font-size: 0.6rem;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.42rem;
}

.preview-card {
  min-width: 0;
  border: 1px solid #d7dee3;
  border-radius: 0.12rem;
  background: #fff;
}

.preview-card-header {
  padding: 0.24rem 0.32rem;
  border-bottom: 1px solid #d7dee3;
  background: #f8f9fa;
}

.preview-engine {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  font-size: 0.58rem;
  font-weight: 600;
}

.preview-dot {
  width: 0.42rem;
  height: 0.42rem;
  border-radius: 999px;
  background: var(--engine-color);
}

.preview-host {
  overflow: auto hidden;
  padding: 0.28rem 0.32rem;
}

:deep(.preview-root) {
  max-width: 100%;
}

:deep(.preview-slot) {
  display: inline-flex;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .preview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
