import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  cleanupMounted,
  mountClamp,
  rootElement,
  sampleVisibleLineCounts,
  settle,
  textElement,
  waitUntilVisible,
} from "./browser.ts";

import type { MountedClamp } from "./browser.ts";

const ENGLISH_TEXT =
  "Vue is a progressive framework for building user interfaces. Unlike other monolithic frameworks, Vue is designed from the ground up to be incrementally adoptable across layouts that change often.";

async function expectWidthSweep(
  mountedClamp: MountedClamp,
  start: number,
  end: number,
  maxLines: number,
): Promise<void> {
  const failures: string[] = [];
  const step = start <= end ? 1 : -1;

  for (let width = start; width !== end + step; width += step) {
    mountedClamp.width.value = width;
    await settle(1);

    const root = rootElement(mountedClamp.container);
    const counts = await sampleVisibleLineCounts(root);
    counts.forEach((count, sample) => {
      if (count > maxLines && failures.length < 12) {
        failures.push(
          `${width}px @ sample ${sample}: ${count} lines, text="${textElement(root).textContent ?? ""}"`,
        );
      }
    });
  }

  expect(failures).toEqual([]);
}

afterEach(() => {
  cleanupMounted();
});

describe("Clamp browser width sweeps", () => {
  it("keeps the english end clamp within 3 visible lines while shrinking and growing 1px at a time", async () => {
    await document.fonts?.ready;

    const mountedClamp = mountClamp({
      text: ENGLISH_TEXT,
      width: 420,
      style: "line-height:24px",
      props: {
        maxLines: 3,
      },
    });

    await waitUntilVisible(rootElement(mountedClamp.container));
    await expectWidthSweep(mountedClamp, 420, 240, 3);
    await expectWidthSweep(mountedClamp, 240, 420, 3);
  });

  it("keeps after-slot layouts within 3 visible lines while shrinking and growing 1px at a time", async () => {
    await document.fonts?.ready;

    const mountedClamp = mountClamp({
      text: ENGLISH_TEXT,
      width: 360,
      style: "line-height:24px",
      props: {
        maxLines: 3,
      },
      after: () => "[Read more]",
    });

    await waitUntilVisible(rootElement(mountedClamp.container));
    await expectWidthSweep(mountedClamp, 360, 220, 3);
    await expectWidthSweep(mountedClamp, 220, 360, 3);
  });
});
