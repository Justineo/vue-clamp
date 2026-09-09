import { describe, expect, it, vi } from "vite-plus/test";
import { patchRich, prepareRich } from "../src/rich.ts";

import type { RichState } from "../src/rich.ts";

describe("Rich backward text patches", () => {
  it.each(["…", "", " […] "])(
    "retains earlier nested text and marker identities with marker %j",
    (ellipsis) => {
      const prepared = prepareRich(
        "<a><b>alpha one </b><i>beta two</i></a><strong>gamma delta</strong>",
      );
      if (!prepared) throw new Error("Expected browser rich preparation.");
      const target = document.createElement("span");
      const from: RichState = { kind: "clamped", point: { path: [1, 0], offset: 5 } };
      const to: RichState = { kind: "clamped", point: { path: [0, 0, 0], offset: 6 } };
      patchRich(prepared, target, null, from, ellipsis);
      const link = target.firstChild!;
      const emphasis = link.firstChild!;
      const text = emphasis.firstChild;
      const marker = ellipsis ? target.lastChild : null;
      const clone = vi.spyOn(Range.prototype, "cloneContents");

      try {
        patchRich(prepared, target, from, to, ellipsis);

        expect(target.innerHTML).toBe(`<a><b>alpha</b></a>${ellipsis}`);
        expect(target.firstChild).toBe(link);
        expect(link.firstChild).toBe(emphasis);
        expect(emphasis.firstChild).toBe(text);
        if (marker) expect(target.lastChild).toBe(marker);
        expect(clone).not.toHaveBeenCalled();
      } finally {
        clone.mockRestore();
      }
    },
  );
});
