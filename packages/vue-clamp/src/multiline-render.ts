import { h } from "vue";
import { hasSlotContent } from "./slot.ts";

import type { ComponentPublicInstance, CSSProperties, VNodeChild } from "vue";
import type { ClampSlotRender } from "./types.ts";

type MultilineAffixSlotProps<Props> = {
  part: "before" | "after";
  render?: ClampSlotRender<Props> | undefined;
  setRef: (element: Element | null) => void;
  slotProps: Props;
  slotStyle: CSSProperties;
};

export function MultilineAffixSlot<Props>({
  part,
  render,
  setRef,
  slotProps,
  slotStyle,
}: MultilineAffixSlotProps<Props>): VNodeChild {
  const content = render?.(slotProps);
  if (!hasSlotContent(content)) {
    return null;
  }

  return h(
    "span",
    {
      "data-part": part,
      ref(element: ComponentPublicInstance | Element | null) {
        setRef(element instanceof Element ? element : null);
      },
      style: slotStyle,
    },
    content,
  );
}
