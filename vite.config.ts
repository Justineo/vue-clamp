import vue from "@vitejs/plugin-vue";
import Vue from "unplugin-vue/rolldown";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [vue()],
  pack: {
    dts: { vue: true },
    platform: "neutral",
    plugins: [Vue({ isProduction: true })],
  },
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
