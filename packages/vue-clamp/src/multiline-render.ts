import { h } from "vue";
import { hasSlotContent } from "./slot.ts";

import type { CSSProperties, VNodeChild } from "vue";
import type { MultilineAffixRefSetter } from "./multiline.ts";
import type { ClampSlotProps, ClampSlotRender } from "./types.ts";

type MultilineAffixSlotOptions = {
  part: "before" | "after";
  render: ClampSlotRender<ClampSlotProps>;
  setRef: MultilineAffixRefSetter;
  slotProps: ClampSlotProps;
  slotStyle: CSSProperties;
};

export function renderMultilineAffixSlot({
  part,
  render,
  setRef,
  slotProps,
  slotStyle,
}: MultilineAffixSlotOptions): VNodeChild {
  const content = render(slotProps);
  if (!hasSlotContent(content)) {
    return null;
  }

  return h(
    "span",
    {
      "data-part": part,
      ref: setRef,
      style: slotStyle,
    },
    content,
  );
}
