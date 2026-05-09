export type PkgManager = "vp" | "npm" | "pnpm" | "yarn" | "bun" | "agent";

export type HighlightedPkgManager = Exclude<PkgManager, "agent">;

export const installCommands = {
  vp: "vp add vue-clamp",
  npm: "npm install vue-clamp",
  pnpm: "pnpm add vue-clamp",
  yarn: "yarn add vue-clamp",
  bun: "bun add vue-clamp",
  agent: "Add the npm package `vue-clamp` to this project.",
} as const satisfies Record<PkgManager, string>;

export const highlightedPkgManagers = [
  "vp",
  "npm",
  "pnpm",
  "yarn",
  "bun",
] as const satisfies readonly HighlightedPkgManager[];
