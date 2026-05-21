import type { ClampExposed, ClampProps, ClampSlots, ClampSlotProps } from "../types.ts";

export type LineClampSlotProps = ClampSlotProps;

export type LineClampExposed = ClampExposed;

export type LineClampSlots = ClampSlots<LineClampSlotProps>;

export interface LineClampProps extends Pick<
  ClampProps,
  "as" | "maxLines" | "maxHeight" | "ellipsis" | "location" | "boundary" | "expanded"
> {
  text?: string;
}
