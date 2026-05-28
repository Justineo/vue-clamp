#!/usr/bin/env node

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "../../..");
const args = process.argv.slice(2);
const normalizedArgs = args[0] === "--" ? args.slice(1) : args;

function parseArgs(rawArgs) {
  const positional = [];
  const versions = [];

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];

    if (arg === "--versions" || arg === "--include-versions") {
      const value = rawArgs[index + 1];
      if (!value) {
        throw new Error(`${arg} expects a comma-separated version list`);
      }

      versions.push(
        ...value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      );
      index += 1;
      continue;
    }

    positional.push(arg);
  }

  return { positional, versions };
}

const { positional, versions: requestedVersions } = parseArgs(normalizedArgs);
const logDir = resolve(positional[0] ?? "/tmp/vue-clamp-matrix-sanity");
const outputDir = resolve(workspaceRoot, positional[1] ?? "journey/research");
const reportJsonPath = resolve(outputDir, "310-package-benchmark-matrix.local.json");
const reportMdPath = resolve(outputDir, "310-package-benchmark-matrix.md");
const reportSvgPath = resolve(outputDir, "310-package-benchmark-matrix.svg");
const activeCvLowConfidenceThreshold = 10;
const missingVersionReason =
  "No benchmark payload was provided for this version in the Vue 3 public component matrix.";
const releaseCaveats = new Map([
  [
    "1.0.0>1.1.0",
    [
      "RichLineClamp was added in 1.1.0, so rich scenarios are unsupported in 1.0.0 and excluded from pair deltas.",
      "InlineClamp 1.0 used a native text-overflow implementation, so measured InlineClamp rows start later and 1.0.0 is rendered as N/A for those scenarios.",
      "LineClamp fixed wrapped-line undercount edge cases, so LineClamp deltas may include newly-correct reclamp work.",
    ],
  ],
  [
    "1.1.0>1.2.0",
    [
      "InlineClamp added location handling and fixed meaningful split-boundary spaces; InlineClamp deltas include behavior changes, not only speed changes.",
    ],
  ],
  [
    "1.2.0>1.3.0",
    [
      "Boundary-aware clamping and smoother resizing landed in 1.3.0, so deltas for resize-heavy line, rich, and inline scenarios can include broader invalidation coverage.",
    ],
  ],
  [
    "1.3.0>1.4.0",
    [
      "LineClamp gained a native multiline path for eligible default end-ellipsis cases; LineClamp deltas can reflect an implementation-path change rather than a generic solver change.",
    ],
  ],
  [
    "1.4.0>1.5.0",
    [
      "The benchmark matrix always uses WrapClamp's public item slot, matching the 1.5.0 contract; large WrapClamp changes should be interpreted together with rect-read and slot-call counters.",
    ],
  ],
]);

function formatNumber(value, digits = 1) {
  return typeof value === "number" ? value.toFixed(digits) : "N/A";
}

function formatMs(value, digits = 1) {
  return typeof value === "number" ? `${value.toFixed(digits)}ms` : "N/A";
}

function formatPercent(value) {
  if (typeof value !== "number") {
    return "N/A";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatUnsignedPercent(value) {
  if (typeof value !== "number") {
    return "N/A";
  }

  return `${value.toFixed(1)}%`;
}

function percentDelta(from, to) {
  if (typeof from !== "number" || typeof to !== "number" || from === 0) {
    return null;
  }

  return ((to - from) / from) * 100;
}

function median(values) {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function colorForDelta(delta) {
  if (delta === null) {
    return "#eef1f5";
  }

  if (delta <= -50) {
    return "#0f766e";
  }

  if (delta <= -20) {
    return "#14b8a6";
  }

  if (delta <= -5) {
    return "#99f6e4";
  }

  if (delta < 5) {
    return "#f1f5f9";
  }

  if (delta < 20) {
    return "#fecaca";
  }

  if (delta < 50) {
    return "#f87171";
  }

  return "#dc2626";
}

const workSignalKeys = [
  "medianAfterSlotCalls",
  "medianBeforeSlotCalls",
  "medianBoundingRectReads",
  "medianClientHeightReads",
  "medianClientRectReads",
  "medianClientTopReads",
  "medianClientWidthReads",
  "medianCloneNodeCalls",
  "medianImageCloneCalls",
  "medianItemSlotCalls",
  "medianMutationRecords",
  "medianReplaceChildrenCalls",
  "medianResizeObserverCallbacks",
  "medianScrollWidthReads",
];

function maxWorkSignalDelta(before, after) {
  let maxDelta = 0;

  for (const key of workSignalKeys) {
    const beforeValue = before?.[key];
    const afterValue = after?.[key];
    if (typeof beforeValue !== "number" || typeof afterValue !== "number") {
      continue;
    }

    if (beforeValue === 0 && afterValue === 0) {
      continue;
    }

    if (beforeValue === 0 || afterValue === 0) {
      return Number.POSITIVE_INFINITY;
    }

    maxDelta = Math.max(maxDelta, Math.abs(percentDelta(beforeValue, afterValue) ?? 0));
  }

  return maxDelta;
}

function adjacentTimingSignal(before, after) {
  const delta = percentDelta(before?.medianActiveMs, after?.medianActiveMs);
  if (delta === null || !before || !after) {
    return {
      delta,
      lowConfidence: false,
      lowConfidenceReasons: [],
      workDelta: null,
    };
  }

  const beforeCv = before.sampleCvActiveMs;
  const afterCv = after.sampleCvActiveMs;
  const highStandardDeviation =
    (typeof beforeCv === "number" && beforeCv > activeCvLowConfidenceThreshold) ||
    (typeof afterCv === "number" && afterCv > activeCvLowConfidenceThreshold);
  const workDelta = maxWorkSignalDelta(before, after);
  const lowConfidenceReasons = [];

  if (highStandardDeviation) {
    lowConfidenceReasons.push("high active-time CV");
  }

  return {
    delta,
    lowConfidence: lowConfidenceReasons.length > 0,
    lowConfidenceReasons,
    workDelta,
  };
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isTableRow(line) {
  return line.startsWith("|") && line.endsWith("|");
}

function splitTableRow(line) {
  return line
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorCell(cell) {
  return /^:?-{3,}:?$/.test(cell);
}

function isSeparatorRow(line) {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every(isSeparatorCell);
}

function separatorAlignment(cell) {
  if (cell.startsWith(":") && cell.endsWith(":")) {
    return "center";
  }

  if (cell.endsWith(":")) {
    return "right";
  }

  return "left";
}

function padTableCell(cell, width, alignment) {
  if (alignment === "right") {
    return cell.padStart(width);
  }

  if (alignment === "center") {
    const left = Math.floor((width - cell.length) / 2);
    const right = width - cell.length - left;
    return `${" ".repeat(left)}${cell}${" ".repeat(right)}`;
  }

  return cell.padEnd(width);
}

function separatorCell(width, alignment) {
  if (alignment === "right") {
    return `${"-".repeat(Math.max(width - 1, 3))}:`;
  }

  if (alignment === "center") {
    return `:${"-".repeat(Math.max(width - 2, 3))}:`;
  }

  return "-".repeat(Math.max(width, 3));
}

function formatMarkdownTable(rows) {
  const cells = rows.map(splitTableRow);
  const alignments = cells[1].map(separatorAlignment);
  const widths = cells[0].map((_, columnIndex) =>
    Math.max(
      3,
      ...cells.map((row, rowIndex) => {
        if (rowIndex === 1) {
          return separatorCell(3, alignments[columnIndex]).length;
        }

        return row[columnIndex]?.length ?? 0;
      }),
    ),
  );

  return cells.map((row, rowIndex) => {
    const formattedCells = row.map((cell, columnIndex) => {
      if (rowIndex === 1) {
        return padTableCell(
          separatorCell(widths[columnIndex], alignments[columnIndex]),
          widths[columnIndex],
          alignments[columnIndex],
        );
      }

      return padTableCell(cell, widths[columnIndex], alignments[columnIndex]);
    });

    return `| ${formattedCells.join(" | ")} |`;
  });
}

function formatMarkdownTables(lines) {
  const formatted = [];

  for (let index = 0; index < lines.length; ) {
    if (!isTableRow(lines[index]) || !isTableRow(lines[index + 1] ?? "")) {
      formatted.push(lines[index]);
      index += 1;
      continue;
    }

    if (!isSeparatorRow(lines[index + 1])) {
      formatted.push(lines[index]);
      index += 1;
      continue;
    }

    const tableRows = [lines[index], lines[index + 1]];
    index += 2;

    while (index < lines.length && isTableRow(lines[index])) {
      tableRows.push(lines[index]);
      index += 1;
    }

    formatted.push(...formatMarkdownTable(tableRows));
  }

  return formatted;
}

function stripVitestSummaryNoise(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => {
      if (line.trim() === "") {
        return false;
      }

      return !/^\s*(?:Test Files|Tests|Start at|Duration)\b/.test(line);
    })
    .join("");
}

function extractJsonObject(text) {
  const start = text.indexOf("{");

  if (start === -1) {
    return null;
  }

  let depth = 0;
  let escaped = false;
  let inString = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

async function readReport(file) {
  const text = await readFile(resolve(logDir, file), "utf8");
  const markerMatch = /PACKAGE_(?:MATRIX_)?BENCHMARK /.exec(text);

  if (!markerMatch) {
    throw new Error(`Missing package benchmark payload in ${file}`);
  }

  const payloadText = text.slice(markerMatch.index + markerMatch[0].length);
  const candidates = [payloadText, stripVitestSummaryNoise(payloadText)];

  for (const candidate of candidates) {
    const payload = extractJsonObject(candidate);

    if (!payload) {
      continue;
    }

    try {
      return JSON.parse(payload);
    } catch {
      // Try the next candidate. Vitest can interleave its summary into very long
      // browser console payloads, splitting otherwise valid JSON across lines.
    }
  }

  throw new Error(`Invalid package benchmark payload in ${file}`);
}

const files = (await readdir(logDir)).filter((file) => file.endsWith(".log")).sort();
const loadedReports = await Promise.all(files.map(readReport));
const loadedReportVersions = new Set(loadedReports.map((report) => report.target.version));
const placeholderVersions = requestedVersions
  .filter((version) => !loadedReportVersions.has(version))
  .filter((version, index, all) => all.indexOf(version) === index);
const reports = [
  ...loadedReports,
  ...placeholderVersions.map((version) => ({
    environment: null,
    schemaVersion: 3,
    scenarios: [],
    target: {
      entry: null,
      specifier: `vue-clamp@${version}`,
      unsupportedReason: missingVersionReason,
      version,
    },
  })),
].sort((left, right) =>
  left.target.version.localeCompare(right.target.version, undefined, { numeric: true }),
);
const scenarioIds = [
  ...new Set(reports.flatMap((report) => report.scenarios.map((scenario) => scenario.scenario))),
];
const scenarioMeta = new Map();

for (const report of reports) {
  for (const scenario of report.scenarios) {
    scenarioMeta.set(scenario.scenario, {
      component: scenario.component,
      group: scenario.group,
      scenario: scenario.scenario,
    });
  }
}

for (const report of reports) {
  if (report.scenarios.length > 0) {
    continue;
  }

  report.scenarios = scenarioIds.map((scenarioId) => ({
    ...scenarioMeta.get(scenarioId),
    reason: missingVersionReason,
    status: "unsupported",
  }));
}

const matrix = scenarioIds.map((scenarioId) => {
  const cells = reports.map((report) => {
    const scenario = report.scenarios.find((item) => item.scenario === scenarioId);
    return {
      metrics: scenario?.status === "ok" ? scenario.summary : null,
      reason: scenario?.status === "unsupported" ? scenario.reason : null,
      status: scenario?.status ?? "missing",
      version: report.target.version,
    };
  });

  return {
    ...scenarioMeta.get(scenarioId),
    cells,
  };
});

function summarizeReport(report) {
  const ok = report.scenarios.filter((scenario) => scenario.status === "ok");
  const total = (key) => ok.reduce((sum, scenario) => sum + (scenario.summary[key] ?? 0), 0);
  const activeRmes = ok
    .map((scenario) => scenario.summary.sampleRme95ActiveMs)
    .filter((value) => typeof value === "number");
  const activeCvs = ok
    .map((scenario) => scenario.summary.sampleCvActiveMs)
    .filter((value) => typeof value === "number");
  const sampleCounts = ok
    .map((scenario) => scenario.summary.sampleCount)
    .filter((value) => typeof value === "number");
  const sampleWallTimes = ok
    .map((scenario) => scenario.summary.sampleWallMs)
    .filter((value) => typeof value === "number");
  const totalSampleActiveTimes = ok
    .map((scenario) => scenario.summary.sampleTotalActiveMs)
    .filter((value) => typeof value === "number");

  return {
    activeMs: ok.length > 0 ? total("medianActiveMs") : null,
    maxActiveCv: activeCvs.length > 0 ? Math.max(...activeCvs) : null,
    maxActiveRme95: activeRmes.length > 0 ? Math.max(...activeRmes) : null,
    medianActiveCv: median(activeCvs),
    medianActiveRme95: median(activeRmes),
    medianSampleCount: median(sampleCounts),
    medianSampleWallMs: median(sampleWallTimes),
    medianTotalSampleActiveMs: median(totalSampleActiveTimes),
    itemSlotCalls: ok.length > 0 ? total("medianItemSlotCalls") : null,
    longTaskCount: ok.length > 0 ? total("medianLongTaskCount") : null,
    quietMs: ok.length > 0 ? total("medianQuietMs") : null,
    rectReads: ok.length > 0 ? total("medianBoundingRectReads") : null,
    scenarios: report.scenarios.length,
    settledMs: ok.length > 0 ? total("medianSettledMs") : null,
    supportedScenarios: ok.length,
    version: report.target.version,
  };
}

function cellMetrics(row, version) {
  return row.cells.find((cell) => cell.version === version)?.metrics ?? null;
}

const versionSummaries = reports.map(summarizeReport);
const adjacentPairs = reports.slice(1).map((to, index) => ({
  from: reports[index],
  label: `${reports[index].target.version}>${to.target.version}`,
  to,
}));

function summarizePair(pair) {
  const totals = {
    activeAfter: 0,
    activeBefore: 0,
    itemSlotCallsAfter: 0,
    itemSlotCallsBefore: 0,
    longTaskCountAfter: 0,
    longTaskCountBefore: 0,
    rectReadsAfter: 0,
    rectReadsBefore: 0,
    settledAfter: 0,
    settledBefore: 0,
  };
  let comparableScenarios = 0;

  for (const row of matrix) {
    const before = cellMetrics(row, pair.from.target.version);
    const after = cellMetrics(row, pair.to.target.version);

    if (!before || !after) {
      continue;
    }

    comparableScenarios += 1;
    totals.activeBefore += before.medianActiveMs ?? 0;
    totals.activeAfter += after.medianActiveMs ?? 0;
    totals.settledBefore += before.medianSettledMs ?? 0;
    totals.settledAfter += after.medianSettledMs ?? 0;
    totals.rectReadsBefore += before.medianBoundingRectReads ?? 0;
    totals.rectReadsAfter += after.medianBoundingRectReads ?? 0;
    totals.itemSlotCallsBefore += before.medianItemSlotCalls ?? 0;
    totals.itemSlotCallsAfter += after.medianItemSlotCalls ?? 0;
    totals.longTaskCountBefore += before.medianLongTaskCount ?? 0;
    totals.longTaskCountAfter += after.medianLongTaskCount ?? 0;
  }

  return {
    activeDelta: percentDelta(totals.activeBefore, totals.activeAfter),
    activeMsAfter: comparableScenarios > 0 ? totals.activeAfter : null,
    activeMsBefore: comparableScenarios > 0 ? totals.activeBefore : null,
    comparableScenarios,
    from: pair.from.target.version,
    itemSlotCallsDelta: percentDelta(totals.itemSlotCallsBefore, totals.itemSlotCallsAfter),
    longTaskCountDelta: percentDelta(totals.longTaskCountBefore, totals.longTaskCountAfter),
    rectReadsDelta: percentDelta(totals.rectReadsBefore, totals.rectReadsAfter),
    settledDelta: percentDelta(totals.settledBefore, totals.settledAfter),
    to: pair.to.target.version,
  };
}

function topMoversForPair(pair, limit = 8) {
  return matrix
    .map((row) => {
      const before = cellMetrics(row, pair.from.target.version);
      const after = cellMetrics(row, pair.to.target.version);
      const delta = percentDelta(before?.medianActiveMs, after?.medianActiveMs);

      return { after, before, delta, row };
    })
    .filter((item) => item.delta !== null)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, limit);
}

const adjacentSummaries = adjacentPairs.map(summarizePair);

await mkdir(outputDir, { recursive: true });
await writeFile(
  reportJsonPath,
  `${JSON.stringify(
    {
      generatedFrom: logDir,
      reports: reports.map((report) => ({
        environment: report.environment,
        schemaVersion: report.schemaVersion,
        target: report.target,
      })),
      adjacentSummaries,
      scenarios: matrix,
      versionSummaries,
    },
    null,
    2,
  )}\n`,
);

const markdown = [];
markdown.push("# Package benchmark matrix");
markdown.push("");
markdown.push(
  "This report compares the public component benchmark matrix across package versions. The primary timing signal is `active ms`; `settled ms` preserves the end-to-end quiet-frame timing, counters explain whether a change came from layout reads, DOM cloning/replacement, or slot rendering, and sample CV / RME report active timing variance.",
);
markdown.push("");
markdown.push(`Generated from \`${logDir}\`.`);
if (placeholderVersions.length > 0) {
  markdown.push("");
  markdown.push(
    `Versions without a benchmark payload are rendered as \`N/A\`: ${placeholderVersions
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
      .join(", ")}.`,
  );
}
markdown.push("");
markdown.push("## Version summary");
markdown.push("");
markdown.push(
  "| Version | Scenarios | Samples | Sample wall ms | Sample active ms | Median active CV | Max active CV | Median active RME | Max active RME | Active ms | Settled ms | Quiet ms | Rect reads | Item slot calls | Long tasks |",
);
markdown.push(
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
);

for (const summary of versionSummaries) {
  markdown.push(
    `| ${summary.version} | ${summary.supportedScenarios}/${summary.scenarios} | ${formatNumber(
      summary.medianSampleCount,
      0,
    )} | ${formatNumber(summary.medianSampleWallMs)} | ${formatNumber(
      summary.medianTotalSampleActiveMs,
    )} | ${formatUnsignedPercent(summary.medianActiveCv)} | ${formatUnsignedPercent(
      summary.maxActiveCv,
    )} | ${formatUnsignedPercent(summary.medianActiveRme95)} | ${formatUnsignedPercent(
      summary.maxActiveRme95,
    )} | ${formatNumber(
      summary.activeMs,
    )} | ${formatNumber(summary.settledMs)} | ${formatNumber(summary.quietMs)} | ${formatNumber(
      summary.rectReads,
      0,
    )} | ${formatNumber(summary.itemSlotCalls, 0)} | ${formatNumber(summary.longTaskCount, 0)} |`,
  );
}

if (adjacentSummaries.length > 0) {
  markdown.push("");
  markdown.push("## Adjacent release summary");
  markdown.push("");
  markdown.push(
    "| From | To | Comparable scenarios | Active delta | Active ms | Rect delta | Slot delta | Settled delta | Long task delta |",
  );
  markdown.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");

  for (const summary of adjacentSummaries) {
    markdown.push(
      `| ${summary.from} | ${summary.to} | ${summary.comparableScenarios}/${matrix.length} | ${formatPercent(
        summary.activeDelta,
      )} | ${formatNumber(summary.activeMsBefore)} -> ${formatNumber(
        summary.activeMsAfter,
      )} | ${formatPercent(summary.rectReadsDelta)} | ${formatPercent(
        summary.itemSlotCallsDelta,
      )} | ${formatPercent(summary.settledDelta)} | ${formatPercent(summary.longTaskCountDelta)} |`,
    );
  }
}

markdown.push("");
markdown.push("## Active time matrix");
markdown.push("");
markdown.push(
  "| Component | Scenario | " + reports.map((report) => report.target.version).join(" | ") + " |",
);
markdown.push("| --- | --- | " + reports.map(() => "---:").join(" | ") + " |");

for (const row of matrix) {
  markdown.push(
    `| ${row.component} | ${row.scenario} | ${reports
      .map((report) => formatNumber(cellMetrics(row, report.target.version)?.medianActiveMs))
      .join(" | ")} |`,
  );
}

if (adjacentPairs.length > 0) {
  markdown.push("");
  markdown.push("## Adjacent active delta matrix");
  markdown.push("");
  markdown.push(
    "| Component | Scenario | " +
      adjacentPairs
        .map((pair) => `${pair.from.target.version} -> ${pair.to.target.version}`)
        .join(" | ") +
      " |",
  );
  markdown.push("| --- | --- | " + adjacentPairs.map(() => "---:").join(" | ") + " |");

  for (const row of matrix) {
    markdown.push(
      `| ${row.component} | ${row.scenario} | ${adjacentPairs
        .map((pair) => {
          const before = cellMetrics(row, pair.from.target.version);
          const after = cellMetrics(row, pair.to.target.version);
          const timingSignal = before && after ? adjacentTimingSignal(before, after) : null;
          const delta = timingSignal?.delta ?? null;
          return timingSignal?.lowConfidence ? `~${formatPercent(delta)}` : formatPercent(delta);
        })
        .join(" | ")} |`,
    );
  }

  markdown.push("");
  markdown.push("## Correctness and comparability notes");
  markdown.push("");
  markdown.push(
    "A faster older version is not automatically a performance win. When a release added missing reclamp coverage or fixed incorrect output, the extra work is correctness cost and the scenario should be interpreted with that caveat.",
  );

  for (const pair of adjacentPairs) {
    const caveats = releaseCaveats.get(pair.label);
    if (!caveats) {
      continue;
    }

    markdown.push("");
    markdown.push(`### ${pair.from.target.version} -> ${pair.to.target.version}`);
    markdown.push("");

    for (const caveat of caveats) {
      markdown.push(`- ${caveat}`);
    }
  }

  markdown.push("");
  markdown.push("## Top movers by adjacent release");

  for (const pair of adjacentPairs) {
    const movers = topMoversForPair(pair);
    if (movers.length === 0) {
      continue;
    }

    markdown.push("");
    markdown.push(`### ${pair.from.target.version} -> ${pair.to.target.version}`);
    markdown.push("");
    markdown.push(
      "| Component | Scenario | Active delta | Active ms | Active RME | Confidence | Rect delta | Slot delta | Settled delta |",
    );
    markdown.push("| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |");

    for (const { after, before, delta, row } of movers) {
      const timingSignal = adjacentTimingSignal(before, after);
      markdown.push(
        `| ${row.component} | ${row.scenario} | ${
          timingSignal.lowConfidence ? `~${formatPercent(delta)}` : formatPercent(delta)
        } | ${formatNumber(
          before.medianActiveMs,
        )} -> ${formatNumber(after.medianActiveMs)} | ${formatUnsignedPercent(
          before.sampleRme95ActiveMs,
        )} -> ${formatUnsignedPercent(after.sampleRme95ActiveMs)} | ${
          timingSignal.lowConfidence
            ? `low (${timingSignal.lowConfidenceReasons.join("; ")})`
            : "normal"
        } | ${formatPercent(
          percentDelta(before.medianBoundingRectReads, after.medianBoundingRectReads),
        )} | ${formatPercent(
          percentDelta(before.medianItemSlotCalls, after.medianItemSlotCalls),
        )} | ${formatPercent(percentDelta(before.medianSettledMs, after.medianSettledMs))} |`,
      );
    }
  }
}

markdown.push("");
markdown.push("## Visualization");
markdown.push("");
markdown.push(
  "The SVG contains two panels: absolute active time by version and adjacent active-time delta by release pair.",
);
markdown.push("");
markdown.push(
  `\`~\` marks a low-confidence delta: at least one side has active-time CV above ${activeCvLowConfidenceThreshold}%. SVG cells keep the normal direction color and add a top-right triangle marker.`,
);
markdown.push("");
markdown.push("![Package benchmark matrix](310-package-benchmark-matrix.svg)");
await writeFile(reportMdPath, `${formatMarkdownTables(markdown).join("\n")}\n`);

const cellWidth = 92;
const rowHeight = 22;
const scenarioColumnWidth = Math.max(
  300,
  ...matrix.map((row) => Math.ceil(String(row.scenario).length * 6.2)),
);
const left = 112 + scenarioColumnWidth;
const absolutePanelTop = 172;
const panelHeight = matrix.length * rowHeight;
const panelGap = 90;
const adjacentPanelTop = absolutePanelTop + panelHeight + panelGap;
const versionWidth = left + reports.length * cellWidth + 56;
const adjacentWidth = left + adjacentPairs.length * cellWidth + 56;
const width = Math.max(versionWidth, adjacentWidth, 1040);
const height = adjacentPanelTop + panelHeight + 80;
const svg = [];
svg.push(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
);
svg.push('<title id="title">vue-clamp package benchmark matrix</title>');
svg.push(
  '<desc id="desc">Full package benchmark matrix with active time by version and adjacent release deltas.</desc>',
);
svg.push("<style>");
svg.push(
  'text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;fill:#172033}.title{font-size:20px;font-weight:700}.panelTitle{font-size:15px;font-weight:700}.axis{font-size:12px;fill:#526070}.scenario{font-size:11px}.cellValue{font-size:10px}.cell{stroke:#fff;stroke-width:1}.group{font-size:11px;font-weight:700;fill:#334155}',
);
svg.push("</style>");
svg.push('<rect width="100%" height="100%" fill="#ffffff"/>');
svg.push('<text class="title" x="32" y="34">Package benchmark matrix</text>');
svg.push(
  '<text class="axis" x="32" y="56">All published versions are shown. N/A means the version or scenario has no Vue 3 public-matrix payload.</text>',
);
svg.push(
  '<text class="axis" x="32" y="74">Green is lower cost, red is higher cost. The first panel shows active ms; the second shows adjacent release deltas.</text>',
);
svg.push(
  '<text class="axis" x="32" y="92">Some adjacent deltas include correctness fixes that added missing reclamp work; see Markdown comparability notes.</text>',
);
svg.push(
  `<text class="axis" x="32" y="110">~ and a top-right triangle mark low-confidence deltas; active-time CV above ${activeCvLowConfidenceThreshold}% is the trigger.</text>`,
);

function drawMatrixPanel({ cellForColumn, columns, description, title, top }) {
  svg.push(`<text class="panelTitle" x="32" y="${top - 44}">${escapeXml(title)}</text>`);
  svg.push(`<text class="axis" x="32" y="${top - 26}">${escapeXml(description)}</text>`);

  columns.forEach((column, index) => {
    svg.push(
      `<text class="axis" x="${left + index * cellWidth + cellWidth / 2}" y="${top - 8}" text-anchor="middle">${escapeXml(
        column.label,
      )}</text>`,
    );
  });

  let previousGroup = "";
  matrix.forEach((row, rowIndex) => {
    const y = top + rowIndex * rowHeight;
    if (row.group !== previousGroup) {
      svg.push(
        `<text class="group" x="32" y="${y + 14}">${escapeXml(String(row.group).toUpperCase())}</text>`,
      );
      previousGroup = row.group;
    }
    svg.push(`<text class="scenario" x="112" y="${y + 14}">${escapeXml(row.scenario)}</text>`);

    columns.forEach((column, columnIndex) => {
      const cell = cellForColumn(row, column);
      const x = left + columnIndex * cellWidth;

      svg.push(
        `<rect class="cell" x="${x}" y="${y}" width="${cellWidth}" height="${rowHeight}" fill="${cell.fill}"><title>${escapeXml(
          cell.title,
        )}</title></rect>`,
      );
      if (cell.cornerMarker) {
        svg.push(
          `<polygon points="${x + cellWidth - 10},${y + 1} ${x + cellWidth - 1},${y + 1} ${x + cellWidth - 1},${y + 10}" fill="#111827" opacity="0.78"><title>${escapeXml(
            cell.cornerMarker,
          )}</title></polygon>`,
        );
      }
      svg.push(
        `<text class="cellValue" x="${x + cellWidth / 2}" y="${y + 14}" text-anchor="middle">${escapeXml(
          cell.text,
        )}</text>`,
      );
    });
  });
}

drawMatrixPanel({
  cellForColumn(row, column) {
    const metrics = cellMetrics(row, column.version);
    const value = metrics?.medianActiveMs;
    const baseline = row.cells.find((cell) => cell.metrics)?.metrics?.medianActiveMs;
    const delta = percentDelta(baseline, value);

    return {
      fill: metrics ? colorForDelta(delta) : "#e5e7eb",
      text: value === undefined ? "N/A" : formatNumber(value, 0),
      title:
        value === undefined
          ? `${column.version} ${row.scenario}: N/A${
              row.cells.find((cell) => cell.version === column.version)?.reason
                ? `, ${row.cells.find((cell) => cell.version === column.version)?.reason}`
                : ""
            }`
          : `${column.version} ${row.scenario}: active ${formatMs(
              value,
            )}, delta ${formatPercent(delta)}, active RME ${formatUnsignedPercent(
              metrics.sampleRme95ActiveMs,
            )}, active CV ${formatUnsignedPercent(metrics.sampleCvActiveMs)}, active stddev ${formatMs(
              metrics.sampleStdDevActiveMs,
            )}, mean active MOE ${formatMs(metrics.sampleMoe95MeanActiveMs)}, total sampled active ${formatMs(
              metrics.sampleTotalActiveMs,
            )}, sample wall ${formatMs(metrics.sampleWallMs)}, samples ${metrics.sampleCount ?? "N/A"}`,
    };
  },
  columns: reports.map((report) => ({
    label: report.target.version,
    version: report.target.version,
  })),
  description:
    "Cell text is median active ms; color is delta vs this scenario's first supported version.",
  title: "Active time by version",
  top: absolutePanelTop,
});

drawMatrixPanel({
  cellForColumn(row, column) {
    const before = cellMetrics(row, column.pair.from.target.version);
    const after = cellMetrics(row, column.pair.to.target.version);
    const { delta, lowConfidence, lowConfidenceReasons, workDelta } = adjacentTimingSignal(
      before,
      after,
    );

    return {
      cornerMarker: lowConfidence ? `Low confidence: ${lowConfidenceReasons.join("; ")}` : null,
      fill: before && after ? colorForDelta(delta) : "#e5e7eb",
      text: delta === null ? "N/A" : `${lowConfidence ? "~" : ""}${formatPercent(delta)}`,
      title: `${column.pair.from.target.version} > ${column.pair.to.target.version} ${
        row.scenario
      }: active ${formatMs(before?.medianActiveMs)} -> ${formatMs(
        after?.medianActiveMs,
      )}, delta ${formatPercent(delta)}${
        lowConfidence
          ? `, low confidence: ${lowConfidenceReasons.join("; ")}`
          : typeof workDelta === "number"
            ? `, max work-counter delta ${formatPercent(workDelta)}`
            : ""
      }`,
    };
  },
  columns: adjacentPairs.map((pair) => ({
    label: pair.label,
    pair,
  })),
  description: "Cell text is active-time delta between adjacent versions for the same scenario.",
  title: "Adjacent release deltas",
  top: adjacentPanelTop,
});

svg.push(
  `<text class="axis" x="32" y="${height - 24}">Generated from ${escapeXml(logDir)} by ${escapeXml(basename(import.meta.url))}</text>`,
);
svg.push("</svg>");
await writeFile(reportSvgPath, `${svg.join("\n")}\n`);

console.log(`Wrote ${reportMdPath.replace(`${workspaceRoot}/`, "")}`);
console.log(`Wrote ${reportSvgPath.replace(`${workspaceRoot}/`, "")}`);
console.log(`Wrote ${reportJsonPath.replace(`${workspaceRoot}/`, "")}`);
