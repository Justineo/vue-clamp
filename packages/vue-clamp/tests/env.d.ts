declare module "*.vue" {
  import type { DefineComponent } from "vue";

  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}

declare module "*.css" {}

declare module "*?raw" {
  const source: string;
  export default source;
}

declare module "*?highlight=vue" {
  const html: string;
  export default html;
}

declare module "virtual:website-highlighted-install-commands" {
  export const highlightedInstallCommands: Record<"vp" | "npm" | "pnpm" | "yarn" | "bun", string>;
}
