import type { ComponentPublicInstance, Ref } from "vue";
import type {
  ClampBoundary,
  ClampLength,
  InlineClampParts,
  InlineClampProps,
  InlineClampSplit,
  LineClampExposed,
  LineClampLocation,
  LineClampProps,
  LineClampSlotProps,
  LineClampSlots,
  RichLineClampExposed,
  RichLineClampProps,
  RichLineClampSlotProps,
  RichLineClampSlots,
  WrapClampExposed,
  WrapClampItemKey,
  WrapClampItemSlotProps,
  WrapClampProps,
  WrapClampSlotProps,
  WrapClampSlots,
} from "../src/index.ts";
import type {
  MultilineAffixRefSetter,
  MultilineFrameRefs,
  MultilineShell,
  MultilineShellOptions,
} from "../src/multiline.ts";
import type { NativeClampMode, NativeModeInput } from "../src/native.ts";
import type {
  PreparedText,
  TextClampFitInput,
  TextClampHint,
  TextClampLayoutInput,
  TextClampResult,
  TextClampSpacing,
} from "../src/text.ts";
import type {
  PreparedRich,
  PreparedRichNode,
  RichBoundaryPoint,
  RichClampOptions,
  RichClampProbe,
  RichClampResult,
  RichState,
} from "../src/rich.ts";

// @ts-expect-error Text helper contracts are source-module API, not package root API.
import type { TextClampHint as RootTextClampHint } from "../src/index.ts"; // eslint-disable-line no-unused-vars

// @ts-expect-error Rich helper contracts are source-module API, not package root API.
import type { RichState as RootRichState } from "../src/index.ts"; // eslint-disable-line no-unused-vars

// @ts-expect-error Shared slot building blocks are implementation API, not package root API.
import type { ClampSlotProps as RootClampSlotProps } from "../src/index.ts"; // eslint-disable-line no-unused-vars

// @ts-expect-error Shared prop maps are implementation API, not package root API.
import type { ClampProps as RootClampProps } from "../src/index.ts"; // eslint-disable-line no-unused-vars

// @ts-expect-error Shared emit maps are implementation API, not package root API.
import type { ClampEmits as RootClampEmits } from "../src/index.ts"; // eslint-disable-line no-unused-vars

// @ts-expect-error Shared slot maps are implementation API, not package root API.
import type { ClampSlots as RootClampSlots } from "../src/index.ts"; // eslint-disable-line no-unused-vars

// @ts-expect-error Multiline helper contracts are source-module API, not package root API.
import type { MultilineAffixRefSetter as RootMultilineAffixRefSetter } from "../src/index.ts"; // eslint-disable-line no-unused-vars

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;

type Expect<Value extends true> = Value;
type SlotProps<Slot> = Slot extends (props: infer Props) => unknown ? Props : never;

type _PackageApiTypes = [
  Expect<Equal<ClampBoundary, "grapheme" | "word">>,
  Expect<Equal<ClampLength, number | string>>,
  Expect<Equal<LineClampLocation, "start" | "middle" | "end" | number>>,
  Expect<Equal<LineClampProps["maxHeight"], ClampLength | undefined>>,
  Expect<Equal<RichLineClampProps["maxHeight"], ClampLength | undefined>>,
  Expect<Equal<WrapClampProps["maxHeight"], ClampLength | undefined>>,
  Expect<Equal<WrapClampProps<string>["items"], readonly string[] | undefined>>,
  Expect<Equal<InlineClampProps["split"], InlineClampSplit | undefined>>,
  Expect<Equal<InlineClampSplit, (text: string) => InlineClampParts>>,
  Expect<
    Equal<WrapClampItemKey<string>, string | ((item: string, index: number) => string | number)>
  >,
  Expect<Equal<WrapClampItemSlotProps<string>["item"], string>>,
  Expect<Equal<WrapClampSlotProps<string>["hiddenItems"], readonly string[]>>,
  Expect<Equal<SlotProps<NonNullable<LineClampSlots["before"]>>, LineClampSlotProps>>,
  Expect<Equal<SlotProps<NonNullable<RichLineClampSlots["after"]>>, RichLineClampSlotProps>>,
  Expect<Equal<undefined extends WrapClampSlots<string>["item"] ? true : false, false>>,
  Expect<Equal<SlotProps<WrapClampSlots<string>["item"]>["item"], string>>,
  Expect<Equal<LineClampSlotProps["toggle"], () => void>>,
  Expect<Equal<RichLineClampSlotProps["expanded"], boolean>>,
  Expect<Equal<LineClampExposed["clamped"], boolean>>,
  Expect<Equal<RichLineClampExposed["expanded"], boolean>>,
  Expect<Equal<WrapClampExposed["toggle"], () => void>>,
];

type _TextHelperContracts = [
  Expect<Equal<TextClampSpacing, "trim" | "preserve-outer">>,
  Expect<Equal<PreparedText["boundaryOffsets"], readonly number[]>>,
  Expect<Equal<TextClampHint["boundaryOffsets"], readonly number[]>>,
  Expect<Equal<TextClampHint["ellipsis"], string | undefined>>,
  Expect<Equal<TextClampHint["hasAffixes"], boolean | undefined>>,
  Expect<Equal<TextClampHint["layoutKey"], string | undefined>>,
  Expect<Equal<TextClampHint["lineLimit"], number | undefined>>,
  Expect<Equal<TextClampHint["maxHeight"], ClampLength | undefined>>,
  Expect<Equal<TextClampHint["ratio"], number | undefined>>,
  Expect<Equal<TextClampHint["spacing"], TextClampSpacing | undefined>>,
  Expect<Equal<TextClampHint["wordFallbackMaxWidth"], number | undefined>>,
  Expect<Equal<TextClampResult["text"], string>>,
  Expect<Equal<TextClampFitInput["prepared"], PreparedText>>,
  Expect<Equal<TextClampLayoutInput["hasAffixes"], boolean | undefined>>,
  Expect<Equal<TextClampLayoutInput["layoutKey"], string | undefined>>,
  Expect<Equal<TextClampLayoutInput["maxHeight"], ClampLength | undefined>>,
];

type _RichHelperContracts = [
  Expect<Equal<RichBoundaryPoint["path"], readonly number[]>>,
  Expect<Equal<PreparedRich["nodes"], readonly PreparedRichNode[]>>,
  Expect<Equal<Extract<RichState, { kind: "clamped" }>["point"], RichBoundaryPoint>>,
  Expect<Equal<RichClampProbe["body"], HTMLElement>>,
  Expect<Equal<RichClampOptions["prepared"], PreparedRich>>,
  Expect<Equal<RichClampResult["state"], RichState | null>>,
];

type _NativeHelperContracts = [
  Expect<Equal<NativeClampMode, "single-line" | "multi-line">>,
  Expect<Equal<NativeModeInput["maxHeight"], ClampLength | undefined>>,
  Expect<Equal<NativeModeInput["boundary"], ClampBoundary>>,
];

type _MultilineHelperContracts = [
  Expect<Equal<Parameters<MultilineAffixRefSetter>[0], ComponentPublicInstance | Element | null>>,
  Expect<Equal<MultilineFrameRefs["rootRef"], Ref<HTMLElement | null>>>,
  Expect<Equal<MultilineShellOptions["expanded"], Ref<boolean>>>,
  Expect<Equal<Parameters<MultilineShellOptions["recompute"]>[0], Ref<boolean>>>,
  Expect<Equal<Parameters<MultilineShellOptions["recompute"]>[1], number | undefined>>,
  Expect<Equal<MultilineShellOptions["syncAffixSignaturesOnRootChange"], boolean | undefined>>,
  Expect<Equal<MultilineShell["requestRecompute"], () => void>>,
];
