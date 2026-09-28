import { createRequire } from "node:module";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
const workspace = process.cwd();
const base = resolve(process.argv[2]);
const targets = process.argv.slice(3);
if (!targets.length) throw new Error("Pass an experiment root and at least one package name.");
const require = createRequire(join(workspace, "tools/benchmark/package.json"));
const { build } = await import(require.resolve("vite"));
const output = join(base, "sizes");
await mkdir(output, { recursive: true });
const rows = [];
for (const target of targets)
  for (const component of ["LineClamp", "InlineClamp", "RichLineClamp", "WrapClamp", "all"]) {
    const directory = join(output, target + "-" + component);
    await mkdir(directory, { recursive: true });
    const entry = join(directory, "entry.js");
    await writeFile(
      entry,
      "export " +
        (component === "all" ? "*" : "{" + component + "}") +
        " from " +
        JSON.stringify(join(base, target, "dist/index.js")) +
        ";",
    );
    await build({
      root: directory,
      configFile: false,
      logLevel: "silent",
      build: {
        lib: { entry, formats: ["es"], fileName: () => "bundle.js" },
        minify: "esbuild",
        outDir: join(directory, "dist"),
        rollupOptions: { external: ["vue"] },
        sourcemap: false,
      },
    });
    const bundle = await readFile(join(directory, "dist/bundle.js"));
    rows.push({
      target,
      component,
      raw: bundle.length,
      gzip: gzipSync(bundle, { level: 9 }).length,
    });
  }
await writeFile(join(output, "results.json"), JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows));
