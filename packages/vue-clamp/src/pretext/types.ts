import type { ClampExposed } from "../types.ts";

export type LineClampExposed = ClampExposed;

export interface LineClampProps {
  as?: string;
  expanded?: boolean;
  font: string;
  inlineSize?: number;
  maxLines?: number;
  text?: string;
}
