#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Compare built packages in production Vue. Native browser task metrics include
// output capture; flush time excludes observer settlement, and settled time
// includes two deliberate frame waits. None is a browser paint measurement.
const workspace = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const require = createRequire(join(workspace, "tools/benchmark/package.json"));
const packageRequire = createRequire(join(workspace, "packages/vue-clamp/package.json"));
const { createServer } = await import(require.resolve("vite"));
const { chromium, firefox, webkit } = require("playwright");
const positional = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
if (!positional[0])
  throw new Error(
    "Pass a built baseline package directory, optionally a candidate directory and --heap.",
  );
const before = resolve(positional[0]);
const after = resolve(positional[1] ?? join(workspace, "packages/vue-clamp"));
const heapMode = process.argv.includes("--heap");
const browserName = process.env.VUE_CLAMP_UPDATE_BROWSER ?? "chromium";
if (heapMode && browserName !== "chromium") throw new Error("Heap comparisons require Chromium.");
const browserType = { chromium, firefox, webkit }[browserName];
if (!browserType) throw new Error("Unknown browser.");
const names = ["before", "after", "control"];
const scenarios = (
  process.env.VUE_CLAMP_UPDATE_SCENARIOS ??
  "source-line-large,source-line-full-large-distinct,source-line-cjk-large-distinct,source-inline-emoji-large-distinct,source-rich-huge-distinct,source-rich-full-large-distinct,resize-wrap-tiny"
).split(",");
const counts = (process.env.VUE_CLAMP_UPDATE_COUNTS ?? "20").split(",").map(Number);
const rounds = Number(process.env.VUE_CLAMP_UPDATE_ROUNDS ?? 8);
const steps = Number(process.env.VUE_CLAMP_UPDATE_STEPS ?? 12);
if (![rounds, steps, ...counts].every((number) => Number.isInteger(number) && number > 0))
  throw new Error("Counts, rounds, and steps must be positive integers.");
const allowedTokens = new Set(
  "source resize noop font item metrics line inline rich wrap plain distinct large huge short full cjk emoji grapheme longword needle nested atomic affix height tiny".split(
    " ",
  ),
);
if (
  scenarios.some(
    (scenario) =>
      scenario.split("-").some((part) => !allowedTokens.has(part)) ||
      !/^(source|resize|noop|font|item)-(line|inline|rich|wrap)(-|$)/u.test(scenario),
  )
)
  throw new Error("Unknown update scenario.");
const directory = await mkdtemp(join(tmpdir(), "vue-clamp-update-costs-"));
async function fingerprint(packageDirectory) {
  const files = (await readdir(join(packageDirectory, "dist")))
    .filter((file) => file.endsWith(".js"))
    .sort();
  const hash = createHash("sha256");
  for (const file of files)
    hash.update(file).update(await readFile(join(packageDirectory, "dist", file)));
  return hash.digest("hex");
}
const hashes = { before: await fingerprint(before), after: await fingerprint(after) };
const aliases = {
  vue: require.resolve("vue/dist/vue.runtime.esm-bundler.js"),
  "@chenglou/pretext": packageRequire.resolve("@chenglou/pretext"),
  "candidate-0": join(before, "dist/index.js"),
  "candidate-1": join(after, "dist/index.js"),
  "candidate-2": join(before, "dist/index.js"),
};

const runtime = String.raw`
import * as target0 from "candidate-0";
import * as target1 from "candidate-1";
import * as target2 from "candidate-2";

import { createApp, defineComponent, h, ref, nextTick } from "vue";
const targets = [target0, target1, target2];
const frame = () => new Promise(requestAnimationFrame);
const channel = new MessageChannel();
let completeTask;
channel.port1.onmessage = () => completeTask?.();
const task = () =>
  new Promise((r) => {
    completeTask = r;
    channel.port2.postMessage(0);
  });
const flush = async () => {
  await nextTick();
  await nextTick();
  await nextTick();
  await task();
};
const copies = {
  cjk: "这是一个需要在不同宽度下保持正确文字边界的组件。中英文混排 dashboard 让我们验证真实浏览器的排版行为。",
  latin:
    "Operational dashboards keep ownership and incident context visible while surrounding panels change width. ",
  emoji: "👨‍👩‍👧‍👦 family 👩🏽‍💻 developer 🇨🇳 flag ❤️ heart café élan dashboard ",
};
let mounted;
window.prepare = async (target, scenario, count) => {
  if (mounted) {
    mounted.app.unmount();
    mounted.container.remove();
    await flush();
    await frame();
  }
  const entry = targets[target],
    width = ref(scenario.includes("needle") ? 2 : scenario.includes("tiny") ? 64 : 300),
    revision = ref(0),
    itemWidth = ref(42);
  const kind = scenario.includes("inline")
    ? "inline"
    : scenario.includes("rich")
      ? "rich"
      : scenario.includes("wrap")
        ? "wrap"
        : "line";
  const Component =
    entry[
      { line: "LineClamp", inline: "InlineClamp", rich: "RichLineClamp", wrap: "WrapClamp" }[kind]
    ];
  const sourceKind = scenario.includes("cjk")
    ? "cjk"
    : scenario.includes("emoji")
      ? "emoji"
      : "latin";
  const copy = copies[sourceKind],
    length = scenario.includes("huge") ? 30000 : scenario.includes("large") ? 6000 : 600;
  const source = scenario.includes("short")
    ? "Short title"
    : scenario.includes("longword")
      ? "👩🏽‍💻".repeat(Math.ceil(length / 7))
      : copy.repeat(Math.ceil(length / copy.length)).slice(0, length);
  const items = Array.from({ length: scenario.includes("tiny") ? 1000 : 60 }, (_, i) => ({
    id: i,
    label: scenario.includes("tiny") ? "" : "Item " + i,
    width: i % 2 ? 3 : 5,
  }));
  const container = document.createElement("div");
  document.body.append(container);
  const App = defineComponent({
    setup: () => () =>
      h(
        "div",
        {},
        Array.from({ length: count }, (_, i) => {
          const text =
            (scenario.startsWith("source") ? revision.value + ": " : "") +
            (scenario.includes("distinct") ? i + ": " : "") +
            source;
          const style = {
            display: "block",
            width: width.value + "px",
            fontFamily: "Arial",
            fontSize: "var(--font-size,16px)",
            lineHeight: "24px",
          };
          const props = {
            key: i,
            style,
            title: String(revision.value),
            boundary: scenario.includes("grapheme") ? "grapheme" : "word",
          };
          if (kind === "rich")
            props.html = scenario.includes("plain")
              ? text
              : scenario.includes("nested")
                ? Array.from(
                    { length: 12 },
                    (_, j) =>
                      "<strong><em>" +
                      text.slice(
                        j * Math.ceil(text.length / 12),
                        (j + 1) * Math.ceil(text.length / 12),
                      ) +
                      "</em></strong>" +
                      (scenario.includes("atomic")
                        ? '<span style="display:inline-block;width:24px;height:16px">#</span>'
                        : ""),
                  ).join("")
                : '<strong>Release </strong><em class="main-leaf">' + text + "</em>";
          else if (kind === "wrap") props.items = items;
          else props.text = text;
          if (kind === "inline") props.location = "middle";
          else if (scenario.includes("height")) props.maxHeight = 48;
          else
            props.maxLines = scenario.includes("full") ? 3000 : scenario.includes("needle") ? 1 : 3;
          const slots =
            kind === "wrap"
              ? {
                  item: ({ item }) =>
                    h(
                      "span",
                      {
                        style: {
                          display: "inline-block",
                          width: (scenario.includes("tiny") ? item.width : itemWidth.value) + "px",
                          height: scenario.includes("tiny") ? "16px" : undefined,
                          font: "12px Arial",
                        },
                      },
                      item.label,
                    ),
                }
              : scenario.includes("affix")
                ? {
                    after: () =>
                      h("span", { style: { display: "inline-block", width: "48px" } }, "More"),
                  }
                : undefined;
          return h(Component, props, slots);
        }),
      ),
  });
  const app = createApp(App);
  app.mount(container);
  await flush();
  await frame();
  await frame();
  await flush();
  mounted = { app, container, width, revision, itemWidth, scenario };
};
window.run = async (steps) => {
  const { container, width, revision, itemWidth, scenario } = mounted;
  const outputs = [];
  let ms = 0,
    flushMs = 0;
  for (let i = 0; i < steps; i++) {
    let start;
    if (scenario.startsWith("font")) {
      await new Promise((resolve) =>
        requestAnimationFrame(() => {
          start = performance.now();
          if (scenario.includes("metrics"))
            container.style.setProperty("--font-size", i % 2 ? "16px" : "20px");
          document.fonts.dispatchEvent(new Event("loadingdone"));
          requestAnimationFrame(resolve);
        }),
      );
      await flush();
    } else {
      start = performance.now();
      if (scenario.startsWith("source") || scenario.startsWith("noop")) revision.value++;
      else if (scenario.startsWith("item")) itemWidth.value = i % 2 ? 42 : 30;
      else
        width.value = (
          scenario.includes("tiny")
            ? [1200, 64, 2000, 120, 480, 64, 800, 160, 1200, 96, 600, 64]
            : [280, 260, 220, 180, 250, 330, 300, 190, 360, 240, 320, 210]
        )[i % 12];
      await flush();
    }
    flushMs += performance.now() - start;
    await frame();
    await frame();
    await flush();
    ms += performance.now() - start;
    outputs.push([...container.firstElementChild.children].map((root) => root.outerHTML));
  }
  return { settledMs: ms, flushMs, outputs };
};
window.checkRuntime = () => {
  let warnings = 0;
  const old = console.warn;
  console.warn = () => warnings++;
  const app = createApp(
    defineComponent({
      props: { sample: { type: String, required: true } },
      render: () => h("span"),
    }),
    { sample: 42 },
  );
  app.mount(document.createElement("div"));
  app.unmount();
  console.warn = old;
  return warnings;
};
window.outputs = () =>
  [...mounted.container.firstElementChild.children].map((root) => root.outerHTML);
window.clear = async () => {
  if (mounted) {
    mounted.app.unmount();
    mounted.container.remove();
    mounted = null;
  }
  await flush();
  await frame();
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
  root: directory,
  configFile: false,
  logLevel: "error",
  define: {
    "process.env.NODE_ENV": '"production"',
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  resolve: { alias: aliases, dedupe: ["vue"] },
  optimizeDeps: {
    include: ["vue"],
    esbuildOptions: { define: { "process.env.NODE_ENV": '"production"' } },
  },
  server: { host: "127.0.0.1", port: 0, fs: { allow: [workspace, before, after, directory] } },
});
let browser;
try {
  await server.listen();
  browser = await browserType.launch(
    process.env.VUE_CLAMP_UPDATE_BROWSER_PATH
      ? { executablePath: process.env.VUE_CLAMP_UPDATE_BROWSER_PATH }
      : {},
  );
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => {
    if (!error.message.includes("ResizeObserver loop")) errors.push(error.message);
  });
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.ready);
  if (await page.evaluate(() => window.checkRuntime())) throw new Error("Development Vue runtime.");
  const cdp = browserName === "chromium" ? await page.context().newCDPSession(page) : null;
  if (cdp) await cdp.send("Performance.enable");
  if (heapMode) await cdp.send("HeapProfiler.enable");
  async function usedHeap() {
    await cdp.send("HeapProfiler.collectGarbage");
    const snapshot = await cdp.send("Performance.getMetrics");
    return snapshot.metrics.find((metric) => metric.name === "JSHeapUsedSize").value;
  }
  const metricKeys = [
    "LayoutCount",
    "LayoutDuration",
    "RecalcStyleCount",
    "RecalcStyleDuration",
    "ScriptDuration",
    "TaskDuration",
  ];
  const rows = [];
  for (const count of counts)
    for (const scenario of scenarios) {
      let reference;
      for (let round = -1; round < rounds; round++)
        for (let order = 0; order < names.length; order++) {
          const target = (order + Math.max(0, round)) % names.length;
          await page.evaluate(() => window.clear());
          const emptyHeap = heapMode ? await usedHeap() : undefined;
          await page.evaluate(
            ([target, scenario, count]) => window.prepare(target, scenario, count),
            [target, scenario, count],
          );
          let result;
          if (heapMode) {
            const used = await usedHeap();
            result = {
              emptyHeap,
              usedHeap: used,
              retainedBytes: used - emptyHeap,
              ...(await cdp.send("Memory.getDOMCounters")),
              outputs: await page.evaluate(() => window.outputs()),
            };
          } else {
            const before = cdp ? await cdp.send("Performance.getMetrics") : null;
            result = await page.evaluate((steps) => window.run(steps), steps);
            const after = cdp ? await cdp.send("Performance.getMetrics") : null;
            if (after)
              for (const key of metricKeys)
                result[key] =
                  after.metrics.find((metric) => metric.name === key).value -
                  before.metrics.find((metric) => metric.name === key).value;
          }
          const output = JSON.stringify(result.outputs);
          if (reference && reference !== output) {
            await writeFile(
              join(directory, "mismatch.json"),
              JSON.stringify(
                {
                  scenario,
                  count,
                  target: names[target],
                  expected: JSON.parse(reference),
                  actual: result.outputs,
                },
                null,
                2,
              ),
            );
            throw new Error(
              "Output mismatch: " + scenario + "/" + names[target] + ". See " + directory,
            );
          }
          reference = output;
          delete result.outputs;
          if (round < 0) continue;
          const row = { scenario, count, round, target: names[target], ...result };
          rows.push(row);
          console.log(JSON.stringify(row));
        }
    }
  if (errors.length) throw new Error(errors.join("\n"));
  await writeFile(
    join(directory, "results.json"),
    JSON.stringify(
      {
        browser: browser.version(),
        before,
        after,
        hashes,
        heapMode,
        names,
        scenarios,
        counts,
        rounds,
        steps,
        rows,
      },
      null,
      2,
    ),
  );
  console.log("Results: " + join(directory, "results.json"));
} finally {
  await browser?.close();
  await server.close();
}
