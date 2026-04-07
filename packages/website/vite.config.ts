import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite-plus";
import { voidPlugin } from "void";
import { websiteResolve } from "./vite.shared.ts";

export default defineConfig({
  plugins: [vue(), voidPlugin()],
  resolve: websiteResolve,
});
