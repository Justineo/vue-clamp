import { gzipSync } from "node:zlib";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const layoutEntry = JSON.stringify(fileURLToPath(import.meta.resolve("@chenglou/pretext")));
const richInlineEntry = JSON.stringify(
  fileURLToPath(import.meta.resolve("@chenglou/pretext/rich-inline")),
);
const cases = {
  layout: `export {
  layoutNextLineRange,
  measureNaturalWidth,
  prepareWithSegments,
} from ${layoutEntry};`,
  richInline: `export {
  layoutNextRichInlineLineRange,
  measureRichInlineStats,
  prepareRichInline,
} from ${richInlineEntry};`,
};

const results = [];

for (const [name, source] of Object.entries(cases)) {
  const directory = await mkdtemp(join(tmpdir(), `vue-clamp-${name}-`));
  const entry = join(directory, "entry.js");
  const output = join(directory, "dist");

  try {
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
        sourcemap: false,
      },
    });

    const bundle = await readFile(join(output, "bundle.js"));
    results.push({
      gzipBytes: gzipSync(bundle, { level: 9 }).byteLength,
      name,
      rawBytes: bundle.length,
    });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

console.log(`PRETEXT_SIZE_RESULT ${JSON.stringify(results)}`);
