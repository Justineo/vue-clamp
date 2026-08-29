import { gzipSync } from "node:zlib";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";

const workspaceRoot = resolve(import.meta.dirname, "../../..");
const packageDist = resolve(workspaceRoot, "packages/vue-clamp/dist");
const cases = {
  browser: `export { LineClamp } from ${JSON.stringify(pathToFileURL(resolve(packageDist, "index.js")).href)};`,
  both: `export { LineClamp as BrowserLineClamp } from ${JSON.stringify(pathToFileURL(resolve(packageDist, "index.js")).href)};
export { LineClamp as PretextLineClamp } from ${JSON.stringify(pathToFileURL(resolve(packageDist, "pretext.js")).href)};`,
  pretext: `export { LineClamp } from ${JSON.stringify(pathToFileURL(resolve(packageDist, "pretext.js")).href)};`,
};

const results = [];
const directory = await mkdtemp(join(tmpdir(), "vue-clamp-pretext-size-"));

try {
  for (const [name, source] of Object.entries(cases)) {
    const entry = join(directory, `${name}.js`);
    const output = join(directory, name);
    await writeFile(entry, source);
    await build({
      configFile: false,
      logLevel: "silent",
      build: {
        emptyOutDir: true,
        lib: {
          entry,
          formats: ["es"],
          fileName: () => "bundle.js",
        },
        minify: "esbuild",
        outDir: output,
        rollupOptions: { external: ["vue"] },
        sourcemap: false,
      },
    });

    const bundle = await readFile(join(output, "bundle.js"));
    results.push({
      gzipBytes: gzipSync(bundle, { level: 9 }).byteLength,
      name,
      rawBytes: bundle.length,
    });
  }
} finally {
  await rm(directory, { force: true, recursive: true });
}

console.log(`PRETEXT_SIZE_RESULT ${JSON.stringify(results)}`);
