import type { LineClampExposed, LineClampProps } from "../src/pretext.ts";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;
type Expect<Value extends true> = Value;

type _PretextLineClampTypes = [
  Expect<Equal<undefined extends LineClampProps["font"] ? true : false, false>>,
  Expect<Equal<LineClampProps["inlineSize"], number | undefined>>,
  Expect<Equal<LineClampProps["maxLines"], number | undefined>>,
  Expect<Equal<"maxHeight" extends keyof LineClampProps ? true : false, false>>,
  Expect<Equal<"ellipsis" extends keyof LineClampProps ? true : false, false>>,
  Expect<Equal<"before" extends keyof LineClampProps ? true : false, false>>,
  Expect<Equal<LineClampExposed["clamped"], boolean>>,
];
