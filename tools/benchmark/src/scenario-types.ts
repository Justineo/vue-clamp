import type { App, Component } from "vue";

export type ComponentName = "InlineClamp" | "LineClamp" | "RichLineClamp" | "WrapClamp";

export type MountedScenario = {
  advanceContent?: () => void;
  app: App;
  collectExtraMetrics?: () => Record<string, number>;
  container: HTMLElement;
  dispose?: () => void;
  loadFont?: () => Promise<void>;
  resetExtraMetrics?: () => void;
  root: HTMLElement;
  setWidth: (value: number) => void;
  validate?: () => void;
};

export type PublicScenario = {
  beforeStep?: (mounted: MountedScenario, stepIndex: number) => Promise<void> | void;
  component: ComponentName;
  group: "inline" | "line" | "pretext" | "rich" | "wrap";
  maxStableFrames?: number;
  minVersion?: string;
  mount: (component: Component, initialWidth: number) => Promise<MountedScenario>;
  name: string;
  unsupportedReason?: string;
  widths: readonly number[];
  widthBursts?: readonly (readonly number[])[];
};
