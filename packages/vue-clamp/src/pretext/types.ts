import type { ClampExposed } from "../types.ts";

export type LineClampExposed = ClampExposed;

export interface LineClampProps {
  as?: string;
  expanded?: boolean;
  font: string;
  maxLines?: number;
  text?: string;
}
