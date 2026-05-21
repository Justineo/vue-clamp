import type {
  ClampExposed,
  ClampProps,
  ClampSlots,
  ClampSlotProps,
  ClampSlotRender,
} from "../types.ts";

export type WrapClampItemKey<T = unknown> = string | ((item: T, index: number) => string | number);

export interface WrapClampItemSlotProps<T = unknown> {
  item: T;
  index: number;
}

export interface WrapClampSlotProps<T = unknown> extends ClampSlotProps {
  hiddenItems: readonly T[];
}

export interface WrapClampSlots<T = unknown> extends ClampSlots<WrapClampSlotProps<T>> {
  item?: ClampSlotRender<WrapClampItemSlotProps<T>>;
}

export type WrapClampExposed = ClampExposed;

export interface WrapClampProps<T = unknown> extends Pick<
  ClampProps,
  "as" | "maxLines" | "maxHeight" | "expanded"
> {
  items?: readonly T[];
  itemKey?: WrapClampItemKey<T>;
}

export type SequenceMeasurement = {
  allFit: boolean;
  visibleItems: number;
};

export type ClampLimits = {
  clipToRootHeight: boolean;
  lineLimit: number | undefined;
};

export type Size = {
  height: number;
  width: number;
};
