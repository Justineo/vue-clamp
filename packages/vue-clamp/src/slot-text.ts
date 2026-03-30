import { Comment, Fragment, Text } from "vue";
import type { VNode } from "vue";

function pushText(parts: string[], value: unknown): void {
  if (typeof value === "string" || typeof value === "number") {
    parts.push(String(value));
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      pushText(parts, item);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const node = value as VNode;
  if (node.type === Comment) {
    return;
  }

  if (node.type === Text) {
    pushText(parts, node.children);
    return;
  }

  if (node.type === Fragment) {
    pushText(parts, node.children);
    return;
  }

  pushText(parts, node.children);
}

export function collectText(nodes: readonly VNode[] | undefined): string {
  const parts: string[] = [];

  for (const node of nodes ?? []) {
    pushText(parts, node);
  }

  return parts.join("").trim();
}
