#!/usr/bin/env node

import { createWriteStream } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { run } from "./run.mjs";

const workspaceRoot = resolve(import.meta.dirname, "../../..");
const logDir = await mkdtemp(join(tmpdir(), "vue-clamp-pretext-matrix-"));
const log = createWriteStream(join(logDir, "pretext.log"));

try {
  await run("vp", ["run", "benchmark#package", "--", "--targets", "current,current/pretext"], {
    cwd: workspaceRoot,
    env: { VUE_CLAMP_BENCH_SCENARIOS: "pretext" },
    log,
  });
} finally {
  await new Promise((resolveClose) => log.end(resolveClose));
}

await run(
  "vp",
  [
    "run",
    "benchmark#report",
    "--",
    logDir,
    "journey/research",
    "--basename",
    "319-pretext-performance-matrix",
  ],
  { cwd: workspaceRoot },
);
