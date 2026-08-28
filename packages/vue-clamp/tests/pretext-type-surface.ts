import type {
  LineClampExposed,
  LineClampProps,
  LineClampSlotProps,
  LineClampSlots,
} from "../src/pretext.ts";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;
type Expect<Value extends true> = Value;

type _PretextLineClampTypes = [
  Expect<Equal<LineClampProps["font"], string | undefined>>,
  Expect<Equal<LineClampProps["maxLines"], number | undefined>>,
  Expect<Equal<LineClampProps["maxHeight"], number | string | undefined>>,
  Expect<Equal<LineClampProps["ellipsis"], string | undefined>>,
  Expect<Equal<LineClampProps["boundary"], "grapheme" | "word" | undefined>>,
  Expect<Equal<"before" extends keyof LineClampProps ? true : false, false>>,
  Expect<Equal<undefined extends LineClampSlots["before"] ? true : false, true>>,
  Expect<Equal<LineClampSlotProps["clamped"], boolean>>,
  Expect<Equal<LineClampExposed["clamped"], boolean>>,
];
