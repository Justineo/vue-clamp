import { describe, expect, it } from "vite-plus/test";
import { patchRich, prepareRich } from "../src/rich.ts";

import type { RichState } from "../src/rich.ts";

describe("Rich forward text patches", () => {
  it.each(["…", "", " […] "])(
    "restores a trimmed source leaf without consuming the marker %j",
    (ellipsis) => {
      const html = "<b>alpha<i> beta</i></b> context <i>gamma</i> tail";
      const prepared = prepareRich(html)!;
      const from: RichState = { kind: "clamped", point: { path: [1], offset: 1 } };
      const destinations: RichState[] = [
        { kind: "clamped", point: { path: [2, 0], offset: 3 } },
        { kind: "full" },
      ];

      for (const to of destinations) {
        const target = document.createElement("span");
        patchRich(prepared, target, null, from, ellipsis);
        const prefix = target.firstChild;
        const marker = ellipsis ? target.lastChild : null;
        expect(target.innerHTML).toBe(`<b>alpha<i> beta</i></b>${ellipsis}`);

        patchRich(prepared, target, from, to, ellipsis);

        expect(target.innerHTML).toBe(
          to.kind === "full" ? html : `<b>alpha<i> beta</i></b> context <i>gam</i>${ellipsis}`,
        );
        expect(target.firstChild).toBe(prefix);
        if (marker && to.kind === "clamped") expect(target.lastChild).toBe(marker);
      }
    },
  );
});
