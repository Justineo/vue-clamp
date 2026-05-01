import { Comment, Fragment, Text, isVNode } from "vue";

import type { VNodeChild } from "vue";

// Slot wrappers affect measurement, so comment-only or whitespace-only slots
// must be treated as absent instead of rendering empty inline boxes.
export function hasSlotContent(value: VNodeChild | VNodeChild[] | undefined): boolean {
  if (Array.isArray(value)) {
    return value.some(hasSlotContent);
  }

  if (value == null || typeof value === "boolean") {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return true;
  }

  if (!isVNode(value)) {
    return false;
  }

  if (value.type === Comment) {
    return false;
  }

  if (value.type === Fragment) {
    return hasSlotContent(Array.isArray(value.children) ? value.children : undefined);
  }

  if (value.type === Text) {
    return hasSlotContent(value.children as VNodeChild);
  }

  return true;
}
