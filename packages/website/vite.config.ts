import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite-plus";
import { voidPlugin } from "void";

export default defineConfig({
  plugins: [vue(), voidPlugin()],
  resolve: {
    alias: {
      "vue-clamp": fileURLToPath(new URL("../../packages/vue-clamp/src/index.ts", import.meta.url)),
    },
  },
});
