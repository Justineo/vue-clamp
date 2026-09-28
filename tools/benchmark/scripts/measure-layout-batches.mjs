#!/usr/bin/env node
import { createRequire } from "node:module";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const require = createRequire(join(workspaceRoot, "tools/benchmark/package.json"));
const { createServer } = await import(require.resolve("vite"));
const { chromium } = require("playwright");
const baseline = process.argv[2];
if (!baseline || baseline.startsWith("--")) {
  throw new Error("Pass a built baseline package directory, optionally followed by --metrics.");
}
const beforeEntry = resolve(baseline, "dist/index.js");
const afterEntry = join(workspaceRoot, "packages/vue-clamp/dist/index.js");
await Promise.all([readFile(beforeEntry), readFile(afterEntry)]);
const directory = await mkdtemp(join(tmpdir(), "vue-clamp-layout-batches-"));
const metricsEnabled = process.argv.includes("--metrics");
const scenarios = (
  process.env.VUE_CLAMP_BATCH_SCENARIOS ??
  "inline-middle,line-word,inline-middle-external,line-word-external"
).split(",");
const counts = (process.env.VUE_CLAMP_BATCH_COUNTS ?? "16").split(",").map(Number);
const rounds = Number(process.env.VUE_CLAMP_BATCH_ROUNDS ?? 8);
const cycles = Number(process.env.VUE_CLAMP_BATCH_CYCLES ?? 1);
const partitioned = process.argv.includes("--partitioned");
const targets = ["before", "after", "control", ...(partitioned ? ["partitioned"] : [])];
const partitionEntries = {};
for (const kind of ["line", "inline", "rich", "wrap", "pretext"]) {
  const location = join(directory, "partitioned", kind);
  if (partitioned) await cp(dirname(afterEntry), location, { recursive: true });
  partitionEntries["partition-" + kind] = partitioned
    ? join(location, kind === "pretext" ? "pretext.js" : "index.js")
    : kind === "pretext"
      ? join(workspaceRoot, "packages/vue-clamp/dist/pretext.js")
      : afterEntry;
}
if (![rounds, cycles, ...counts].every((value) => Number.isInteger(value) && value > 0)) {
  throw new Error("Round and instance counts must be positive integers.");
}
const supported = new Set([
  "mixed-text",
  "mixed-text-external",
  "mixed-all",
  "mixed-all-external",
  "rich-full",
  "rich-native",
  "rich",
  "rich-external",
  "rich-leaf",
  "rich-leaf-external",
  "rich-text",
  "wrap",
  "wrap-external",
  "pretext-fallback",
  "pretext-fallback-external",
  "mixed-pretext-external",
  "inline-middle",
  "inline-split",
  "line-word",
  "line-affix",
  "line-affix-external",
  "line-both",
  "line-height-affix",
  "line-dynamic-affix",
  "line-source-affix",
  "line-source",
  "line-cold-affix",
  "line-cold",
  "line-native-affix",
  "line-full",
  "inline-middle-external",
  "line-word-external",
]);
if (scenarios.some((scenario) => !supported.has(scenario))) {
  throw new Error("Unknown layout batch scenario.");
}

const runtime = String.raw`
import { createApp, defineComponent, h, ref, nextTick } from "vue";
import * as before from "batch-before";
import * as after from "batch-after";
import * as beforePretext from "batch-before-pretext";
import * as afterPretext from "batch-after-pretext";
import * as partitionLine from "partition-line";
import * as partitionInline from "partition-inline";
import * as partitionRich from "partition-rich";
import * as partitionWrap from "partition-wrap";
import * as partitionPretext from "partition-pretext";
const pretextTargets = { before: beforePretext, after: afterPretext, control: beforePretext, partitioned: partitionPretext };
const targets = { before, after, control: before, partitioned: {
  LineClamp: partitionLine.LineClamp, InlineClamp: partitionInline.InlineClamp,
  RichLineClamp: partitionRich.RichLineClamp, WrapClamp: partitionWrap.WrapClamp,
} };
const splitParts = text => ({ start: "/workspace/", body: text, end: ".ts" });
const copy = "Operational dashboards keep important ownership and incident context visible while their surrounding panels change width. ";
const frame = () => new Promise(requestAnimationFrame);
const flush = async () => { await nextTick(); await nextTick(); await nextTick(); };
// Cold mounting can require multiple slot-state passes. A browser task drains
// their microtasks without assuming a fixed number of Vue ticks or adding a frame.
const channel = new MessageChannel();
let taskComplete;
channel.port1.onmessage = () => taskComplete?.();
const task = () => new Promise(resolve => { taskComplete = resolve; channel.port2.postMessage(0); });
const cycles = Number(new URLSearchParams(location.search).get("cycles") ?? 1);
const widths = [340, 310, 285, 260, 235, 210, 185, 230, 290, 360, 300, 245, 195];
let mounted;
window.prepare = async (name, scenario, count) => {
  if (mounted) {
    mounted.observer?.disconnect();
    mounted.app.unmount();
    mounted.container.remove();
    await flush();
    await frame();
  }
  const width = ref(widths[0]);
  const revision = ref(1);
  const affixWidth = ref(32);
  const container = document.createElement("div");
  document.body.append(container);
  const inline = scenario.startsWith("inline");
  const external = scenario.endsWith("external");
  const texts = Array.from({ length: count }, (_, index) => copy.repeat(inline ? 3 : 2) + "#" + index);
  const component = targets[name][inline ? "InlineClamp" : "LineClamp"];
  const mixed = scenario.startsWith("mixed") || scenario.startsWith("wrap") || scenario.startsWith("pretext") || scenario.startsWith("rich");
  const kinds = scenario.startsWith("mixed-all") ? ["line", "inline", "rich", "wrap", "pretext"]
    : scenario.startsWith("mixed-text") ? ["line", "inline"]
    : scenario.startsWith("mixed-pretext") ? ["line", "inline", "pretext"]
    : scenario.startsWith("wrap") ? ["wrap"] : scenario.startsWith("rich") ? ["rich"] : ["pretext"];
  const items = Array.from({length: 24}, (_, index) => "Tag " + index);
  function mixedClamp(text, index) {
    const kind = kinds[index % kinds.length];
    const style = "display:block;width:" + (external ? "100%" : width.value + "px") + ";font:16px Arial,sans-serif;line-height:20px";
    const props = { key: index, style };
    const afterSlot = () => h(kind === "rich" ? "span" : "button", { style: "display:inline-block;padding:0;border:0;font:inherit;line-height:20px;width:36px" }, "more");
    if (kind === "wrap") return h(targets[name].WrapClamp, { ...props, items, maxLines: 2 }, {
      item: ({item, index}) => h("span", { style: "display:inline-block;width:" + (46 + (index % 4) * 11) + "px;height:20px;margin-right:4px;white-space:nowrap" }, item),
      after: ({ hiddenItems }) => h("span", { style: "display:inline-block;line-height:20px;white-space:nowrap" }, "+" + hiddenItems.length),
    });
    if (kind === "rich") return h(targets[name].RichLineClamp, { ...props, html: scenario.startsWith("rich-leaf") ? "<em>" + text + "</em>" : scenario === "rich-text" ? text : "Release <strong>notes</strong>: <em>" + text + "</em>", boundary: scenario === "rich-native" ? "grapheme" : "word", maxLines: scenario === "rich-full" ? 20 : 3 }, scenario === "rich-native" ? {} : {after: afterSlot});
    if (kind === "inline") return h(targets[name].InlineClamp, { ...props, text, location: "middle", split: splitParts });
    const entry = kind === "pretext" ? pretextTargets[name] : targets[name];
    return h(entry.LineClamp, { ...props, text, boundary: "word", ...(kind === "pretext" ? {maxHeight: 60} : {maxLines: 3}) }, { after: afterSlot });
  }
  const Host = defineComponent({ setup: () => () => h("div", {
    style: "display:grid;gap:2px;align-items:start;width:" + width.value + "px",
  }, texts.map((text, index) => mixed ? mixedClamp(text, index) : h(component, {
    key: index, text: scenario.startsWith("line-source") ? (revision.value % 3 === 0 ? "Short " + index : text + revision.value) : text, boundary: inline || scenario === "line-native-affix" ? "grapheme" : "word",
    location: inline ? "middle" : "end",
    ...(scenario === "line-height-affix" ? { maxHeight: 60 } : { maxLines: scenario === "line-full" ? 20 : scenario === "line-native-affix" ? 1 : 3 }),
    style: "display:block;width:" + (external ? "100%" : width.value + "px") + ";font:16px Arial,sans-serif;line-height:20px",
    ...(scenario === "inline-split" ? { split: splitParts } : {}),
  }, scenario.includes("affix") || scenario === "line-both" ? {
    ...(scenario === "line-both" || scenario === "line-height-affix" ? { before: () => h("strong", { style: "font:inherit;margin-right:4px" }, "Tag") } : {}),
    after: ({ clamped }) => h("button", { style: "padding:0;border:0;font:inherit;line-height:20px;" + (scenario === "line-dynamic-affix" ? "width:" + affixWidth.value + "px" : "") }, clamped ? "more" : "all"),
  } : {}))) });
  const app = createApp(Host);
  app.mount(container);
  await flush();
  await frame();
  await frame();
  let notify;
  // Register after the clamps. The notification marks the end of resize
  // delivery; flush also includes the measurement and reactive microtasks.
  const needsResize = external || (mixed && kinds.includes("wrap"));
  const observer = needsResize ? new ResizeObserver(() => notify?.()) : null;
  observer?.observe(container.firstElementChild);
  await frame();
  await frame();
  mounted = { app, Host, container, width, scenario, observer, revision, affixWidth, mixed, needsResize, setNotify: callback => { notify = callback; } };
};
window.run = async () => {
  const { container, width, scenario } = mounted;
  let ms = 0;
  const outputs = [];
  for (const nextWidth of Array.from({length: cycles}, () => widths.slice(1)).flat()) {
    let start;
    if (mounted.needsResize) {
      const changed = new Promise(resolve => mounted.setNotify(resolve));
      await new Promise(resolve => requestAnimationFrame(() => {
        start = performance.now();
        if (scenario.endsWith("external")) container.firstElementChild.style.width = nextWidth + "px";
        else width.value = nextWidth;
        resolve();
      }));
      await changed;
    } else {
      start = performance.now();
      if (scenario.startsWith("line-cold")) mounted.app.unmount();
      width.value = nextWidth;
      if (scenario.startsWith("line-cold")) {
        mounted.app = createApp(mounted.Host);
        mounted.app.mount(container);
      }
      if (scenario.startsWith("line-source")) mounted.revision.value++;
      if (scenario === "line-dynamic-affix") mounted.affixWidth.value = 32 + (nextWidth % 3) * 16;
    }
    await flush();
    if (scenario.startsWith("line-cold") || mounted.mixed) await task();
    ms += performance.now() - start;
    if (scenario.endsWith("external")) { await frame(); await frame(); await flush(); }
    // Differential output checking is outside the timed section.
    outputs.push(mounted.mixed ? [...container.firstElementChild.children].map(element => element.outerHTML) : [...container.querySelectorAll('[data-part="body"]')].map(element => element.innerHTML));
  }
  return { ms, outputs };
};
window.checkRuntime = () => {
  let warnings = 0;
  const warn = console.warn;
  console.warn = () => warnings++;
  const app = createApp(defineComponent({
    props: { sample: { type: String, required: true } }, render: () => h("span"),
  }), { sample: 42 });
  app.mount(document.createElement("div"));
  app.unmount();
  console.warn = warn;
  return warnings;
};
window.ready = true;
`;
await writeFile(join(directory, "runtime.js"), runtime);
await writeFile(
  join(directory, "index.html"),
  '<!doctype html><script type="module" src="/runtime.js"></script>',
);
process.env.NODE_ENV = "production";
const server = await createServer({
  configFile: false,
  root: directory,
  mode: "production",
  logLevel: "silent",
  define: {
    "process.env.NODE_ENV": '"production"',
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  resolve: {
    alias: {
      ...partitionEntries,
      vue: require.resolve("vue/dist/vue.runtime.esm-bundler.js"),
      "batch-before": beforeEntry,
      "batch-after": afterEntry,
      "batch-before-pretext": resolve(baseline, "dist/pretext.js"),
      "batch-after-pretext": join(workspaceRoot, "packages/vue-clamp/dist/pretext.js"),
      "@chenglou/pretext": require.resolve("@chenglou/pretext", {
        paths: [join(workspaceRoot, "packages/vue-clamp")],
      }),
    },
    dedupe: ["vue"],
  },
  server: {
    host: "127.0.0.1",
    port: 0,
    fs: { allow: [directory, workspaceRoot, dirname(beforeEntry)] },
  },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => {
    if (!error.message.includes("ResizeObserver loop")) errors.push(error.message);
  });
  await page.goto(server.resolvedUrls.local[0] + "?cycles=" + cycles);
  await page.waitForFunction(() => window.ready);
  if (await page.evaluate(() => window.checkRuntime())) throw new Error("Development Vue runtime.");
  const cdp = metricsEnabled ? await page.context().newCDPSession(page) : null;
  if (cdp) await cdp.send("Performance.enable");
  const metricNames = new Set([
    "LayoutCount",
    "LayoutDuration",
    "RecalcStyleCount",
    "RecalcStyleDuration",
    "ScriptDuration",
    "TaskDuration",
  ]);
  const results = [];
  const references = new Map();
  for (const count of counts)
    for (const scenario of scenarios) {
      for (const target of targets) {
        await page.evaluate(
          ([target, scenario, count]) => window.prepare(target, scenario, count),
          [target, scenario, count],
        );
        await page.evaluate(() => window.run());
      }
      for (let round = 0; round < rounds; round++) {
        for (let index = 0; index < targets.length; index++) {
          const target = targets[(index + round) % targets.length];
          await page.evaluate(
            ([target, scenario, count]) => window.prepare(target, scenario, count),
            [target, scenario, count],
          );
          const before = cdp ? await cdp.send("Performance.getMetrics") : null;
          const result = await page.evaluate(() => window.run());
          const after = cdp ? await cdp.send("Performance.getMetrics") : null;
          const key = scenario + "/" + count;
          const output = JSON.stringify(result.outputs);
          if (references.has(key) && references.get(key) !== output) {
            await writeFile(
              join(directory, "mismatch.json"),
              JSON.stringify(
                { expected: JSON.parse(references.get(key)), actual: result.outputs },
                null,
                2,
              ),
            );
            throw new Error(directory + ": Output mismatch: " + target + "/" + key + "/" + round);
          }
          references.set(key, output);
          delete result.outputs;
          const metrics = after
            ? Object.fromEntries(
                after.metrics
                  .filter((metric) => metricNames.has(metric.name))
                  .map((metric) => [
                    metric.name,
                    metric.value - before.metrics.find((value) => value.name === metric.name).value,
                  ]),
              )
            : {};
          const row = { scenario, count, round, target, ...result, ...metrics };
          results.push(row);
          console.log(JSON.stringify(row));
        }
      }
    }
  if (errors.length) throw new Error(errors.join("\n"));
  const output = join(directory, "results.json");
  await writeFile(
    output,
    JSON.stringify(
      {
        browser: browser.version(),
        beforeEntry,
        afterEntry,
        metricsEnabled,
        cycles,
        partitioned,
        results,
      },
      null,
      2,
    ),
  );
  console.log("Results: " + output);
} finally {
  await browser?.close();
  await server.close();
}
