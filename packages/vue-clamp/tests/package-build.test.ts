import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { build } from "vite-plus";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

const execFileAsync = promisify(execFile);
const packageRoot = fileURLToPath(new URL("..", import.meta.url));
let outputDirectory: string;

beforeAll(async () => {
  // Keep fresh artifacts near the package's dependencies without touching dist.
  outputDirectory = await mkdtemp(join(packageRoot, "node_modules/.package-test-"));
  await execFileAsync(
    "vp",
    ["pack", "src/index.ts", "src/pretext.ts", "--out-dir", outputDirectory],
    { cwd: packageRoot, timeout: 25_000 },
  );
}, 30_000);

afterAll(async () => {
  if (outputDirectory) await rm(outputDirectory, { recursive: true, force: true });
});

async function buildConsumer(component: "WrapClamp" | "LineClamp"): Promise<string> {
  const entry = "virtual:clamp-consumer";
  const props =
    component === "WrapClamp"
      ? { maxLines: 2, items: ["alpha", "beta"] }
      : { maxLines: 2, text: "alpha beta" };
  const result = await build({
    configFile: false,
    root: packageRoot,
    logLevel: "silent",
    plugins: [
      {
        name: "clamp-consumer",
        resolveId: (id) => (id === entry ? "\0" + entry : undefined),
        load: (id) =>
          id === "\0" + entry
            ? `
                import { createApp, h } from "vue";
                import { ${component} } from ${JSON.stringify(join(outputDirectory, "index.js"))};
                createApp({
                  render: () => h(${component}, ${JSON.stringify(props)}, {
                    item: ({ item }) => h("span", item),
                  }),
                }).mount("#app");
              `
            : undefined,
      },
    ],
    build: {
      write: false,
      minify: false,
      rolldownOptions: { input: entry },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  return outputs
    .flatMap((output) => {
      if (!("output" in output)) throw new Error("Expected a completed consumer build");
      return output.output;
    })
    .filter((output) => output.type === "chunk")
    .map((chunk) => chunk.code)
    .join("\n");
}

describe("built package segmentation contract", () => {
  it("imports the root entry without Intl.Segmenter in a fresh process", async () => {
    const entry = pathToFileURL(join(outputDirectory, "index.js")).href;
    // A separate process avoids module caches, source transforms and test mocks.
    await execFileAsync(process.execPath, [
      "--input-type=module",
      "--eval",
      `
        import { strict as assert } from "node:assert";
        delete Intl.Segmenter;
        const components = await import(${JSON.stringify(entry)});
        assert.deepEqual(Object.keys(components).sort(),
          ["InlineClamp", "LineClamp", "RichLineClamp", "WrapClamp"]);
        for (const [name, component] of Object.entries(components)) {
          assert.equal(component.name, name);
        }
      `,
    ]);
  });

  it("removes segmentation from a WrapClamp consumer but retains it for LineClamp", async () => {
    const wrap = await buildConsumer("WrapClamp");
    expect(wrap.includes("WrapClamp"), "WrapClamp component retained").toBe(true);
    expect(wrap.includes("Intl.Segmenter"), "WrapClamp segmentation removed").toBe(false);

    const line = await buildConsumer("LineClamp");
    expect(line.includes("LineClamp"), "LineClamp component retained").toBe(true);
    expect(line.includes("Intl.Segmenter"), "LineClamp segmentation retained").toBe(true);
  });
});
