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
const { passthroughArgs, targetArgs } = splitCliArgs(rawArgs);
const { positionalTargets, targetSpecifiers } = parseTargetArgs(targetArgs);

if (positionalTargets.length > 1) {
  throw new Error(
    `Expected at most one vue-clamp target, received: ${positionalTargets.join(" ")}`,
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

function splitCliArgs(args) {
  const normalizedArgs = args[0] === "--" ? args.slice(1) : args;
  const separatorIndex = normalizedArgs.indexOf("--");

  if (separatorIndex >= 0) {
    return {
      passthroughArgs: normalizedArgs.slice(separatorIndex + 1),
      targetArgs: normalizedArgs.slice(0, separatorIndex),
    };
  }

  const targetArgCount = normalizedArgs[0] === "--targets" ? 2 : 1;

  return {
    passthroughArgs: normalizedArgs.slice(targetArgCount),
    targetArgs: normalizedArgs.slice(0, targetArgCount),
  };
}

function parseTargetArgs(args) {
  const positionalTargets = [];
  let targetSpecifiers = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--targets") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--targets expects a comma-separated vue-clamp target list.");
      }

      targetSpecifiers = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }

    positionalTargets.push(arg);
  }

  if (targetSpecifiers && positionalTargets.length > 0) {
    throw new Error("--targets cannot be combined with a positional vue-clamp target.");
  }

  return {
    positionalTargets,
    targetSpecifiers: targetSpecifiers?.length
      ? targetSpecifiers
      : [positionalTargets[0] ?? "current"],
  };
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

  await run("vp", ["install", "--", "--lockfile=false", "--ignore-scripts", "--force"], {
    cwd: targetDir,
  });

  const requireFromTarget = createRequire(resolve(targetDir, "package.json"));
  const entry = requireFromTarget.resolve("vue-clamp");
  const packageInfo = await findPackageFromEntry(entry, "vue-clamp");

  return {
    entry,
    specifier,
    version: packageInfo.packageJson.version ?? "unknown",
  };
}

const targets = [];
const targetBySpecifier = new Map();
for (const specifier of targetSpecifiers) {
  let target = targetBySpecifier.get(specifier);
  if (!target) {
    target = specifier === "current" ? await currentTarget() : await installedTarget(specifier);
    targetBySpecifier.set(specifier, target);
  }

  targets.push(target);
}

await run("vp", ["test", "-c", "tools/benchmark/vite.package.config.ts", ...passthroughArgs], {
  env: {
    VUE_CLAMP_BENCH_ENTRY: targets[0].entry,
    VUE_CLAMP_BENCH_SPECIFIER: targets[0].specifier,
    VUE_CLAMP_BENCH_TARGETS: JSON.stringify(targets),
    VUE_CLAMP_BENCH_VERSION: targets[0].version,
  },
});
