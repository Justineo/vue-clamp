import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "vue-clamp": fileURLToPath(new URL("../../packages/vue-clamp/src/index.ts", import.meta.url)),
    },
  },
});
