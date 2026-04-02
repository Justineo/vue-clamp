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
  autoresize?: boolean;
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

export type ClampLocation = LineClampLocation;
export type ClampSlotProps = LineClampSlotProps;
export type ClampExposed = LineClampExposed;
export type ClampProps = LineClampProps;
