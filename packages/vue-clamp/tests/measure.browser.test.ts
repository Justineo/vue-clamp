import { expect, it, vi } from "vite-plus/test";
import { observeMeasuredBorderBoxSizes } from "../src/layout.ts";
import { measureLayout } from "../src/measure.ts";

it("closes suspended measurements on cancellation and reader errors", async () => {
  const stop = [
    observeMeasuredBorderBoxSizes([], () => {}),
    observeMeasuredBorderBoxSizes([], () => {}),
  ];
  try {
    for (const batch of [false, true]) {
      for (const failure of ["cancel", "reader", "complete"] as const) {
        let current = true;
        let relaxed = false;
        const error = new Error(failure);
        const complete = vi.fn(() => {
          if (failure === "complete") throw error;
        });
        function* search() {
          relaxed = true;
          try {
            yield () => {
              if (failure === "reader") throw error;
              if (failure === "cancel") current = false;
              return true;
            };
            return true;
          } finally {
            relaxed = false;
          }
        }
        const measurement = measureLayout(search(), () => current, complete, batch);
        if (failure === "cancel") {
          expect(await measurement).toBe(batch ? null : true);
          if (batch) expect(complete).not.toHaveBeenCalled();
        } else {
          await expect(measurement).rejects.toBe(error);
        }
        expect(relaxed).toBe(false);
      }
    }
  } finally {
    for (const disconnect of stop) disconnect();
  }
});
