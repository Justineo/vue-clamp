import { fileURLToPath, URL } from "node:url";
import type { UserConfig } from "vite-plus";

export const websiteResolve: NonNullable<UserConfig["resolve"]> = {
  alias: {
    "vue-clamp": fileURLToPath(new URL("../../packages/vue-clamp/src/index.ts", import.meta.url)),
  },
};
