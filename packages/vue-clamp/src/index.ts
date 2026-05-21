// Keep the package entry as an explicit barrel so the public surface stays auditable.
// Internal helpers are intentionally not re-exported from here.
export { default as InlineClamp } from "./inline/InlineClamp.vue";
export { default as LineClamp } from "./line/LineClamp.vue";
export { default as RichLineClamp } from "./rich-line/RichLineClamp.vue";
export { default as WrapClamp } from "./wrap/WrapClamp.vue";

export type { ClampBoundary, ClampLength, LineClampLocation } from "./types.ts";

export type { InlineClampParts, InlineClampProps, InlineClampSplit } from "./inline/types.ts";

export type {
  LineClampExposed,
  LineClampProps,
  LineClampSlotProps,
  LineClampSlots,
} from "./line/types.ts";

export type {
  RichLineClampExposed,
  RichLineClampProps,
  RichLineClampSlotProps,
  RichLineClampSlots,
} from "./rich-line/types.ts";

export type {
  WrapClampExposed,
  WrapClampItemKey,
  WrapClampItemSlotProps,
  WrapClampProps,
  WrapClampSlotProps,
  WrapClampSlots,
} from "./wrap/types.ts";
