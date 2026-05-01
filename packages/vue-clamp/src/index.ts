// Keep the package entry as an explicit barrel so the public surface stays auditable.
// Internal helpers are intentionally not re-exported from here.
export { LineClamp } from "./LineClamp.ts";
export { RichLineClamp } from "./RichLineClamp.ts";
export { InlineClamp } from "./InlineClamp.ts";
export { WrapClamp } from "./WrapClamp.ts";

export type {
  ClampBoundary,
  InlineClampParts,
  InlineClampProps,
  InlineClampSplit,
  LineClampExposed,
  LineClampLocation,
  LineClampProps,
  LineClampSlotProps,
  RichLineClampExposed,
  RichLineClampProps,
  RichLineClampSlotProps,
  WrapClampExposed,
  WrapClampItemKey,
  WrapClampItemSlotProps,
  WrapClampProps,
  WrapClampSlotProps,
} from "./types.ts";
