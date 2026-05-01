// Public declarations live in one module so consumers and the runtime prop
// definitions stay aligned without importing component implementation files.
export type ClampBoundary = "grapheme" | "word";

export type LineClampLocation = "start" | "middle" | "end" | number;

// Multiline text/rich and wrap clamps expose the same imperative shell so slot
// controls can be shared across components.
type ClampControls = {
  expand: () => void;
  collapse: () => void;
  toggle: () => void;
};

type ClampState = {
  clamped: boolean;
  expanded: boolean;
};

type ClampSlotProps = ClampControls & ClampState;

type ClampExposed = ClampControls & {
  readonly clamped: boolean;
  readonly expanded: boolean;
};

export type LineClampSlotProps = ClampSlotProps;

export type LineClampExposed = ClampExposed;

export interface LineClampProps {
  as?: string;
  text?: string;
  maxLines?: number;
  maxHeight?: number | string;
  ellipsis?: string;
  location?: LineClampLocation;
  boundary?: ClampBoundary;
  expanded?: boolean;
}

export interface RichLineClampProps {
  as?: string;
  html: string;
  maxLines?: number;
  maxHeight?: number | string;
  ellipsis?: string;
  boundary?: ClampBoundary;
  expanded?: boolean;
}

export type RichLineClampSlotProps = ClampSlotProps;

export type RichLineClampExposed = ClampExposed;

export interface InlineClampParts {
  start?: string;
  body: string;
  end?: string;
}

export type InlineClampSplit = (text: string) => InlineClampParts;

export interface InlineClampProps {
  as?: string;
  text: string;
  ellipsis?: string;
  location?: LineClampLocation;
  boundary?: ClampBoundary;
  split?: InlineClampSplit;
}

export type WrapClampItemKey<T = unknown> = string | ((item: T, index: number) => string | number);

export interface WrapClampItemSlotProps<T = unknown> {
  item: T;
  index: number;
}

export interface WrapClampSlotProps<T = unknown> extends ClampSlotProps {
  hiddenItems: readonly T[];
}

export type WrapClampExposed = ClampExposed;

export interface WrapClampProps<T = unknown> {
  as?: string;
  items: readonly T[];
  itemKey?: WrapClampItemKey<T>;
  maxLines?: number;
  maxHeight?: number | string;
  expanded?: boolean;
}
