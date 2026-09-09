import { afterEach, expect, it, vi } from "vite-plus/test";
import { server } from "vite-plus/test/browser";
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

function pendingReadiness(): () => void {
  let resolve!: (fonts: FontFaceSet) => void;
  const promise = new Promise<FontFaceSet>((complete) => {
    resolve = complete;
  });
  vi.spyOn(document.fonts, "ready", "get").mockReturnValue(promise);
  return () => resolve(document.fonts);
}

it("does not repeat initialization for an already fulfilled ready promise", async () => {
  await ready();
  const listeners = Array.from({ length: 4 }, () => vi.fn());
  stops.push(...listeners.map((listener) => listenForFontLoads(listener)));
  await ready();
  for (const listener of listeners) expect(listener).not.toHaveBeenCalled();
  document.fonts.dispatchEvent(new Event("loadingdone"));
  for (const listener of listeners) expect(listener).toHaveBeenCalledOnce();
});

it("keeps pending readiness even when the font set reports loaded", async () => {
  await ready();
  expect(document.fonts.status).toBe("loaded");
  const resolve = pendingReadiness();
  const a = vi.fn();
  const b = vi.fn();
  stops.push(listenForFontLoads(a), listenForFontLoads(b));
  await Promise.resolve();
  expect(a).not.toHaveBeenCalled();
  resolve();
  await ready();
  expect(a).toHaveBeenCalledOnce();
  expect(b).toHaveBeenCalledOnce();
  const late = vi.fn();
  stops.push(listenForFontLoads(late));
  await ready();
  expect(late).not.toHaveBeenCalled();
});

it("preserves explicit settled-ready notification without notifying ordinary subscribers", async () => {
  await ready();
  const ordinary = vi.fn();
  const predictor = vi.fn();
  const cancelled = vi.fn();
  stops.push(listenForFontLoads(ordinary), listenForFontLoads(predictor, true));
  listenForFontLoads(cancelled, true)();
  await ready();
  expect(ordinary).not.toHaveBeenCalled();
  expect(predictor).toHaveBeenCalledOnce();
  expect(cancelled).not.toHaveBeenCalled();
  document.fonts.dispatchEvent(new Event("loadingdone"));
  expect(ordinary).toHaveBeenCalledOnce();
  expect(predictor).toHaveBeenCalledTimes(2);
});

it("keeps a pending promise that resolves in the subscription task", async () => {
  const resolve = pendingReadiness();
  const listener = vi.fn();
  stops.push(listenForFontLoads(listener));
  resolve();
  await ready();
  expect(listener).toHaveBeenCalledOnce();
});

it("honors removal, reentrant subscriptions, and errors during readiness", async () => {
  const resolve = pendingReadiness();
  const report = vi.spyOn(globalThis, "reportError").mockImplementation(() => {});
  const removed = vi.fn();
  const added = vi.fn();
  const survivor = vi.fn();
  let remove = () => {};
  stops.push(
    listenForFontLoads(() => {
      remove();
      stops.push(listenForFontLoads(added));
      throw new Error("readiness fixture");
    }),
  );
  remove = listenForFontLoads(removed);
  stops.push(remove, listenForFontLoads(survivor));
  resolve();
  await ready();
  expect(report).toHaveBeenCalledOnce();
  expect(survivor).toHaveBeenCalledOnce();
  expect(removed).not.toHaveBeenCalled();
  expect(added).not.toHaveBeenCalled();
});

it("tracks a new ready promise while the native group stays subscribed", async () => {
  await ready();
  const earlier = vi.fn();
  stops.push(listenForFontLoads(earlier));
  await ready();
  const resolve = pendingReadiness();
  const later = vi.fn();
  stops.push(listenForFontLoads(later));
  resolve();
  await ready();
  expect(later).toHaveBeenCalledOnce();
  expect(earlier).not.toHaveBeenCalled();
  document.fonts.dispatchEvent(new Event("loadingdone"));
  expect(later).toHaveBeenCalledTimes(2);
  expect(earlier).toHaveBeenCalledOnce();
});

it("keeps real font completion after subscribing before font discovery", async (context) => {
  await ready();
  const calls = vi.fn();
  stops.push(listenForFontLoads(calls));
  await ready();
  expect(calls).not.toHaveBeenCalled();
  const face = new FontFace(
    "ClampReadinessFixture",
    `url(${new URL("./fixtures/narrow.ttf", import.meta.url).href})`,
  );
  const sample = document.createElement("span");
  sample.textContent = "iiiiiiii";
  sample.style.font = '24px "ClampReadinessFixture", monospace';
  document.body.append(sample);
  const previousWidth = sample.getBoundingClientRect().width;
  const done = vi.fn<(event: FontFaceSetLoadEvent) => void>();
  document.fonts.addEventListener("loadingdone", done);
  try {
    document.fonts.add(face);
    await document.fonts.load('24px "ClampReadinessFixture"', "iiiiiiii");
    await ready();
    expect(face.status).toBe("loaded");
    expect(sample.getBoundingClientRect().width).not.toBe(previousWidth);
    try {
      await vi.waitFor(() => expect(done).toHaveBeenCalledOnce());
    } catch (error) {
      // WebKit 2336 loads and renders URL fonts but omits native loadingdone.
      // Probe the event so later WebKit versions retain the same real-delivery assertion.
      if (server.browser === "webkit" && done.mock.calls.length === 0) {
        context.skip("This WebKit runner does not emit native font completion.");
      }
      throw error;
    }
    expect(done.mock.calls[0]![0].isTrusted).toBe(true);
    expect(calls).toHaveBeenCalledOnce();
  } finally {
    document.fonts.removeEventListener("loadingdone", done);
    document.fonts.delete(face);
    sample.remove();
  }
});

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
  const resolve = pendingReadiness();
  const a = vi.fn();
  const stop = listenForFontLoads(a);
  stop();
  resolve();
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
  expect(added).not.toHaveBeenCalled();
});
