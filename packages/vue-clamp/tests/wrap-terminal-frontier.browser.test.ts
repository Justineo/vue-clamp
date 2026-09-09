import { expect, it } from "vite-plus/test";
import { createApp, h, nextTick, ref } from "vue";
import { WrapClamp } from "../src/index.ts";
import type { Component } from "vue";
import type { WrapClampItemSlotProps } from "../src/index.ts";

it("checks a warmed mixed-width frontier without first showing the redundant upper item", async () => {
  await document.fonts.ready;
  const width = ref(120);
  const items = Array.from({ length: 64 }, (_, index) => `I${index + 1}`);
  const widths = [24, 64, 36, 96, 48, 120, 28, 72];
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp({
    setup: () => () =>
      h(
        "div",
        { style: "width:760px;font:16px Georgia,serif;line-height:20px" },
        h(
          "table",
          { style: "table-layout:auto;width:100%;border-collapse:collapse" },
          h(
            "tbody",
            h("tr", [
              h("td", { style: "padding:4px 8px;white-space:nowrap" }, "R-1"),
              h(
                "td",
                { style: "padding:4px 8px" },
                h(
                  WrapClamp as Component,
                  {
                    items,
                    maxLines: 2,
                    style: `width:${width.value}px;max-width:100%`,
                  },
                  {
                    item: ({ item, index }: WrapClampItemSlotProps<string>) =>
                      h(
                        "span",
                        {
                          style: `display:inline-flex;align-items:center;justify-content:center;width:${widths[index % widths.length]}px;height:24px;border:1px solid currentColor;border-radius:999px;margin-inline-end:6px;margin-block-end:6px;white-space:nowrap`,
                        },
                        item,
                      ),
                  },
                ),
              ),
            ]),
          ),
        ),
      ),
  });
  const settle = async () => {
    await nextTick();
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    await nextTick();
  };
  try {
    app.mount(container);
    await settle();
    const root = container.querySelector<HTMLElement>('[data-part="root"]')!;
    const content = root.querySelector<HTMLElement>('[data-part="content"]')!;
    const visible = () =>
      [...content.querySelectorAll<HTMLElement>('[data-part="item"]')].filter(
        (item) => item.style.display !== "none",
      );
    expect(visible()).toHaveLength(3);
    width.value = 680;
    await settle();
    expect(visible()).toHaveLength(19);
    width.value = 120;
    await settle();
    expect(visible()).toHaveLength(3);

    // The first grow learned 19 actual item widths. The next static hint
    // restores that prefix, leaving the materialized search interval [19, 21].
    const firstItem = visible()[0]!;
    // oxlint-disable-next-line typescript-eslint/unbound-method -- called with and restored to its original receiver
    const original = firstItem.getBoundingClientRect;
    const probes: Array<{ materialized: number; shown: number }> = [];
    firstItem.getBoundingClientRect = () => {
      const materialized = content.querySelectorAll('[data-part="item"]').length;
      probes.push({ materialized, shown: visible().length });
      return original.call(firstItem);
    };
    try {
      width.value = 680;
      await settle();
    } finally {
      firstItem.getBoundingClientRect = original;
    }
    expect(
      probes.filter(({ materialized }) => materialized === 21).map(({ shown }) => shown),
    ).toEqual([20]);
    expect(visible().map((item) => item.textContent)).toEqual(items.slice(0, 19));
    expect(content.querySelector('[data-part="item"][aria-hidden="true"]')).toBeNull();
  } finally {
    app.unmount();
    container.remove();
  }
});
