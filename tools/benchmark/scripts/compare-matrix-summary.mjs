#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const structuralKeys = [
  "boundingRectReads",
  "clientHeightReads",
  "clientRectEntries",
  "clientRectReads",
  "clientTopReads",
  "clientWidthReads",
  "mutationRecords",
  "offsetHeightReads",
  "offsetWidthReads",
  "scrollWidthReads",
  "styleReads",
  "childListMutationRecords",
  "characterDataMutationRecords",
  "addedNodes",
  "removedNodes",
  "hiddenMutationRecords",
  "hiddenChildListMutationRecords",
  "hiddenAddedNodes",
  "hiddenRemovedNodes",
];

const args = process.argv.slice(2);

function parseArgs(rawArgs) {
  const options = {
    afterIndex: null,
    beforeIndex: null,
    keys: structuralKeys,
    mode: "no-regression",
    requiredScenarioFiles: [],
    requiredScenarios: [],
    scope: "both",
    tolerance: 0,
  };
  const positional = [];

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === "--") {
      continue;
    }

    if (arg === "--keys") {
      const value = rawArgs[index + 1];
      if (!value) {
        throw new Error("--keys expects a comma-separated counter key list.");
      }

      options.keys = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }

    if (arg === "--require-scenarios") {
      const value = rawArgs[index + 1];
      if (!value) {
        throw new Error("--require-scenarios expects a comma-separated scenario list.");
      }

      options.requiredScenarios.push(...scenarioList(value));
      index += 1;
      continue;
    }

    if (arg === "--require-scenarios-file") {
      const value = rawArgs[index + 1];
      if (!value) {
        throw new Error("--require-scenarios-file expects a scenario-list file path.");
      }

      options.requiredScenarioFiles.push(resolve(value));
      index += 1;
      continue;
    }

    if (arg === "--after-index" || arg === "--before-index") {
      const value = Number(rawArgs[index + 1]);
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`${arg} expects a non-negative integer.`);
      }

      if (arg === "--after-index") {
        options.afterIndex = value;
      } else {
        options.beforeIndex = value;
      }
      index += 1;
      continue;
    }

    if (arg === "--mode") {
      const value = rawArgs[index + 1];
      if (value !== "identical" && value !== "no-regression") {
        throw new Error("--mode expects either identical or no-regression.");
      }

      options.mode = value;
      index += 1;
      continue;
    }

    if (arg === "--scope") {
      const value = rawArgs[index + 1];
      if (value !== "both" && value !== "scenarios" && value !== "totals") {
        throw new Error("--scope expects totals, scenarios, or both.");
      }

      options.scope = value;
      index += 1;
      continue;
    }

    if (arg === "--tolerance") {
      const value = Number(rawArgs[index + 1]);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error("--tolerance expects a non-negative number.");
      }

      options.tolerance = value;
      index += 1;
      continue;
    }

    positional.push(arg);
  }

  if (positional.length !== 2) {
    throw new Error(
      "Usage: compare-matrix-summary <before-log-or-json> <after-log-or-json> [--before-index n] [--after-index n] [--mode no-regression|identical] [--scope totals|scenarios|both] [--keys key1,key2] [--require-scenarios name1,name2] [--require-scenarios-file path] [--tolerance n]",
    );
  }

  return {
    afterPath: resolve(positional[1]),
    beforePath: resolve(positional[0]),
    options,
  };
}

function scenarioList(value) {
  return value
    .split(/\r?\n/u)
    .flatMap((line) => line.replace(/#.*/u, "").split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

async function readSummary(path) {
  const text = await readFile(path, "utf8");
  const marker = "PACKAGE_MATRIX_SUMMARY";
  const markerLine = text.split(/\r?\n/u).find((line) => line.includes(marker));
  const raw = markerLine
    ? markerLine.slice(markerLine.indexOf(marker) + marker.length).trim()
    : text.trim();

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Could not parse matrix summary from ${path}: ${error.message}`);
  }
}

function singleReport(summary, index, label) {
  if (Array.isArray(summary.reports)) {
    if (index === null) {
      if (summary.reports.length === 1) {
        return summary.reports[0];
      }

      throw new Error(
        `${label} summary contains ${summary.reports.length} targets; pass --${label}-index to choose one.`,
      );
    }

    const report = summary.reports[index];
    if (!report) {
      throw new Error(
        `${label} summary target index ${index} is out of range; found ${summary.reports.length} targets.`,
      );
    }

    return report;
  }

  return summary;
}

async function requiredScenarios(options) {
  const items = [...options.requiredScenarios];

  for (const file of options.requiredScenarioFiles) {
    items.push(...scenarioList(await readFile(file, "utf8")));
  }

  return Array.from(new Set(items));
}

function scenarioKey(scenario) {
  return `${scenario.component}:${scenario.scenario}`;
}

function compareValue(before, after, mode, tolerance) {
  const delta = after - before;

  return mode === "identical" ? Math.abs(delta) <= tolerance : delta <= tolerance;
}

function checkCounter(failures, label, key, before, after, options) {
  if (typeof before !== "number" || typeof after !== "number") {
    return;
  }

  if (!compareValue(before, after, options.mode, options.tolerance)) {
    failures.push({
      after,
      before,
      delta: after - before,
      key,
      label,
    });
  }
}

function compareTotals(before, after, options, failures) {
  for (const key of options.keys) {
    checkCounter(failures, "totals", key, before.totals?.[key], after.totals?.[key], options);
  }
}

function compareScenarios(before, after, options, failures) {
  const afterByKey = new Map(after.scenarios.map((scenario) => [scenarioKey(scenario), scenario]));

  for (const beforeScenario of before.scenarios) {
    if (beforeScenario.status !== "ok") {
      continue;
    }

    const afterScenario = afterByKey.get(scenarioKey(beforeScenario));
    if (!afterScenario || afterScenario.status !== "ok") {
      failures.push({
        after: afterScenario?.status ?? "missing",
        before: beforeScenario.status,
        delta: null,
        key: "status",
        label: beforeScenario.scenario,
      });
      continue;
    }

    for (const key of options.keys) {
      checkCounter(
        failures,
        beforeScenario.scenario,
        key,
        beforeScenario.summary?.[key],
        afterScenario.summary?.[key],
        options,
      );
    }
  }
}

function findScenario(report, required) {
  return report.scenarios.find((scenario) =>
    required.includes(":") ? scenarioKey(scenario) === required : scenario.scenario === required,
  );
}

function checkRequiredScenarios(before, after, options, failures) {
  for (const required of options.requiredScenarios) {
    for (const [label, report] of [
      ["before", before],
      ["after", after],
    ]) {
      const scenario = findScenario(report, required);
      if (scenario?.status === "ok") {
        continue;
      }

      failures.push({
        after: scenario?.status ?? "missing",
        before: "ok",
        delta: null,
        key: `${label} required scenario`,
        label: required,
      });
    }
  }
}

function printComparison(before, after, options, failures) {
  const beforeTarget = `${before.target?.specifier ?? "unknown"}@${before.target?.version ?? "?"}`;
  const afterTarget = `${after.target?.specifier ?? "unknown"}@${after.target?.version ?? "?"}`;

  console.log(
    `Compared ${beforeTarget} -> ${afterTarget} (${options.mode}, scope=${options.scope}, tolerance=${options.tolerance})`,
  );

  if (failures.length === 0) {
    console.log("Structural counter gate passed.");
    return;
  }

  console.error("Structural counter gate failed:");
  for (const failure of failures) {
    const delta =
      typeof failure.delta === "number"
        ? ` (${failure.delta >= 0 ? "+" : ""}${failure.delta})`
        : "";
    console.error(
      `- ${failure.label}: ${failure.key} ${failure.before} -> ${failure.after}${delta}`,
    );
  }
}

const { afterPath, beforePath, options: parsedOptions } = parseArgs(args);
const options = {
  ...parsedOptions,
  requiredScenarios: await requiredScenarios(parsedOptions),
};
const before = singleReport(await readSummary(beforePath), options.beforeIndex, "before");
const after = singleReport(await readSummary(afterPath), options.afterIndex, "after");
const failures = [];

checkRequiredScenarios(before, after, options, failures);

if (options.scope === "totals" || options.scope === "both") {
  compareTotals(before, after, options, failures);
}

if (options.scope === "scenarios" || options.scope === "both") {
  compareScenarios(before, after, options, failures);
}

printComparison(before, after, options, failures);

if (failures.length > 0) {
  process.exitCode = 1;
}
