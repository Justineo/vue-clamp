import { prepareRich } from "../rich.ts";

import type { PreparedRich } from "../rich.ts";
import type { ClampBoundary } from "../types.ts";

// Prepared source DOM is inert and only read by the patcher. Share at most one
// bounded source; connected trees, CSS inspection, and clamp results stay local.
let lastHtml = "";
let lastPrepared: PreparedRich | null = null;

export function prepareSharedRich(html: string, boundary: ClampBoundary): PreparedRich | null {
  if (lastPrepared && lastHtml === html && lastPrepared.boundary === boundary) {
    return lastPrepared;
  }

  const prepared = prepareRich(html, boundary);
  lastPrepared = html.length <= 8192 ? prepared : null;
  lastHtml = lastPrepared ? html : "";
  return prepared;
}
