#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(packageRoot, "../..");
const rawArgs = process.argv.slice(2);
const normalizedArgs = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;
const separatorIndex = normalizedArgs.indexOf("--");
const targetArgs =
  separatorIndex >= 0 ? normalizedArgs.slice(0, separatorIndex) : normalizedArgs.slice(0, 1);
const passthroughArgs =
  separatorIndex >= 0 ? normalizedArgs.slice(separatorIndex + 1) : normalizedArgs.slice(1);
const targetSpecifier = targetArgs[0] ?? "current";

if (targetArgs.length > 1) {
  throw new Error(
    `Expected at most one vue-clamp target before "--", received: ${targetArgs.join(" ")}`,
  );
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? workspaceRoot,
      env: {
        ...process.env,
        ...options.env,
      },
      shell: process.platform === "win32",
      stdio: "inherit",
    });

    child.on("error", rejectRun);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolveRun();
        return;
      }

      rejectRun(
        new Error(
          signal
            ? `${command} ${args.join(" ")} exited with signal ${signal}`
            : `${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`,
        ),
      );
    });
  });
}

function dependencyForSpecifier(specifier) {
  if (specifier === "vue-clamp") {
    return "latest";
  }

  if (specifier.startsWith("vue-clamp@")) {
    return specifier.slice("vue-clamp@".length) || "latest";
  }

  if (
    specifier.startsWith(".") ||
    specifier.startsWith("..") ||
    specifier.startsWith("/") ||
    specifier.endsWith(".tgz")
  ) {
    const absolutePath = isAbsolute(specifier) ? specifier : resolve(workspaceRoot, specifier);
    return `file:${absolutePath}`;
  }

  return specifier;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function findPackageFromEntry(entry, packageName) {
  let current = dirname(entry);

  while (current !== dirname(current)) {
    const packageJsonPath = join(current, "package.json");
    if (await pathExists(packageJsonPath)) {
      const packageJson = await readJson(packageJsonPath);
      if (packageJson.name === packageName) {
        return {
          dir: current,
          packageJson,
        };
      }
    }

    current = dirname(current);
  }

  throw new Error(`Could not find ${packageName} package.json from ${entry}`);
}

async function currentTarget() {
  await run("vp", ["run", "vue-clamp#build"]);

  const entry = resolve(workspaceRoot, "packages/vue-clamp/dist/index.js");
  if (!(await pathExists(entry))) {
    throw new Error(`Current package build did not create ${entry}`);
  }

  const packageJson = await readJson(resolve(workspaceRoot, "packages/vue-clamp/package.json"));

  return {
    entry,
    specifier: "current",
    version: packageJson.version ?? "0.0.0",
  };
}

async function installedTarget(specifier) {
  const targetDir = resolve(tmpdir(), "vue-clamp-benchmark-targets", hash(specifier));
  const workspacePackageJson = await readJson(resolve(workspaceRoot, "package.json"));
  const requireFromBenchmark = createRequire(resolve(packageRoot, "package.json"));
  const benchmarkVuePackageJson = await readJson(requireFromBenchmark.resolve("vue/package.json"));
  await mkdir(targetDir, { recursive: true });

  await writeFile(
    resolve(targetDir, "package.json"),
    `${JSON.stringify(
      {
        packageManager: workspacePackageJson.packageManager,
        private: true,
        type: "module",
        dependencies: {
          "vue-clamp": dependencyForSpecifier(specifier),
          vue: benchmarkVuePackageJson.version,
        },
      },
      null,
      2,
    )}\n`,
  );

  await run("vp", ["install", "--lockfile=false", "--ignore-scripts"], { cwd: targetDir });

  const requireFromTarget = createRequire(resolve(targetDir, "package.json"));
  const entry = requireFromTarget.resolve("vue-clamp");
  const packageInfo = await findPackageFromEntry(entry, "vue-clamp");

  return {
    entry,
    specifier,
    version: packageInfo.packageJson.version ?? "unknown",
  };
}

const target =
  targetSpecifier === "current" ? await currentTarget() : await installedTarget(targetSpecifier);

await run("vp", ["test", "-c", "tools/benchmark/vite.package.config.ts", ...passthroughArgs], {
  env: {
    VUE_CLAMP_BENCH_ENTRY: target.entry,
    VUE_CLAMP_BENCH_SPECIFIER: target.specifier,
    VUE_CLAMP_BENCH_VERSION: target.version,
  },
});
