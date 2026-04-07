import { fileURLToPath, URL } from "node:url";

export const websitePublicDir = "packages/website/public";

export const websiteResolve = {
  alias: {
    "vue-clamp": fileURLToPath(new URL("../vue-clamp/src/index.ts", import.meta.url)),
  },
};
