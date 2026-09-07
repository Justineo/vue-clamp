import { afterEach, expect, it, vi } from "vite-plus/test";
import { listenForFontLoads } from "../src/layout.ts";
import { scheduleFontFrame } from "../src/font-frame.ts";
const stops: Array<() => void> = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  vi.restoreAllMocks();
});
const ready = async () => {
  await document.fonts.ready;
  await Promise.resolve();
  await Promise.resolve();
};
const frame = () => new Promise(requestAnimationFrame);
it("shares native font delivery and detaches the final subscriber", async () => {
  const add = vi.spyOn(document.fonts, "addEventListener"),
    remove = vi.spyOn(document.fonts, "removeEventListener");
  const a = vi.fn(),
    b = vi.fn();
  stops.push(listenForFontLoads(a), listenForFontLoads(b));
  await ready();
  a.mockClear();
  b.mockClear();
  expect(add.mock.calls.filter((c) => c[0] === "loadingdone")).toHaveLength(1);
  document.fonts.dispatchEvent(new Event("loadingdone"));
  expect(a).toHaveBeenCalledOnce();
  expect(b).toHaveBeenCalledOnce();
  stops[0]!();
  a.mockClear();
  b.mockClear();
  document.fonts.dispatchEvent(new Event("loadingdone"));
  expect(a).not.toHaveBeenCalled();
  expect(b).toHaveBeenCalledOnce();
  stops[1]!();
  expect(remove.mock.calls.filter((c) => c[0] === "loadingdone")).toHaveLength(1);
});
it("does not notify a subscriber cancelled before ready settles", async () => {
  const a = vi.fn();
  const stop = listenForFontLoads(a);
  stop();
  await ready();
  document.fonts.dispatchEvent(new Event("loadingdone"));
  expect(a).not.toHaveBeenCalled();
});
it("honors unsubscription during native delivery", async () => {
  let armed = false;
  const b = vi.fn();
  let stopB = () => {};
  stops.push(
    listenForFontLoads(() => {
      if (armed) stopB();
    }),
  );
  stopB = listenForFontLoads(b);
  stops.push(stopB);
  await ready();
  b.mockClear();
  armed = true;
  document.fonts.dispatchEvent(new Event("loadingdone"));
  expect(b).not.toHaveBeenCalled();
});
it("keeps other native subscribers alive after a callback error", async () => {
  const report = vi.spyOn(globalThis, "reportError").mockImplementation(() => {});
  let armed = false;
  const b = vi.fn();
  stops.push(
    listenForFontLoads(() => {
      if (armed) throw new Error("fixture");
    }),
    listenForFontLoads(b),
  );
  await ready();
  b.mockClear();
  armed = true;
  document.fonts.dispatchEvent(new Event("loadingdone"));
  expect(report).toHaveBeenCalledOnce();
  expect(b).toHaveBeenCalledOnce();
});
it("honors cancellation of a later job during the shared frame", async () => {
  const a = vi.fn(),
    b = vi.fn();
  let stopB = () => {};
  stops.push(
    scheduleFontFrame(() => {
      a();
      stopB();
    }),
  );
  stopB = scheduleFontFrame(b);
  stops.push(stopB);
  await frame();
  expect(a).toHaveBeenCalledOnce();
  expect(b).not.toHaveBeenCalled();
});
it("keeps other frame jobs alive after a callback error", async () => {
  const report = vi.spyOn(globalThis, "reportError").mockImplementation(() => {}),
    b = vi.fn();
  stops.push(
    scheduleFontFrame(() => {
      throw new Error("fixture");
    }),
    scheduleFontFrame(b),
  );
  await frame();
  expect(report).toHaveBeenCalledOnce();
  expect(b).toHaveBeenCalledOnce();
});
it("keeps a new native group intact after repeated old cleanup", async () => {
  const old = listenForFontLoads(() => {});
  old();
  const add = vi.spyOn(document.fonts, "addEventListener");
  stops.push(listenForFontLoads(() => {}));
  old();
  stops.push(listenForFontLoads(() => {}));
  await ready();
  expect(add.mock.calls.filter((c) => c[0] === "loadingdone")).toHaveLength(1);
});

it("does not deliver an in-progress event to a new subscriber", async () => {
  let armed = false;
  const added = vi.fn();
  stops.push(
    listenForFontLoads(() => {
      if (armed) stops.push(listenForFontLoads(added));
    }),
  );
  await ready();
  armed = true;
  document.fonts.dispatchEvent(new Event("loadingdone"));
  expect(added).not.toHaveBeenCalled();
  await ready();
  expect(added).toHaveBeenCalledOnce();
});
