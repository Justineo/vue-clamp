import vue from "@vitejs/plugin-vue";
import { websiteResolve } from "./vite.shared.ts";

export default {
  plugins: [vue()],
  resolve: websiteResolve,
};
