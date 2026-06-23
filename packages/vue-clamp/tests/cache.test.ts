import { describe, expect, it } from "vite-plus/test";
import { rememberCacheEntry, touchCacheEntry, tupleCacheKey } from "../src/cache.ts";

describe("cache helpers", () => {
  it("keeps tuple boundaries distinct from delimiter characters", () => {
    expect(tupleCacheKey(["a|b", "c"])).not.toBe(tupleCacheKey(["a", "b|c"]));
  });

  it("keeps tuple value types distinct", () => {
    expect(tupleCacheKey([1, "2"])).not.toBe(tupleCacheKey(["1", 2]));
  });

  it("refreshes touched entries before evicting the oldest entry", () => {
    const cache = new Map<string, number>([
      ["a", 1],
      ["b", 2],
    ]);

    expect(touchCacheEntry(cache, "a")).toBe(1);
    rememberCacheEntry(cache, "c", 3, 2);

    expect([...cache]).toEqual([
      ["a", 1],
      ["c", 3],
    ]);
  });

  it("updates and refreshes remembered entries before eviction", () => {
    const cache = new Map<string, number>([
      ["a", 1],
      ["b", 2],
    ]);

    rememberCacheEntry(cache, "a", 10, 2);
    rememberCacheEntry(cache, "c", 3, 2);

    expect([...cache]).toEqual([
      ["a", 10],
      ["c", 3],
    ]);
  });

  it("skips undefined keys when remembering entries", () => {
    const cache = new Map<string, number>([["a", 1]]);

    rememberCacheEntry(cache, undefined, 2, 1);

    expect([...cache]).toEqual([["a", 1]]);
  });
});
