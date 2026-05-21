import type { ClampProps } from "../types.ts";

export interface InlineClampParts {
  start?: string;
  body: string;
  end?: string;
}

export type InlineClampSplit = (text: string) => InlineClampParts;

export interface InlineClampProps extends Pick<
  ClampProps,
  "as" | "ellipsis" | "location" | "boundary"
> {
  text: string;
  split?: InlineClampSplit;
}
