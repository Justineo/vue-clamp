import vue from "@vitejs/plugin-vue";
import defineRender from "@vue-macros/define-render/vite";
import { websiteCodeHighlightPlugin } from "./vite.highlight.ts";
import { websiteResolve } from "./vite.shared.ts";

export default {
  plugins: [websiteCodeHighlightPlugin(), vue(), defineRender()],
  resolve: websiteResolve,
};
