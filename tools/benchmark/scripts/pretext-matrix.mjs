#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "../../..");
const logDir = await mkdtemp(join(tmpdir(), "vue-clamp-pretext-matrix-"));
const log = createWriteStream(join(logDir, "pretext.log"));

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: workspaceRoot,
      env: { ...process.env, ...options.env },
      shell: process.platform === "win32",
      stdio: ["inherit", "pipe", "pipe"],
    });

    for (const [stream, output] of [
      [child.stdout, process.stdout],
      [child.stderr, process.stderr],
    ]) {
      stream.on("data", (chunk) => {
        output.write(chunk);
        options.log?.write(chunk);
      });
    }

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

try {
  await run("vp", ["run", "benchmark#package", "--", "--targets", "current,current/pretext"], {
    env: { VUE_CLAMP_BENCH_SCENARIOS: "pretext" },
    log,
  });
} finally {
  await new Promise((resolveClose) => log.end(resolveClose));
}

await run("vp", [
  "run",
  "benchmark#report",
  "--",
  logDir,
  "journey/research",
  "--basename",
  "319-pretext-performance-matrix",
]);
