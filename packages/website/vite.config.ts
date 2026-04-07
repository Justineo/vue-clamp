import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite-plus";
import { websiteResolve } from "./vite.shared.ts";

export default defineConfig({
  plugins: [vue()],
  resolve: websiteResolve,
});
