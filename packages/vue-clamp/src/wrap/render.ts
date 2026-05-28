import { h, mergeProps } from "vue";
import { trueOrUndefined } from "../attributes.ts";
import { hasSlotContent } from "../slot.ts";
import { contentStyle, hiddenItemStyle, itemStyle } from "./styles.ts";

import type { CSSProperties, Ref, VNodeChild } from "vue";
import type { WrapClampItemKey, WrapClampItemSlotProps, WrapClampSlotProps } from "./types.ts";

type ElementRef = Ref<HTMLElement | null>;

type AffixPart = "before" | "after";
type AffixSlot<T> = ((props: WrapClampSlotProps<T>) => VNodeChild) | undefined;
type ItemSlot<T> = ((props: WrapClampItemSlotProps<T>) => VNodeChild) | undefined;

type ItemsOptions<T> = {
  itemKey: WrapClampItemKey<T> | undefined;
  items: readonly T[];
  itemSlot: ItemSlot<T>;
  renderedItemCount: number;
  visibleItemCount: number;
};

type RootOptions<T> = ItemsOptions<T> & {
  affixSlotProps: WrapClampSlotProps<T> | undefined;
  afterRef: ElementRef;
  afterSlot: AffixSlot<T>;
  attrs: Record<string, unknown>;
  beforeRef: ElementRef;
  beforeSlot: AffixSlot<T>;
  contentRef: ElementRef;
  rootRef: ElementRef;
  rootStyle: CSSProperties;
  rootTag: string;
};

function resolveItemKey<T>(
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

function appendAffixSlot<T>(
  children: VNodeChild[],
  part: AffixPart,
  slot: AffixSlot<T>,
  setRef: ElementRef,
  affixSlotProps: WrapClampSlotProps<T> | undefined,
): void {
  // Keep affix rendering in this helper; resize-heavy flows call it
  // often enough that a component boundary showed up in WrapClamp benchmarks.
  if (!slot || !affixSlotProps) {
    return;
  }

  const content = slot(affixSlotProps);
  if (!hasSlotContent(content)) {
    return;
  }

  children.push(
    h(
      "span",
      {
        "data-part": part,
        ref: setRef,
        style: itemStyle,
      },
      content,
    ),
  );
}

function appendItems<T>(
  children: VNodeChild[],
  { itemKey, items, itemSlot, renderedItemCount, visibleItemCount }: ItemsOptions<T>,
): void {
  const renderedCount = Math.min(items.length, renderedItemCount);

  for (let index = 0; index < renderedCount; index += 1) {
    const item = items[index] as T;
    const hidden = index >= visibleItemCount;

    children.push(
      h(
        "span",
        {
          "aria-hidden": trueOrUndefined(hidden),
          "data-part": "item",
          key: resolveItemKey(itemKey, item, index),
          style: hidden ? hiddenItemStyle : itemStyle,
        },
        itemSlot?.({
          item,
          index,
        }) ?? "",
      ),
    );
  }
}

export function renderRoot<T>({
  affixSlotProps,
  afterRef,
  afterSlot,
  attrs,
  beforeRef,
  beforeSlot,
  contentRef,
  itemKey,
  items,
  itemSlot,
  renderedItemCount,
  rootRef,
  rootStyle,
  rootTag,
  visibleItemCount,
}: RootOptions<T>): VNodeChild {
  const children: VNodeChild[] = [];

  appendAffixSlot(children, "before", beforeSlot, beforeRef, affixSlotProps);
  appendItems(children, {
    itemKey,
    items,
    itemSlot,
    renderedItemCount,
    visibleItemCount,
  });
  appendAffixSlot(children, "after", afterSlot, afterRef, affixSlotProps);

  return h(
    rootTag,
    mergeProps(attrs, {
      "data-part": "root",
      ref: rootRef,
      style: rootStyle,
    }),
    h(
      "span",
      {
        "data-part": "content",
        ref: contentRef,
        style: contentStyle,
      },
      children,
    ),
  );
}
