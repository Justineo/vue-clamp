export type LineClampLocation = "start" | "middle" | "end" | number;

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
  expanded?: boolean;
}

export interface RichLineClampProps {
  as?: string;
  html: string;
  maxLines?: number;
  maxHeight?: number | string;
  ellipsis?: string;
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
