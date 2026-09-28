import vue from "@vitejs/plugin-vue";
import defineRenderRolldown from "@vue-macros/define-render/rolldown";
import defineRender from "@vue-macros/define-render/vite";
import Vue from "unplugin-vue/rolldown";
import type { UserConfig } from "vite-plus";

type PackConfig = Exclude<NonNullable<UserConfig["pack"]>, unknown[]>;

// The native checker currently reaches its recursive comparison limit on Vite and
// Rolldown plugin types. Narrow the escape hatch to these arrays and keep the rest
// of the combined config checked by `satisfies UserConfig` below.
const vitePlugins = [vue(), defineRender()] as unknown as NonNullable<UserConfig["plugins"]>;
const packPlugins = [
  Vue({
    isProduction: true,
  }),
  defineRenderRolldown(),
] as unknown as NonNullable<PackConfig["plugins"]>;

export default {
  plugins: vitePlugins,
  pack: {
    dts: { vue: true },
    platform: "neutral",
    plugins: packPlugins,
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
} satisfies UserConfig;
