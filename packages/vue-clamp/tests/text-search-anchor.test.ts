import { describe, expect, it } from "vite-plus/test";
import { prepareText, searchTextCandidates } from "../src/text.ts";

type Input = Parameters<typeof searchTextCandidates>[0];

function drive(input: Input, fits: (text: string) => boolean) {
  const search = searchTextCandidates(input);
  const probes: string[] = [];
  let step = search.next();
  while (!step.done) {
    probes.push(step.value);
    step = search.next(fits(step.value));
  }
  return { probes, result: step.value };
}

function inputFor(count: number, kept: number, anchor: number): Input {
  const prepared = prepareText("abcdefghijklmnop".slice(0, count), "grapheme");
  return {
    anchor,
    ellipsis: "…",
    hint: {
      boundaryOffsets: prepared.boundaryOffsets,
      ellipsis: "…",
      kept,
      ratio: 1,
      spacing: "trim",
    },
    prepared,
    ratio: 1,
  };
}

describe("current candidate anchor", () => {
  it("reuses a rejected text after intervening fitting candidates", () => {
    const prepared = prepareText("aa bb cc dd ee ff gg hh ii", "word");
    const { probes, result } = drive(
      { prepared, ellipsis: "…", ratio: 1 },
      (text) => text.length <= 10,
    );

    // The word-end and following-space cuts render the same text. Retaining
    // their verdict also avoids returning to the rejected text after finding
    // the final prefix, when it would require another layout and restoration.
    expect(probes).toEqual(["aa bb cc dd…", "aa bb…", "aa bb cc…"]);
    expect(result.text).toBe("aa bb cc…");
    expect(result.kept).toBe(6);
  });

  it("keeps the bare full-source check separate from repeated marked text", () => {
    const prepared = prepareText("ab");
    const { probes, result } = drive(
      { prepared, ellipsis: "b", ratio: 1, includeFullCandidate: true },
      () => true,
    );

    expect(probes).toEqual(["ab", "ab"]);
    expect(result.text).toBe("ab");
    expect(result.kept).toBe(2);
  });

  it("uses the current verdict to bound projection without rechecking the anchor", () => {
    for (const target of [3, 5, 8]) {
      const { probes, result } = drive(inputFor(12, 9, 5), (text) => text.length - 1 <= target);
      const ranks = probes.map((text) => text.length - 1);
      expect(ranks[0]).toBe(5);
      expect(new Set(ranks).size).toBe(ranks.length);
      expect(ranks.slice(1).every((rank) => (target >= 5 ? rank > 5 : rank < 5))).toBe(true);
      expect(result.kept).toBe(target);
    }
  });

  it("retains exhaustive marked-rank answers and independently checks unmarked full text", () => {
    for (let count = 1; count <= 8; count++) {
      for (let hint = 0; hint < count; hint++) {
        for (let anchor = 0; anchor < count; anchor++) {
          for (let target = -1; target < count; target++) {
            for (const fullFits of [false, true]) {
              for (const known of [false, true]) {
                const input = {
                  ...inputFor(count, hint, anchor),
                  anchorFits: known ? anchor <= target : undefined,
                  includeFullCandidate: true,
                };
                const { probes, result } = drive(input, (text) =>
                  text === input.prepared.text ? fullFits : text.length - 1 <= target,
                );
                expect(result.kept).toBe(fullFits ? count : Math.max(0, target));
                expect(probes).toContain(input.prepared.text);
                if (known) expect(probes).not.toContain(`${input.prepared.text.slice(0, anchor)}…`);
              }
            }
          }
        }
      }
    }
  });

  it("only removes density probes after reading the displayed candidate", () => {
    const input = inputFor(14, 0, 12);
    const fits = (text: string) => text.length - 1 <= 11;
    const original = drive({ ...input, anchor: undefined }, fits);
    const filtered = drive(input, fits);
    let cursor = -1;
    for (const probe of filtered.probes.slice(1)) {
      cursor = original.probes.indexOf(probe, cursor + 1);
      expect(cursor).toBeGreaterThanOrEqual(0);
    }
    expect(filtered.result).toEqual(original.result);

    function writes(probes: string[]) {
      let current = `${input.prepared.text.slice(0, input.anchor)}…`;
      let count = 0;
      for (const probe of [...probes, original.result.text]) {
        if (probe !== current) count++;
        current = probe;
      }
      return count;
    }
    expect(writes(filtered.probes)).toBeLessThan(writes(original.probes));
  });

  it("ignores anchors from a different rank space", () => {
    const input = inputFor(8, 7, 0);
    const { probes } = drive(
      {
        ...input,
        anchorFits: false,
        hint: { ...input.hint!, boundaryOffsets: [...input.prepared.boundaryOffsets] },
      },
      (text) => text.length <= 5,
    );
    expect(probes[0]).toBe("abc…");
  });

  it("retains descending evaluation for nonmonotonic shaping", () => {
    const input = inputFor(8, 2, 2);
    const { probes, result } = drive(
      { ...input, anchorFits: true, prepared: { ...input.prepared, hasCursiveText: true } },
      (text) => ["abcdef…", "ab…"].includes(text),
    );
    expect(probes).toEqual(["abcdefg…", "abcdef…"]);
    expect(result.kept).toBe(6);
  });

  it("starts a fresh rank domain for word fallback", () => {
    const prepared = prepareText("abcdefgh", "word");
    const { result } = drive(
      {
        anchor: 0,
        ellipsis: "…",
        hint: {
          boundaryOffsets: prepared.boundaryOffsets,
          ellipsis: "…",
          kept: 0,
          ratio: 1,
          spacing: "trim",
        },
        prepared,
        ratio: 1,
      },
      (text) => text.length <= 4,
    );
    expect(result.text).toBe("abc…");
    expect(result.boundaryOffsets).toBe(prepared.fallbackBoundaryOffsets);
  });
});
