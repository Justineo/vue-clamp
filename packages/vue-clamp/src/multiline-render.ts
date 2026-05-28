import { h } from "vue";
import { hasSlotContent } from "./slot.ts";

import type { ComponentPublicInstance, CSSProperties, VNodeChild } from "vue";
import type { ClampSlotRender } from "./types.ts";

type MultilineElementRef = (element: ComponentPublicInstance | Element | null) => void;

type MultilineAffixSlotOptions<Props> = {
  part: "before" | "after";
  render?: ClampSlotRender<Props> | undefined;
  setRef: MultilineElementRef;
  slotProps: Props;
  slotStyle: CSSProperties;
};

export function renderMultilineAffixSlot<Props>({
  part,
  render,
  setRef,
  slotProps,
  slotStyle,
}: MultilineAffixSlotOptions<Props>): VNodeChild {
  const content = render?.(slotProps);
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
