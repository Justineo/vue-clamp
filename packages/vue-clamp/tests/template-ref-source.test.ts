import { parse as parseSfc } from "@vue/compiler-sfc";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const sfcFilenames = [
  "packages/vue-clamp/src/inline/InlineClamp.vue",
  "packages/vue-clamp/src/line/LineClamp.vue",
  "packages/vue-clamp/src/rich-line/RichLineClamp.vue",
];

function dynamicComponentRefs(source: string, filename: string): string[] {
  const descriptor = parseSfc(source, { filename }).descriptor;
  const template = descriptor.template?.content;
  if (!template) {
    return [];
  }

  return [...template.matchAll(/<component\b[^>]*\sref="([^"]+)"/g)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
}

function explicitTemplateRefNames(source: string): string[] {
  return [...source.matchAll(/useTemplateRef<[^>]+>\("([^"]+)"\)/g)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
}

describe("SFC template refs", () => {
  it("types only dynamic root refs explicitly", () => {
    for (const filename of sfcFilenames) {
      const absoluteFilename = resolve(filename);
      const source = readFileSync(absoluteFilename, "utf8");
      const refNames = dynamicComponentRefs(source, absoluteFilename);
      const explicitRefs = explicitTemplateRefNames(source);

      if (filename.includes("/inline/")) {
        expect(refNames).toEqual(["root"]);
        expect(explicitRefs).toEqual(["root"]);
      } else {
        expect(refNames).toEqual(["rootRef"]);
        expect(explicitRefs).toEqual([]);
      }
    }
  });
});
