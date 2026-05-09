import vue from "@vitejs/plugin-vue";
import { websiteCodeHighlightPlugin } from "./vite.highlight.ts";
import { websiteResolve } from "./vite.shared.ts";

export default {
  plugins: [websiteCodeHighlightPlugin(), vue()],
  resolve: websiteResolve,
};
