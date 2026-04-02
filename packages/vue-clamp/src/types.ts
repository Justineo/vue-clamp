export type ClampLocation = "start" | "middle" | "end" | number;

export interface ClampSlotProps {
  expand: () => void;
  collapse: () => void;
  toggle: () => void;
  clamped: boolean;
  expanded: boolean;
}

export interface ClampExposed {
  expand: () => void;
  collapse: () => void;
  toggle: () => void;
  readonly clamped: boolean;
  readonly expanded: boolean;
}

export interface ClampProps {
  as?: string;
  autoresize?: boolean;
  text?: string;
  maxLines?: number;
  maxHeight?: number | string;
  ellipsis?: string;
  location?: ClampLocation;
  expanded?: boolean;
}
