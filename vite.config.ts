import vue from "@vitejs/plugin-vue";
import defineRenderRolldown from "@vue-macros/define-render/rolldown";
import defineRender from "@vue-macros/define-render/vite";
import Vue from "unplugin-vue/rolldown";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [vue(), defineRender()],
  pack: {
    dts: { vue: true },
    platform: "neutral",
    plugins: [
      Vue({
        isProduction: true,
      }),
      defineRenderRolldown(),
    ],
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
