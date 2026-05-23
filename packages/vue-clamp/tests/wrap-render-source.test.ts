import { parse as parseSfc } from "@vue/compiler-sfc";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const wrapClampFilename = resolve("packages/vue-clamp/src/wrap/WrapClamp.vue");
const wrapClampSource = readFileSync(wrapClampFilename, "utf8");
const wrapClampDescriptor = parseSfc(wrapClampSource, { filename: wrapClampFilename }).descriptor;

describe("WrapClamp render source", () => {
  it("keeps the SFC render-only and binds it through defineRender", () => {
    expect(wrapClampDescriptor.template).toBeNull();
    expect(wrapClampSource).toContain("function render()");
    expect(wrapClampSource).toContain("defineRender(render)");
  });
});
