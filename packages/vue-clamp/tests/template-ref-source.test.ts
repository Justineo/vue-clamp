import { parse as parseSfc } from "@vue/compiler-sfc";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const inlineFilename = "packages/vue-clamp/src/inline/InlineClamp.vue";
const multilineFilenames = [
  "packages/vue-clamp/src/line/LineClamp.vue",
  "packages/vue-clamp/src/rich-line/RichLineClamp.vue",
];

function descriptorFor(source: string, filename: string) {
  return parseSfc(source, { filename }).descriptor;
}

function dynamicComponentRefs(template: string | null | undefined): string[] {
  if (!template) {
    return [];
  }

  return [...template.matchAll(/<component\b[^>]*\sref="([^"]+)"/g)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
}

describe("SFC render refs", () => {
  it("keeps InlineClamp on compiler template refs", () => {
    const absoluteFilename = resolve(inlineFilename);
    const source = readFileSync(absoluteFilename, "utf8");
    const descriptor = descriptorFor(source, absoluteFilename);

    expect(descriptor.template?.content).toContain("<component");
    expect(dynamicComponentRefs(descriptor.template?.content)).toEqual(["root"]);
    expect(source).toContain('useTemplateRef<HTMLElement>("root")');
    expect(source).toContain('useTemplateRef("body")');
    expect(source).not.toContain("defineRender(render)");
  });

  it("keeps multiline components render-only with direct element refs", () => {
    for (const filename of multilineFilenames) {
      const absoluteFilename = resolve(filename);
      const source = readFileSync(absoluteFilename, "utf8");
      const descriptor = descriptorFor(source, absoluteFilename);

      expect(descriptor.template).toBeNull();
      expect(dynamicComponentRefs(descriptor.template?.content)).toEqual([]);
      expect(source).not.toContain("useTemplateRef");
      expect(source).not.toContain("function setRootElement");
      expect(source).toContain("ref: rootRef");
      expect(source).toContain("defineRender(render)");
    }
  });
});
