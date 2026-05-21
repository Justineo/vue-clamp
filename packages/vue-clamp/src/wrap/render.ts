import { h } from "vue";
import { hasSlotContent } from "../slot.ts";
import { wrapClampItemStyle } from "./styles.ts";

import type { ComponentPublicInstance, VNodeChild } from "vue";
import type { WrapClampItemKey, WrapClampSlotProps } from "./types.ts";

type AffixSlotProps<T> = {
  part: "before" | "after";
  render?: ((props: WrapClampSlotProps<T>) => VNodeChild) | undefined;
  setRef: (element: Element | null) => void;
  slotProps: WrapClampSlotProps<T>;
};

export function resolveWrapClampItemKey<T>(
  itemKey: WrapClampItemKey<T> | undefined,
  item: T,
  index: number,
): string | number {
  if (typeof itemKey === "function") {
    // Functional keys let callers describe identity for arbitrary item shapes.
    return itemKey(item, index);
  }

  if (
    typeof itemKey === "string" &&
    item &&
    typeof item === "object" &&
    itemKey in (item as Record<string, unknown>)
  ) {
    const value = (item as Record<string, unknown>)[itemKey];
    if (typeof value === "string" || typeof value === "number") {
      return value;
    }
  }

  // Falling back to index keeps primitive arrays usable without requiring a key
  // option, matching Vue's simple-list ergonomics.
  return index;
}

export function defaultWrapClampItemText(item: unknown): string {
  if (typeof item === "string") {
    return item;
  }

  if (typeof item === "number" || typeof item === "boolean" || typeof item === "bigint") {
    return String(item);
  }

  const serialized = JSON.stringify(item);
  return typeof serialized === "string" ? serialized : "";
}

export function WrapClampAffixSlot<T>({
  part,
  render,
  setRef,
  slotProps,
}: AffixSlotProps<T>): VNodeChild {
  const content = render?.(slotProps);
  if (!hasSlotContent(content)) {
    return null;
  }

  return h(
    "span",
    {
      "data-part": part,
      ref(element: Element | ComponentPublicInstance | null) {
        setRef(element instanceof Element ? element : null);
      },
      style: wrapClampItemStyle,
    },
    content,
  );
}
