import { createApp, defineComponent, h } from "vue";
import { expect, it, vi } from "vite-plus/test";

it("benchmarks the production Vue runtime without development prop validation", () => {
  const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
  const component = defineComponent({
    props: { sample: { type: String, required: true } },
    render: () => h("span", "runtime probe"),
  });
  const app = createApp(component, { sample: 42 });

  try {
    app.mount(document.createElement("div"));
    expect(warnings).not.toHaveBeenCalled();
  } finally {
    app.unmount();
    warnings.mockRestore();
  }
});
