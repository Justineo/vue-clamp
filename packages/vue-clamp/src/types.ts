export type LineClampLocation = "start" | "middle" | "end" | number;

export interface LineClampSlotProps {
  expand: () => void;
  collapse: () => void;
  toggle: () => void;
  clamped: boolean;
  expanded: boolean;
}

export interface LineClampExposed {
  expand: () => void;
  collapse: () => void;
  toggle: () => void;
  readonly clamped: boolean;
  readonly expanded: boolean;
}

export interface LineClampProps {
  as?: string;
  text?: string;
  maxLines?: number;
  maxHeight?: number | string;
  ellipsis?: string;
  location?: LineClampLocation;
  expanded?: boolean;
}

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

export interface WrapClampSlotProps<T = unknown> {
  expand: () => void;
  collapse: () => void;
  toggle: () => void;
  clamped: boolean;
  expanded: boolean;
  hiddenItems: readonly T[];
}

export interface WrapClampExposed {
  expand: () => void;
  collapse: () => void;
  toggle: () => void;
  readonly clamped: boolean;
  readonly expanded: boolean;
}

export interface WrapClampProps<T = unknown> {
  as?: string;
  items: readonly T[];
  itemKey?: WrapClampItemKey<T>;
  maxLines?: number;
  maxHeight?: number | string;
  expanded?: boolean;
}

export type ClampLocation = LineClampLocation;
export type ClampSlotProps = LineClampSlotProps;
export type ClampExposed = LineClampExposed;
export type ClampProps = LineClampProps;
