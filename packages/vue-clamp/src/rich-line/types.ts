import type { ClampExposed, ClampProps, ClampSlots, ClampSlotProps } from "../types.ts";

export interface RichLineClampProps extends Pick<
  ClampProps,
  "as" | "maxLines" | "maxHeight" | "ellipsis" | "boundary" | "expanded"
> {
  html: string;
}

export type RichLineClampSlotProps = ClampSlotProps;

export type RichLineClampExposed = ClampExposed;

export type RichLineClampSlots = ClampSlots<RichLineClampSlotProps>;
