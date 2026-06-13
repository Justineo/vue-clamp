declare const __VUE_CLAMP_BENCH_TARGET__: {
  entry: string;
  specifier: string;
  version: string;
};

declare const __VUE_CLAMP_BENCH_TARGETS__: {
  entry: string;
  specifier: string;
  version: string;
}[];

declare const __VUE_CLAMP_BENCH_SAMPLING__: {
  maxScenarioMs?: number;
  maxRuns?: number;
  minRuns?: number;
  minScenarioMs?: number;
  mode?: string;
  warmupRuns?: number;
};

declare const __VUE_CLAMP_BENCH_SCENARIOS__: string[];

declare const __VUE_CLAMP_BENCH_COUNTERS__: boolean;

declare module "vue-clamp" {
  import type { Component } from "vue";

  export const InlineClamp: Component;
  export const LineClamp: Component;
  export const RichLineClamp: Component;
  export const WrapClamp: Component;
}

declare module "vue-clamp-benchmark-targets" {
  import type { Component } from "vue";

  type ComponentName = "InlineClamp" | "LineClamp" | "RichLineClamp" | "WrapClamp";

  export const benchmarkTargets: {
    entry: string;
    module: Partial<Record<ComponentName, Component>>;
    specifier: string;
    version: string;
  }[];
}
