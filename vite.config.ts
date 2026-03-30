import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  lint: { options: { typeAware: true, typeCheck: true } },
  test: {
    environment: "node",
    setupFiles: ["./tests/node-setup.ts"],
    include: ["packages/vue-clamp/tests/**/*.test.ts"],
    exclude: ["packages/vue-clamp/tests/**/*.browser.test.ts"],
  },
});
