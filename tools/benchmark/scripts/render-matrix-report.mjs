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
const activeHotspotRmeThreshold = 5;
const largeWidthDeltaThreshold = 32;
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

function offsetReads(metrics) {
  if (!metrics) {
    return null;
  }

  const height = metrics.medianOffsetHeightReads;
  const width = metrics.medianOffsetWidthReads;
  if (typeof height !== "number" && typeof width !== "number") {
    return null;
  }

  return (height ?? 0) + (width ?? 0);
}

function counterTrackingEnabled(report) {
  return report.environment?.counterTracking !== false;
}

function counterTrackingLabel(report) {
  if (report.environment === null) {
    return "N/A";
  }

  return counterTrackingEnabled(report) ? "on" : "off";
}

function pairCounterTrackingEnabled(pair) {
  return counterTrackingEnabled(pair.from.report) && counterTrackingEnabled(pair.to.report);
}

function formatPairCounterDelta(pair, before, after, key) {
  if (!pairCounterTrackingEnabled(pair)) {
    return "N/A";
  }

  return formatPercent(percentDelta(before?.[key], after?.[key]));
}

function formatPairOffsetDelta(pair, before, after) {
  if (!pairCounterTrackingEnabled(pair)) {
    return "N/A";
  }

  return formatPercent(percentDelta(offsetReads(before), offsetReads(after)));
}

function formatCounterValue(tracksCounters, value) {
  return tracksCounters ? formatNumber(value, 0) : "N/A";
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
  "medianAddedNodes",
  "medianAfterSlotCalls",
  "medianAttributeMutationRecords",
  "medianBeforeSlotCalls",
  "medianBoundingRectReads",
  "medianCharacterDataMutationRecords",
  "medianChildListMutationRecords",
  "medianClientHeightReads",
  "medianClientRectEntries",
  "medianClientRectReads",
  "medianClientTopReads",
  "medianClientWidthReads",
  "medianCloneNodeCalls",
  "medianImageCloneCalls",
  "medianItemSlotCalls",
  "medianMutationRecords",
  "medianOffsetHeightReads",
  "medianOffsetWidthReads",
  "medianReplaceChildrenCalls",
  "medianRemovedNodes",
  "medianResizeObserverCallbacks",
  "medianScrollWidthReads",
  "medianStyleReads",
];

const structuralSignalDefinitions = [
  ["BBox reads", "medianBoundingRectReads"],
  ["Client rects", "medianClientRectReads"],
  ["Client rect entries", "medianClientRectEntries"],
  ["Mutation records", "medianMutationRecords"],
  ["Child-list mutation records", "medianChildListMutationRecords"],
  ["Character-data mutation records", "medianCharacterDataMutationRecords"],
  ["Attribute mutation records", "medianAttributeMutationRecords"],
  ["Added nodes", "medianAddedNodes"],
  ["Removed nodes", "medianRemovedNodes"],
  ["Offset height reads", "medianOffsetHeightReads"],
  ["Offset width reads", "medianOffsetWidthReads"],
  ["Client height reads", "medianClientHeightReads"],
  ["Client top reads", "medianClientTopReads"],
  ["Client width reads", "medianClientWidthReads"],
  ["Scroll width reads", "medianScrollWidthReads"],
  ["Before slot calls", "medianBeforeSlotCalls"],
  ["After slot calls", "medianAfterSlotCalls"],
  ["Item slot calls", "medianItemSlotCalls"],
  ["Clone node calls", "medianCloneNodeCalls"],
  ["Image clone calls", "medianImageCloneCalls"],
  ["Replace children calls", "medianReplaceChildrenCalls"],
  ["ResizeObserver callbacks", "medianResizeObserverCallbacks"],
  ["Style reads", "medianStyleReads"],
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
  const beforeMean = before.sampleMeanActiveMs;
  const afterMean = after.sampleMeanActiveMs;
  const beforeMoe = before.sampleMoe95ActiveMs;
  const afterMoe = after.sampleMoe95ActiveMs;
  const meanDelta = percentDelta(beforeMean, afterMean);
  const highStandardDeviation =
    (typeof beforeCv === "number" && beforeCv > activeCvLowConfidenceThreshold) ||
    (typeof afterCv === "number" && afterCv > activeCvLowConfidenceThreshold);
  const overlappingMeanMarginOfError =
    typeof beforeMean === "number" &&
    typeof afterMean === "number" &&
    typeof beforeMoe === "number" &&
    typeof afterMoe === "number" &&
    beforeMean - beforeMoe <= afterMean + afterMoe &&
    afterMean - afterMoe <= beforeMean + beforeMoe;
  const mixedMedianMeanDirection =
    typeof meanDelta === "number" && Math.sign(delta) !== 0 && Math.sign(meanDelta) !== 0
      ? Math.sign(delta) !== Math.sign(meanDelta)
      : false;
  const workDelta = maxWorkSignalDelta(before, after);
  const lowConfidenceReasons = [];

  if (highStandardDeviation) {
    lowConfidenceReasons.push("high active-time CV");
  }

  if (overlappingMeanMarginOfError) {
    lowConfidenceReasons.push("overlapping active-time mean MOE");
  }

  if (mixedMedianMeanDirection) {
    lowConfidenceReasons.push("median/mean active-time direction mismatch");
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

function finalBenchmarkPayloadText(text) {
  let markerMatch = null;

  for (const match of text.matchAll(/PACKAGE_(?:MATRIX_)?BENCHMARK /g)) {
    markerMatch = match;
  }

  return markerMatch ? text.slice(markerMatch.index + markerMatch[0].length) : null;
}

function compactTargetSpecifier(specifier) {
  if (!specifier) {
    return "unknown";
  }

  if (specifier.startsWith("/") || specifier.startsWith(".")) {
    return basename(specifier);
  }

  return specifier;
}

function reportColumnBaseLabel(report, versionCounts) {
  const { specifier, version } = report.target;

  if (specifier === "current") {
    return "current";
  }

  if (versionCounts.get(version) === 1 || specifier === `vue-clamp@${version}`) {
    return version;
  }

  return `${version} ${compactTargetSpecifier(specifier)}`;
}

function labeledReportColumns(nextReports) {
  const versionCounts = new Map();
  for (const report of nextReports) {
    const version = report.target.version;
    versionCounts.set(version, (versionCounts.get(version) ?? 0) + 1);
  }

  const labelCounts = new Map();
  return nextReports.map((report, index) => {
    const version = report.target.version;
    const baseLabel = reportColumnBaseLabel(report, versionCounts);
    const labelCount = (labelCounts.get(baseLabel) ?? 0) + 1;
    labelCounts.set(baseLabel, labelCount);

    return {
      key: `${version}#${index}`,
      label: labelCount === 1 ? baseLabel : `${baseLabel} #${labelCount}`,
      report,
    };
  });
}

async function readReports(file) {
  const text = await readFile(resolve(logDir, file), "utf8");
  const payloadText = finalBenchmarkPayloadText(text);

  if (payloadText === null) {
    console.warn(`Skipping ${file}: no PACKAGE_MATRIX_BENCHMARK marker found.`);
    return [];
  }

  const candidates = [payloadText, stripVitestSummaryNoise(payloadText)];

  for (const candidate of candidates) {
    const payload = extractJsonObject(candidate);

    if (!payload) {
      continue;
    }

    try {
      const report = JSON.parse(payload);

      return Array.isArray(report.reports) ? report.reports : [report];
    } catch {
      // Try the next candidate. Vitest can interleave its summary into very long
      // browser console payloads, splitting otherwise valid JSON across lines.
    }
  }

  throw new Error(`Invalid package benchmark payload in ${file}`);
}

const files = (await readdir(logDir)).filter((file) => file.endsWith(".log")).sort();
const loadedReports = (await Promise.all(files.map(readReports))).flat();
if (files.length > 0 && loadedReports.length === 0) {
  throw new Error(`No package benchmark payload was found in ${logDir}`);
}
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
const reportColumns = labeledReportColumns(reports);
const reportColumnByReport = new Map(reportColumns.map((column) => [column.report, column]));
const scenarioIds = [
  ...new Set(reports.flatMap((report) => report.scenarios.map((scenario) => scenario.scenario))),
];
const scenarioMeta = new Map();

for (const report of reports) {
  for (const scenario of report.scenarios) {
    const previous = scenarioMeta.get(scenario.scenario);
    scenarioMeta.set(scenario.scenario, {
      component: scenario.component,
      group: scenario.group,
      scenario: scenario.scenario,
      widthProfile: previous?.widthProfile ?? scenario.widthProfile ?? null,
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
    const column = reportColumnByReport.get(report);
    return {
      key: column.key,
      label: column.label,
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

function summarizeReport(column) {
  const { label, report } = column;
  const ok = report.scenarios.filter((scenario) => scenario.status === "ok");
  const tracksCounters = counterTrackingEnabled(report);
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
  const offsetReadTotals = ok
    .map((scenario) => offsetReads(scenario.summary))
    .filter((value) => typeof value === "number");

  return {
    activeMs: ok.length > 0 ? total("medianActiveMs") : null,
    counterTracking: counterTrackingLabel(report),
    maxActiveCv: activeCvs.length > 0 ? Math.max(...activeCvs) : null,
    maxActiveRme95: activeRmes.length > 0 ? Math.max(...activeRmes) : null,
    medianActiveCv: median(activeCvs),
    medianActiveRme95: median(activeRmes),
    medianSampleCount: median(sampleCounts),
    medianSampleWallMs: median(sampleWallTimes),
    medianTotalSampleActiveMs: median(totalSampleActiveTimes),
    itemSlotCalls: tracksCounters && ok.length > 0 ? total("medianItemSlotCalls") : null,
    longTaskCount: ok.length > 0 ? total("medianLongTaskCount") : null,
    mutationRecords: tracksCounters && ok.length > 0 ? total("medianMutationRecords") : null,
    offsetReads:
      tracksCounters && offsetReadTotals.length > 0
        ? offsetReadTotals.reduce((sum, value) => sum + value, 0)
        : null,
    quietMs: ok.length > 0 ? total("medianQuietMs") : null,
    bboxReads: tracksCounters && ok.length > 0 ? total("medianBoundingRectReads") : null,
    clientRectEntries: tracksCounters && ok.length > 0 ? total("medianClientRectEntries") : null,
    clientRectReads: tracksCounters && ok.length > 0 ? total("medianClientRectReads") : null,
    scenarios: report.scenarios.length,
    settledMs: ok.length > 0 ? total("medianSettledMs") : null,
    styleReads: tracksCounters && ok.length > 0 ? total("medianStyleReads") : null,
    supportedScenarios: ok.length,
    version: label,
  };
}

function cellForKey(row, key) {
  return row.cells.find((cell) => cell.key === key) ?? null;
}

function cellMetrics(row, key) {
  return cellForKey(row, key)?.metrics ?? null;
}

const versionSummaries = reportColumns.map(summarizeReport);
const adjacentPairs = reportColumns.slice(1).map((to, index) => ({
  from: reportColumns[index],
  label: `${reportColumns[index].label}>${to.label}`,
  to,
}));

function summarizePair(pair) {
  const tracksCounters = pairCounterTrackingEnabled(pair);
  const totals = {
    activeAfter: 0,
    activeBefore: 0,
    bboxReadsAfter: 0,
    bboxReadsBefore: 0,
    clientRectReadsAfter: 0,
    clientRectReadsBefore: 0,
    clientRectEntriesAfter: 0,
    clientRectEntriesBefore: 0,
    itemSlotCallsAfter: 0,
    itemSlotCallsBefore: 0,
    longTaskCountAfter: 0,
    longTaskCountBefore: 0,
    mutationRecordsAfter: 0,
    mutationRecordsBefore: 0,
    offsetReadsAfter: 0,
    offsetReadsBefore: 0,
    settledAfter: 0,
    settledBefore: 0,
    styleReadsAfter: 0,
    styleReadsBefore: 0,
  };
  let comparableScenarios = 0;
  let lowConfidenceScenarios = 0;

  for (const row of matrix) {
    const before = cellMetrics(row, pair.from.key);
    const after = cellMetrics(row, pair.to.key);

    if (!before || !after) {
      continue;
    }

    comparableScenarios += 1;
    if (adjacentTimingSignal(before, after).lowConfidence) {
      lowConfidenceScenarios += 1;
    }

    totals.activeBefore += before.medianActiveMs ?? 0;
    totals.activeAfter += after.medianActiveMs ?? 0;
    totals.settledBefore += before.medianSettledMs ?? 0;
    totals.settledAfter += after.medianSettledMs ?? 0;
    totals.bboxReadsBefore += before.medianBoundingRectReads ?? 0;
    totals.bboxReadsAfter += after.medianBoundingRectReads ?? 0;
    totals.clientRectReadsBefore += before.medianClientRectReads ?? 0;
    totals.clientRectReadsAfter += after.medianClientRectReads ?? 0;
    totals.clientRectEntriesBefore += before.medianClientRectEntries ?? 0;
    totals.clientRectEntriesAfter += after.medianClientRectEntries ?? 0;
    totals.offsetReadsBefore += offsetReads(before) ?? 0;
    totals.offsetReadsAfter += offsetReads(after) ?? 0;
    totals.itemSlotCallsBefore += before.medianItemSlotCalls ?? 0;
    totals.itemSlotCallsAfter += after.medianItemSlotCalls ?? 0;
    totals.longTaskCountBefore += before.medianLongTaskCount ?? 0;
    totals.longTaskCountAfter += after.medianLongTaskCount ?? 0;
    totals.mutationRecordsBefore += before.medianMutationRecords ?? 0;
    totals.mutationRecordsAfter += after.medianMutationRecords ?? 0;
    totals.styleReadsBefore += before.medianStyleReads ?? 0;
    totals.styleReadsAfter += after.medianStyleReads ?? 0;
  }

  return {
    activeDelta: percentDelta(totals.activeBefore, totals.activeAfter),
    activeMsAfter: comparableScenarios > 0 ? totals.activeAfter : null,
    activeMsBefore: comparableScenarios > 0 ? totals.activeBefore : null,
    bboxReadsDelta: tracksCounters
      ? percentDelta(totals.bboxReadsBefore, totals.bboxReadsAfter)
      : null,
    clientRectEntriesDelta: tracksCounters
      ? percentDelta(totals.clientRectEntriesBefore, totals.clientRectEntriesAfter)
      : null,
    clientRectReadsDelta: tracksCounters
      ? percentDelta(totals.clientRectReadsBefore, totals.clientRectReadsAfter)
      : null,
    comparableScenarios,
    from: pair.from.label,
    itemSlotCallsDelta: tracksCounters
      ? percentDelta(totals.itemSlotCallsBefore, totals.itemSlotCallsAfter)
      : null,
    longTaskCountDelta: percentDelta(totals.longTaskCountBefore, totals.longTaskCountAfter),
    lowConfidenceScenarios,
    mutationRecordsDelta: tracksCounters
      ? percentDelta(totals.mutationRecordsBefore, totals.mutationRecordsAfter)
      : null,
    offsetReadsDelta: tracksCounters
      ? percentDelta(totals.offsetReadsBefore, totals.offsetReadsAfter)
      : null,
    settledDelta: percentDelta(totals.settledBefore, totals.settledAfter),
    styleReadsDelta: tracksCounters
      ? percentDelta(totals.styleReadsBefore, totals.styleReadsAfter)
      : null,
    to: pair.to.label,
  };
}

function topMoversForPair(pair, limit = 8) {
  return matrix
    .map((row) => {
      const before = cellMetrics(row, pair.from.key);
      const after = cellMetrics(row, pair.to.key);
      const delta = percentDelta(before?.medianActiveMs, after?.medianActiveMs);

      return { after, before, delta, row };
    })
    .filter((item) => item.delta !== null)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, limit);
}

function structuralChangeScore(beforeValue, afterValue) {
  if (typeof beforeValue !== "number" || typeof afterValue !== "number") {
    return null;
  }

  if (beforeValue === afterValue) {
    return null;
  }

  if (beforeValue === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(percentDelta(beforeValue, afterValue) ?? 0);
}

function topStructuralMoversForPair(pair, limit = 12) {
  if (!pairCounterTrackingEnabled(pair)) {
    return [];
  }

  const movers = [];

  for (const row of matrix) {
    const before = cellMetrics(row, pair.from.key);
    const after = cellMetrics(row, pair.to.key);
    if (!before || !after) {
      continue;
    }

    for (const [signal, key] of structuralSignalDefinitions) {
      const beforeValue = before[key];
      const afterValue = after[key];
      const score = structuralChangeScore(beforeValue, afterValue);

      if (score === null) {
        continue;
      }

      movers.push({
        activeDelta: percentDelta(before.medianActiveMs, after.medianActiveMs),
        after,
        afterValue,
        before,
        beforeValue,
        delta: percentDelta(beforeValue, afterValue),
        row,
        score,
        signal,
      });
    }
  }

  return movers.sort((left, right) => right.score - left.score).slice(0, limit);
}

function structuralHotspotsForRow(row, column) {
  const metrics = cellMetrics(row, column.key);
  if (!metrics) {
    return [];
  }

  const hotspots = [];

  for (const [signal, key] of structuralSignalDefinitions) {
    const value = metrics[key];
    if (typeof value !== "number" || value <= 0) {
      continue;
    }

    hotspots.push({
      activeMs: metrics.medianActiveMs,
      activeRme: metrics.sampleRme95ActiveMs,
      component: row.component,
      group: row.group,
      scenario: row.scenario,
      signal,
      value,
    });
  }

  return hotspots;
}

function topStructuralHotspotsForColumn(column, limit = 12) {
  if (!counterTrackingEnabled(column.report)) {
    return [];
  }

  const hotspots = matrix.flatMap((row) => structuralHotspotsForRow(row, column));

  return hotspots.sort((left, right) => right.value - left.value).slice(0, limit);
}

function topStructuralHotspotsByComponentForColumn(column, limit = 5) {
  if (!counterTrackingEnabled(column.report)) {
    return [];
  }

  const groups = new Map();

  for (const row of matrix) {
    for (const hotspot of structuralHotspotsForRow(row, column)) {
      const hotspots = groups.get(row.component) ?? [];
      hotspots.push(hotspot);
      groups.set(row.component, hotspots);
    }
  }

  return [...groups.entries()]
    .map(([component, hotspots]) => ({
      component,
      hotspots: hotspots.sort((left, right) => right.value - left.value).slice(0, limit),
    }))
    .filter(({ hotspots }) => hotspots.length > 0);
}

function activeHotspotForRow(row, column, tracksCounters) {
  const metrics = cellMetrics(row, column.key);
  const activeMs = metrics?.medianActiveMs;
  const activeRme = metrics?.sampleRme95ActiveMs;
  if (
    typeof activeMs !== "number" ||
    typeof activeRme !== "number" ||
    activeRme > activeHotspotRmeThreshold
  ) {
    return null;
  }

  return {
    activeMs,
    activeRme,
    bboxReads: tracksCounters ? metrics.medianBoundingRectReads : null,
    clientRectEntries: tracksCounters ? metrics.medianClientRectEntries : null,
    component: row.component,
    group: row.group,
    mutationRecords: tracksCounters ? metrics.medianMutationRecords : null,
    offsetReads: tracksCounters ? offsetReads(metrics) : null,
    sampleCount: metrics.sampleCount,
    scenario: row.scenario,
    styleReads: tracksCounters ? metrics.medianStyleReads : null,
  };
}

function topActiveHotspotsForColumn(column, limit = 12) {
  const tracksCounters = counterTrackingEnabled(column.report);
  return matrix
    .map((row) => activeHotspotForRow(row, column, tracksCounters))
    .filter(Boolean)
    .sort((left, right) => right.activeMs - left.activeMs)
    .slice(0, limit);
}

function topActiveHotspotsByComponentForColumn(column, limit = 5) {
  const tracksCounters = counterTrackingEnabled(column.report);
  const groups = new Map();

  for (const row of matrix) {
    const hotspot = activeHotspotForRow(row, column, tracksCounters);
    if (!hotspot) {
      continue;
    }

    const hotspots = groups.get(row.component) ?? [];
    hotspots.push(hotspot);
    groups.set(row.component, hotspots);
  }

  return [...groups.entries()]
    .map(([component, hotspots]) => ({
      component,
      hotspots: hotspots.sort((left, right) => right.activeMs - left.activeMs).slice(0, limit),
    }))
    .filter(({ hotspots }) => hotspots.length > 0);
}

const adjacentSummaries = adjacentPairs.map(summarizePair);
const activeHotspots = reportColumns.map((column) => ({
  hotspots: topActiveHotspotsForColumn(column),
  tracksCounters: counterTrackingEnabled(column.report),
  version: column.label,
}));
const activeHotspotsByComponent = reportColumns.map((column) => ({
  components: topActiveHotspotsByComponentForColumn(column),
  tracksCounters: counterTrackingEnabled(column.report),
  version: column.label,
}));
const structuralHotspots = reportColumns.map((column) => ({
  hotspots: topStructuralHotspotsForColumn(column),
  version: column.label,
}));
const structuralHotspotsByComponent = reportColumns.map((column) => ({
  components: topStructuralHotspotsByComponentForColumn(column),
  version: column.label,
}));
const widthProfileRows = matrix.filter((row) => row.widthProfile);
const widthProfileLargeDeltaThresholds = [
  ...new Set(
    widthProfileRows.map((row) => row.widthProfile.largeDeltaThreshold ?? largeWidthDeltaThreshold),
  ),
].sort((left, right) => left - right);

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
      activeHotspots,
      activeHotspotsByComponent,
      adjacentSummaries,
      scenarios: matrix,
      structuralHotspots,
      structuralHotspotsByComponent,
      versionSummaries,
    },
    null,
    2,
  )}\n`,
);

const markdown = [];
const counterTrackingOffColumns = reportColumns.filter(
  (column) => column.report.environment?.counterTracking === false,
);
markdown.push("# Package benchmark matrix");
markdown.push("");
markdown.push(
  "This report compares the public component benchmark matrix across package versions. The primary timing signal is `active ms`; `settled ms` preserves the end-to-end quiet-frame timing, counters explain whether a change came from layout reads, DOM cloning/replacement, or slot rendering, and sample CV / RME report active timing variance.",
);
markdown.push("");
markdown.push(`Generated from \`${logDir}\`.`);
if (counterTrackingOffColumns.length > 0) {
  markdown.push("");
  markdown.push(
    `Counter tracking was disabled for ${counterTrackingOffColumns
      .map((column) => column.label)
      .join(
        ", ",
      )}. Active timing remains available, but structural counter summaries and deltas for those columns are rendered as \`N/A\`.`,
  );
}
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
  "| Version | Counters | Scenarios | Samples | Sample wall ms | Sample active ms | Median active CV | Max active CV | Median active RME | Max active RME | Active ms | Settled ms | Quiet ms | BBox reads | Client rects | Client rect entries | Mutation records | Offset reads | Style reads | Item slot calls | Long tasks |",
);
markdown.push(
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
);

for (const summary of versionSummaries) {
  markdown.push(
    `| ${summary.version} | ${summary.counterTracking} | ${summary.supportedScenarios}/${
      summary.scenarios
    } | ${formatNumber(summary.medianSampleCount, 0)} | ${formatNumber(
      summary.medianSampleWallMs,
    )} | ${formatNumber(summary.medianTotalSampleActiveMs)} | ${formatUnsignedPercent(
      summary.medianActiveCv,
    )} | ${formatUnsignedPercent(
      summary.maxActiveCv,
    )} | ${formatUnsignedPercent(summary.medianActiveRme95)} | ${formatUnsignedPercent(
      summary.maxActiveRme95,
    )} | ${formatNumber(
      summary.activeMs,
    )} | ${formatNumber(summary.settledMs)} | ${formatNumber(summary.quietMs)} | ${formatNumber(
      summary.bboxReads,
      0,
    )} | ${formatNumber(summary.clientRectReads, 0)} | ${formatNumber(
      summary.clientRectEntries,
      0,
    )} | ${formatNumber(summary.mutationRecords, 0)} | ${formatNumber(
      summary.offsetReads,
      0,
    )} | ${formatNumber(summary.styleReads, 0)} | ${formatNumber(
      summary.itemSlotCalls,
      0,
    )} | ${formatNumber(summary.longTaskCount, 0)} |`,
  );
}

if (widthProfileRows.length > 0) {
  markdown.push("");
  markdown.push("## Width profile matrix");
  markdown.push("");
  markdown.push(
    "This describes the executed width input shape for each scenario. Width assignments count every write, including writes inside a burst; steps count the stable waits that are measured.",
  );
  markdown.push("");
  markdown.push(
    `| Component | Scenario | Steps | Width assignments | Unique widths | Repeated assignments | Repeated transitions | Large deltas (${widthProfileLargeDeltaThresholds
      .map((threshold) => `>${threshold}px`)
      .join(", ")}) | Max delta |`,
  );
  markdown.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");

  for (const row of widthProfileRows) {
    const profile = row.widthProfile;
    markdown.push(
      `| ${row.component} | ${row.scenario} | ${formatNumber(
        profile.stepCount,
        0,
      )} | ${formatNumber(profile.widthAssignmentCount, 0)} | ${formatNumber(
        profile.uniqueWidthCount,
        0,
      )} | ${formatNumber(profile.repeatedWidthAssignments, 0)} | ${formatNumber(
        profile.repeatedTransitions,
        0,
      )} | ${formatNumber(profile.largeDeltaTransitions, 0)} | ${formatNumber(
        profile.maxDelta,
        0,
      )} |`,
    );
  }
}

const activeHotspotGroups = activeHotspots.filter(({ hotspots }) => hotspots.length > 0);
if (activeHotspotGroups.length > 0) {
  markdown.push("");
  markdown.push("## Top low-noise active hotspots by version");
  markdown.push("");
  markdown.push(
    `Rows are sorted by median active time and limited to active RME <= ${formatUnsignedPercent(
      activeHotspotRmeThreshold,
    )}. Structural columns are \`N/A\` when counter tracking was disabled for that version.`,
  );
}

for (const { hotspots, tracksCounters, version } of activeHotspotGroups) {
  markdown.push("");
  markdown.push(`### ${version}`);
  markdown.push("");
  markdown.push(
    "| Component | Scenario | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |",
  );
  markdown.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");

  for (const hotspot of hotspots) {
    markdown.push(
      `| ${hotspot.component} | ${hotspot.scenario} | ${formatNumber(
        hotspot.activeMs,
      )} | ${formatUnsignedPercent(hotspot.activeRme)} | ${formatNumber(
        hotspot.sampleCount,
        0,
      )} | ${formatCounterValue(tracksCounters, hotspot.bboxReads)} | ${formatCounterValue(
        tracksCounters,
        hotspot.clientRectEntries,
      )} | ${formatCounterValue(tracksCounters, hotspot.mutationRecords)} | ${formatCounterValue(
        tracksCounters,
        hotspot.offsetReads,
      )} | ${formatCounterValue(tracksCounters, hotspot.styleReads)} |`,
    );
  }
}

const activeHotspotComponentGroups = activeHotspotsByComponent.filter(({ components }) =>
  components.some(({ hotspots }) => hotspots.length > 0),
);
if (activeHotspotComponentGroups.length > 0) {
  markdown.push("");
  markdown.push("## Top low-noise active hotspots by component");
  markdown.push("");
  markdown.push(
    `Each component list keeps up to 5 rows with active RME <= ${formatUnsignedPercent(
      activeHotspotRmeThreshold,
    )}, sorted by median active time.`,
  );
}

for (const { components, tracksCounters, version } of activeHotspotComponentGroups) {
  markdown.push("");
  markdown.push(`### ${version}`);

  for (const { component, hotspots } of components) {
    markdown.push("");
    markdown.push(`#### ${component}`);
    markdown.push("");
    markdown.push(
      "| Scenario | Active ms | Active RME | Samples | BBox reads | Client rect entries | Mutation records | Offset reads | Style reads |",
    );
    markdown.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");

    for (const hotspot of hotspots) {
      markdown.push(
        `| ${hotspot.scenario} | ${formatNumber(hotspot.activeMs)} | ${formatUnsignedPercent(
          hotspot.activeRme,
        )} | ${formatNumber(hotspot.sampleCount, 0)} | ${formatCounterValue(
          tracksCounters,
          hotspot.bboxReads,
        )} | ${formatCounterValue(tracksCounters, hotspot.clientRectEntries)} | ${formatCounterValue(
          tracksCounters,
          hotspot.mutationRecords,
        )} | ${formatCounterValue(tracksCounters, hotspot.offsetReads)} | ${formatCounterValue(
          tracksCounters,
          hotspot.styleReads,
        )} |`,
      );
    }
  }
}

const structuralHotspotGroups = structuralHotspots.filter(({ hotspots }) => hotspots.length > 0);
if (structuralHotspotGroups.length > 0) {
  markdown.push("");
  markdown.push("## Top structural hotspots by version");
}

for (const { hotspots, version } of structuralHotspotGroups) {
  markdown.push("");
  markdown.push(`### ${version}`);
  markdown.push("");
  markdown.push("| Component | Scenario | Counter | Value | Active ms | Active RME |");
  markdown.push("| --- | --- | --- | ---: | ---: | ---: |");

  for (const hotspot of hotspots) {
    markdown.push(
      `| ${hotspot.component} | ${hotspot.scenario} | ${
        hotspot.signal
      } | ${formatNumber(hotspot.value, 0)} | ${formatNumber(
        hotspot.activeMs,
      )} | ${formatUnsignedPercent(hotspot.activeRme)} |`,
    );
  }
}

const structuralHotspotComponentGroups = structuralHotspotsByComponent.filter(({ components }) =>
  components.some(({ hotspots }) => hotspots.length > 0),
);
if (structuralHotspotComponentGroups.length > 0) {
  markdown.push("");
  markdown.push("## Top structural hotspots by component");
  markdown.push("");
  markdown.push(
    "Each component list keeps up to 5 counter/scenario pairs, sorted by absolute counter value. This section is omitted when counter tracking is disabled.",
  );
}

for (const { components, version } of structuralHotspotComponentGroups) {
  markdown.push("");
  markdown.push(`### ${version}`);

  for (const { component, hotspots } of components) {
    markdown.push("");
    markdown.push(`#### ${component}`);
    markdown.push("");
    markdown.push("| Scenario | Counter | Value | Active ms | Active RME |");
    markdown.push("| --- | --- | ---: | ---: | ---: |");

    for (const hotspot of hotspots) {
      markdown.push(
        `| ${hotspot.scenario} | ${hotspot.signal} | ${formatNumber(
          hotspot.value,
          0,
        )} | ${formatNumber(hotspot.activeMs)} | ${formatUnsignedPercent(hotspot.activeRme)} |`,
      );
    }
  }
}

if (adjacentSummaries.length > 0) {
  markdown.push("");
  markdown.push("## Adjacent release summary");
  markdown.push("");
  markdown.push(
    "| From | To | Comparable scenarios | Low-conf active rows | Active delta | Active ms | BBox delta | Client rect delta | Client rect entry delta | Mutation delta | Offset delta | Style delta | Slot delta | Settled delta | Long task delta |",
  );
  markdown.push(
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  );

  for (const summary of adjacentSummaries) {
    markdown.push(
      `| ${summary.from} | ${summary.to} | ${summary.comparableScenarios}/${matrix.length} | ${
        summary.lowConfidenceScenarios
      }/${summary.comparableScenarios} | ${
        summary.lowConfidenceScenarios > 0 ? "~" : ""
      }${formatPercent(
        summary.activeDelta,
      )} | ${formatNumber(summary.activeMsBefore)} -> ${formatNumber(
        summary.activeMsAfter,
      )} | ${formatPercent(summary.bboxReadsDelta)} | ${formatPercent(
        summary.clientRectReadsDelta,
      )} | ${formatPercent(summary.clientRectEntriesDelta)} | ${formatPercent(
        summary.mutationRecordsDelta,
      )} | ${formatPercent(summary.offsetReadsDelta)} | ${formatPercent(
        summary.styleReadsDelta,
      )} | ${formatPercent(
        summary.itemSlotCallsDelta,
      )} | ${formatPercent(summary.settledDelta)} | ${formatPercent(summary.longTaskCountDelta)} |`,
    );
  }
}

markdown.push("");
markdown.push("## Active time matrix");
markdown.push("");
markdown.push(
  "| Component | Scenario | " + reportColumns.map((column) => column.label).join(" | ") + " |",
);
markdown.push("| --- | --- | " + reportColumns.map(() => "---:").join(" | ") + " |");

for (const row of matrix) {
  markdown.push(
    `| ${row.component} | ${row.scenario} | ${reportColumns
      .map((column) => formatNumber(cellMetrics(row, column.key)?.medianActiveMs))
      .join(" | ")} |`,
  );
}

if (adjacentPairs.length > 0) {
  markdown.push("");
  markdown.push("## Adjacent active delta matrix");
  markdown.push("");
  markdown.push(
    "| Component | Scenario | " +
      adjacentPairs.map((pair) => `${pair.from.label} -> ${pair.to.label}`).join(" | ") +
      " |",
  );
  markdown.push("| --- | --- | " + adjacentPairs.map(() => "---:").join(" | ") + " |");

  for (const row of matrix) {
    markdown.push(
      `| ${row.component} | ${row.scenario} | ${adjacentPairs
        .map((pair) => {
          const before = cellMetrics(row, pair.from.key);
          const after = cellMetrics(row, pair.to.key);
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
    const caveats = releaseCaveats.get(
      `${pair.from.report.target.version}>${pair.to.report.target.version}`,
    );
    if (!caveats) {
      continue;
    }

    markdown.push("");
    markdown.push(`### ${pair.from.label} -> ${pair.to.label}`);
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
    markdown.push(`### ${pair.from.label} -> ${pair.to.label}`);
    markdown.push("");
    markdown.push(
      "| Component | Scenario | Active delta | Active ms | Active RME | Confidence | BBox delta | Client rect delta | Client rect entry delta | Mutation delta | Offset delta | Slot delta | Settled delta |",
    );
    markdown.push(
      "| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    );

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
        } | ${formatPairCounterDelta(pair, before, after, "medianBoundingRectReads")} | ${formatPairCounterDelta(
          pair,
          before,
          after,
          "medianClientRectReads",
        )} | ${formatPairCounterDelta(pair, before, after, "medianClientRectEntries")} | ${formatPairCounterDelta(
          pair,
          before,
          after,
          "medianMutationRecords",
        )} | ${formatPairOffsetDelta(pair, before, after)} | ${formatPairCounterDelta(
          pair,
          before,
          after,
          "medianItemSlotCalls",
        )} | ${formatPercent(percentDelta(before.medianSettledMs, after.medianSettledMs))} |`,
      );
    }
  }

  const structuralMoverGroups = adjacentPairs
    .map((pair) => ({
      movers: topStructuralMoversForPair(pair),
      pair,
    }))
    .filter(({ movers }) => movers.length > 0);

  if (structuralMoverGroups.length > 0) {
    markdown.push("");
    markdown.push("## Top structural movers by adjacent release");
  }

  for (const { movers, pair } of structuralMoverGroups) {
    markdown.push("");
    markdown.push(`### ${pair.from.label} -> ${pair.to.label}`);
    markdown.push("");
    markdown.push(
      "| Component | Scenario | Counter | Delta | Value | Active delta | Active confidence |",
    );
    markdown.push("| --- | --- | --- | ---: | ---: | ---: | --- |");

    for (const mover of movers) {
      const timingSignal = adjacentTimingSignal(mover.before, mover.after);
      markdown.push(
        `| ${mover.row.component} | ${mover.row.scenario} | ${mover.signal} | ${formatPercent(
          mover.delta,
        )} | ${formatNumber(mover.beforeValue, 0)} -> ${formatNumber(mover.afterValue, 0)} | ${
          timingSignal.lowConfidence
            ? `~${formatPercent(mover.activeDelta)}`
            : formatPercent(mover.activeDelta)
        } | ${
          timingSignal.lowConfidence
            ? `low (${timingSignal.lowConfidenceReasons.join("; ")})`
            : "normal"
        } |`,
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
  `\`~\` marks a low-confidence delta: at least one side has active-time CV above ${activeCvLowConfidenceThreshold}%, compared active-time mean MOE intervals overlap, or median and mean active-time deltas point in opposite directions. SVG cells keep the normal direction color and add a top-right triangle marker.`,
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
  `<text class="axis" x="32" y="110">~ and a top-right triangle mark low-confidence deltas; high CV, overlapping mean MOE, or median/mean direction mismatch is the trigger.</text>`,
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
    const metrics = cellMetrics(row, column.key);
    const value = metrics?.medianActiveMs;
    const baseline = row.cells.find((cell) => cell.metrics)?.metrics?.medianActiveMs;
    const delta = percentDelta(baseline, value);
    const cell = cellForKey(row, column.key);
    const counterDetails =
      metrics && counterTrackingEnabled(column.report)
        ? `, bbox reads ${formatNumber(metrics.medianBoundingRectReads, 0)}, client rects ${formatNumber(
            metrics.medianClientRectReads,
            0,
          )}, client rect entries ${formatNumber(
            metrics.medianClientRectEntries,
            0,
          )}, offset reads ${formatNumber(offsetReads(metrics), 0)}`
        : ", counters disabled";

    return {
      fill: metrics ? colorForDelta(delta) : "#e5e7eb",
      text: value === undefined ? "N/A" : formatNumber(value, 0),
      title:
        value === undefined
          ? `${column.label} ${row.scenario}: N/A${cell?.reason ? `, ${cell.reason}` : ""}`
          : `${column.label} ${row.scenario}: active ${formatMs(
              value,
            )}, delta ${formatPercent(delta)}, active RME ${formatUnsignedPercent(
              metrics.sampleRme95ActiveMs,
            )}, active CV ${formatUnsignedPercent(metrics.sampleCvActiveMs)}, active stddev ${formatMs(
              metrics.sampleStdDevActiveMs,
            )}${counterDetails}, mean active MOE ${formatMs(metrics.sampleMoe95MeanActiveMs)}, total sampled active ${formatMs(
              metrics.sampleTotalActiveMs,
            )}, sample wall ${formatMs(metrics.sampleWallMs)}, samples ${metrics.sampleCount ?? "N/A"}`,
    };
  },
  columns: reportColumns.map((column) => ({
    key: column.key,
    label: column.label,
    report: column.report,
  })),
  description:
    "Cell text is median active ms; color is delta vs this scenario's first supported version.",
  title: "Active time by version",
  top: absolutePanelTop,
});

drawMatrixPanel({
  cellForColumn(row, column) {
    const before = cellMetrics(row, column.pair.from.key);
    const after = cellMetrics(row, column.pair.to.key);
    const { delta, lowConfidence, lowConfidenceReasons, workDelta } = adjacentTimingSignal(
      before,
      after,
    );
    const tracksCounters = pairCounterTrackingEnabled(column.pair);
    let confidenceDetails = "";

    if (lowConfidence) {
      confidenceDetails = `, low confidence: ${lowConfidenceReasons.join("; ")}`;
    } else if (!tracksCounters) {
      confidenceDetails = ", counter tracking disabled";
    } else if (typeof workDelta === "number") {
      confidenceDetails = `, max work-counter delta ${formatPercent(workDelta)}`;
    }

    return {
      cornerMarker: lowConfidence ? `Low confidence: ${lowConfidenceReasons.join("; ")}` : null,
      fill: before && after ? colorForDelta(delta) : "#e5e7eb",
      text: delta === null ? "N/A" : `${lowConfidence ? "~" : ""}${formatPercent(delta)}`,
      title: `${column.pair.from.label} > ${column.pair.to.label} ${
        row.scenario
      }: active ${formatMs(before?.medianActiveMs)} -> ${formatMs(
        after?.medianActiveMs,
      )}, delta ${formatPercent(delta)}, bbox ${formatPairCounterDelta(
        column.pair,
        before,
        after,
        "medianBoundingRectReads",
      )}, client rect ${formatPairCounterDelta(
        column.pair,
        before,
        after,
        "medianClientRectReads",
      )}, client rect entries ${formatPairCounterDelta(
        column.pair,
        before,
        after,
        "medianClientRectEntries",
      )}, mutation records ${formatPairCounterDelta(
        column.pair,
        before,
        after,
        "medianMutationRecords",
      )}, offset ${formatPairOffsetDelta(column.pair, before, after)}${confidenceDetails}`,
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
