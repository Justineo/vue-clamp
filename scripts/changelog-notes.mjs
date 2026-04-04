import fs from "node:fs";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractVersionSection(markdown, version) {
  const lines = markdown.split(/\r?\n/);
  const headingPattern = new RegExp(`^##\\s+\\[?${escapeRegExp(version)}\\]?\\b`);
  const start = lines.findIndex((line) => headingPattern.test(line));

  if (start < 0) {
    throw new Error(`Unable to find CHANGELOG entry for ${version}.`);
  }

  let end = lines.length;

  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index] ?? "")) {
      end = index;
      break;
    }
  }

  const body = lines
    .slice(start + 1, end)
    .join("\n")
    .trim();

  if (!body) {
    throw new Error(`CHANGELOG entry for ${version} is empty.`);
  }

  return body;
}

const version = process.argv[2];

if (!version) {
  console.error("Usage: node ./scripts/changelog-notes.mjs <version>");
  process.exit(1);
}

const changelog = fs.readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
process.stdout.write(`${extractVersionSection(changelog, version)}\n`);
