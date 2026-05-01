import { fitsContent } from "./layout.ts";
import { findLastFittingIndex } from "./search.ts";
import { prepareText } from "./text.ts";

import type { ClampBoundary } from "./types.ts";

// Rich clamping is structural rather than string-based. We parse once, measure
// candidate DOM fragments, and patch decisions back into the visible/probe DOM.
type BoundaryPoint = {
  path: readonly number[];
  offset: number;
};

type PreparedTextNode = {
  kind: "text";
  endPoint: BoundaryPoint;
  textCuts: BoundaryPoint[];
  fallbackTextCuts?: BoundaryPoint[];
};

type PreparedElementNode = {
  kind: "element";
  pathKey: string;
  isBreak: boolean;
  endPoint: BoundaryPoint;
  children: PreparedRichNode[];
};

type PreparedRichNode = PreparedTextNode | PreparedElementNode;

type LogicalRun =
  | {
      kind: "text";
      endPoint: BoundaryPoint;
      textCuts: BoundaryPoint[];
      fallbackTextCuts?: BoundaryPoint[];
    }
  | {
      kind: "atomic";
      endPoint: BoundaryPoint;
    };

export type PreparedRichText = {
  root: HTMLElement;
  nodes: PreparedRichNode[];
};

// Decisions are kept as structural points so width-only reclamps can patch from
// the previous DOM state without serializing and reparsing HTML.
export type RichClampDecision =
  | {
      kind: "full";
    }
  | {
      kind: "clamped";
      point: BoundaryPoint;
    };

type BoundaryPosition = {
  containerPath: readonly number[];
  childIndex: number;
};

type PatchAnchor = {
  path: readonly number[];
  startIndex: number;
};

type RichClampResult = {
  decision: RichClampDecision | null;
  fallback: boolean;
};

const ROOT_PATH: readonly number[] = [];
const ROOT_START_POINT: BoundaryPoint = {
  path: ROOT_PATH,
  offset: 0,
};
// Probe images only need layout boxes. Replacing network sources prevents binary
// search candidate churn from triggering repeated image fetches.
const PROBE_IMAGE_SRC = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

function tagNameFor(element: Element): string {
  return element.tagName.toLowerCase();
}

function pathKey(path: readonly number[]): string {
  return path.join(".");
}

function childPathKey(parentKey: string, index: number): string {
  return parentKey ? `${parentKey}.${index}` : `${index}`;
}

function isAtomicInlineDisplay(display: string): boolean {
  return display.startsWith("inline-") && display !== "inline";
}

function isInlineWrapperDisplay(display: string): boolean {
  return display === "inline" || display === "contents";
}

function inspectLayout(root: HTMLElement): Set<string> | null {
  const atomicPaths = new Set<string>();

  function walkChildren(container: Node, parentKey: string): boolean {
    const { childNodes: children } = container;

    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      if (!child || !(child instanceof Element)) {
        continue;
      }

      const tagName = tagNameFor(child);
      const childKey = childPathKey(parentKey, index);

      if (tagName === "br" || tagName === "wbr") {
        // Break opportunities are inline-flow participants and are represented
        // as atomic runs later.
        continue;
      }

      const { display, float: floatValue, position } = getComputedStyle(child);
      const isAtomicInline = isAtomicInlineDisplay(display);

      if (display === "none") {
        // Hidden elements do not expose searchable text, but preserving them as
        // atomic structure keeps patch points aligned with the source tree.
        atomicPaths.add(childKey);
        continue;
      }

      if (
        position === "absolute" ||
        position === "fixed" ||
        position === "sticky" ||
        floatValue !== "none"
      ) {
        // Out-of-flow descendants break the monotonic inline measurement model:
        // truncating earlier does not necessarily make layout smaller.
        return false;
      }

      if (
        tagName === "img" ||
        tagName === "svg" ||
        child.childNodes.length === 0 ||
        isAtomicInline
      ) {
        if (display !== "inline" && !isAtomicInline) {
          // Non-inline leaf boxes can affect block layout in ways the rich
          // inline algorithm is not designed to slice.
          return false;
        }

        // Atomic inline boxes can be kept or removed as a unit, but their
        // internals are not searchable.
        atomicPaths.add(childKey);
        continue;
      }

      if (!isInlineWrapperDisplay(display)) {
        // Search can descend only through transparent inline wrappers; other
        // display types become unsupported to avoid changing layout semantics.
        return false;
      }

      if (!walkChildren(child, childKey)) {
        return false;
      }
    }

    return true;
  }

  return walkChildren(root, "") ? atomicPaths : null;
}

function endPointForChild(path: readonly number[]): BoundaryPoint {
  const offset = path[path.length - 1] ?? 0;
  const parentPath = path.slice(0, -1);

  return {
    path: parentPath,
    offset: offset + 1,
  };
}

function buildPreparedRichNodes(
  container: ParentNode & Node,
  path: readonly number[],
  boundary: ClampBoundary,
): PreparedRichNode[] {
  const nodes: PreparedRichNode[] = [];
  const children = container.childNodes;

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (!child || child.nodeType === Node.COMMENT_NODE) {
      continue;
    }

    const childPath = [...path, index];

    if (child.nodeType === Node.TEXT_NODE) {
      // Text nodes keep both configured boundary cuts and optional grapheme
      // fallback cuts so word mode can recover inside a single long word.
      const preparedText = prepareText(child.textContent ?? "", boundary);
      const { boundaryOffsets, text } = preparedText;

      if (boundaryOffsets.length <= 1) {
        continue;
      }

      const textCuts: BoundaryPoint[] = [];
      for (let boundaryIndex = 1; boundaryIndex < boundaryOffsets.length; boundaryIndex += 1) {
        const offset = boundaryOffsets[boundaryIndex];
        if (offset === undefined) {
          continue;
        }

        textCuts.push({
          path: childPath,
          offset,
        });
      }

      const fallbackTextCuts = preparedText.fallbackBoundaryOffsets?.slice(1).map((offset) => ({
        path: childPath,
        offset,
      }));

      nodes.push({
        kind: "text",
        endPoint: {
          path: childPath,
          offset: text.length,
        },
        textCuts,
        ...(fallbackTextCuts && fallbackTextCuts.length > 0 ? { fallbackTextCuts } : {}),
      });
      continue;
    }

    if (!(child instanceof Element)) {
      continue;
    }

    const tagName = tagNameFor(child);

    nodes.push({
      kind: "element",
      pathKey: pathKey(childPath),
      isBreak: tagName === "br" || tagName === "wbr",
      endPoint: endPointForChild(childPath),
      children: buildPreparedRichNodes(child, childPath, boundary),
    });
  }

  return nodes;
}

function buildLogicalRuns(
  nodes: readonly PreparedRichNode[],
  atomicPaths: ReadonlySet<string>,
): LogicalRun[] {
  const runs: LogicalRun[] = [];
  let currentTextNodes: PreparedTextNode[] = [];

  function flushTextRun(): void {
    if (currentTextNodes.length === 0) {
      return;
    }

    const { endPoint } = currentTextNodes[currentTextNodes.length - 1]!;
    const textCuts: BoundaryPoint[] = [];
    const fallbackTextCuts: BoundaryPoint[] = [];

    for (const textNode of currentTextNodes) {
      for (const cut of textNode.textCuts) {
        textCuts.push(cut);
      }

      for (const cut of textNode.fallbackTextCuts ?? []) {
        fallbackTextCuts.push(cut);
      }
    }

    // Adjacent searchable text across inline wrappers is one monotonic run. The
    // search first chooses a run, then refines only inside the next text run.
    runs.push({
      kind: "text",
      endPoint,
      textCuts,
      ...(fallbackTextCuts.length > 0 ? { fallbackTextCuts } : {}),
    });

    currentTextNodes = [];
  }

  function walkNodes(nextNodes: readonly PreparedRichNode[]): void {
    for (const node of nextNodes) {
      if (node.kind === "text") {
        currentTextNodes.push(node);
        continue;
      }

      const { children, endPoint, isBreak, pathKey } = node;

      if (isBreak || atomicPaths.has(pathKey)) {
        // Breaks and atomic inline boxes split text runs because they can only be
        // included or excluded as complete units.
        flushTextRun();
        runs.push({
          kind: "atomic",
          endPoint,
        });
        continue;
      }

      walkNodes(children);
    }
  }

  walkNodes(nodes);
  flushTextRun();

  return runs;
}

function cloneElementForPatch(element: Element, imageSource?: string): Element {
  if (imageSource !== undefined && element instanceof HTMLImageElement) {
    // Probe clones preserve sizing-related attributes but swap the resource URL
    // because fit measurement depends on the image box, not decoded pixels.
    const clone = document.createElement("img");

    for (const attr of element.attributes) {
      if (attr.name === "src" || attr.name === "srcset" || attr.name === "sizes") {
        continue;
      }

      clone.setAttribute(attr.name, attr.value);
    }

    clone.setAttribute("src", imageSource);
    return clone;
  }

  return element.cloneNode(false) as Element;
}

function cloneNodeForPatch(node: Node, imageSource?: string): Node {
  if (!(node instanceof Element)) {
    return node.cloneNode(true);
  }

  const clone = cloneElementForPatch(node, imageSource);

  for (const child of node.childNodes) {
    clone.appendChild(cloneNodeForPatch(child, imageSource));
  }

  return clone;
}

function clonePatchFromContainer(
  container: Node,
  startIndex: number,
  endPoint: BoundaryPoint,
  depth: number,
  imageSource?: string,
): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const { childNodes: children } = container;
  const { offset, path } = endPoint;

  if (depth === path.length) {
    // Once the anchor container is reached, copy only the requested sibling
    // prefix/suffix so unchanged leading DOM is not recreated.
    const limit = Math.min(offset, children.length);

    for (let index = startIndex; index < limit; index += 1) {
      const child = children[index];
      if (child) {
        fragment.appendChild(cloneNodeForPatch(child, imageSource));
      }
    }

    return fragment;
  }

  const targetIndex = path[depth] ?? 0;
  const limit = Math.min(targetIndex, children.length);

  for (let index = startIndex; index < limit; index += 1) {
    const child = children[index];
    if (child) {
      fragment.appendChild(cloneNodeForPatch(child, imageSource));
    }
  }

  if (targetIndex < startIndex) {
    return fragment;
  }

  const targetChild = children[targetIndex];
  if (!targetChild) {
    return fragment;
  }

  if (targetChild.nodeType === Node.TEXT_NODE) {
    // A text boundary point slices the target text node; all previous siblings
    // were already copied above.
    const nextText = (targetChild.textContent ?? "").slice(0, endPoint.offset);
    if (nextText) {
      fragment.appendChild(document.createTextNode(nextText));
    }

    return fragment;
  }

  if (!(targetChild instanceof Element)) {
    return fragment;
  }

  const childClone = cloneElementForPatch(targetChild, imageSource);
  const childPatch = clonePatchFromContainer(targetChild, 0, endPoint, depth + 1, imageSource);

  childClone.appendChild(childPatch);
  fragment.appendChild(childClone);

  return fragment;
}

function clonePatchFromAnchor(
  root: HTMLElement,
  anchor: PatchAnchor,
  endPoint: BoundaryPoint,
  imageSource?: string,
): DocumentFragment {
  const sourceAnchor = resolvePatchAnchor(root, anchor.path);

  return clonePatchFromContainer(
    sourceAnchor,
    anchor.startIndex,
    endPoint,
    anchor.path.length,
    imageSource,
  );
}

function trailingLeaf(root: Node): Node | null {
  let current = root.lastChild;

  while (current?.lastChild) {
    current = current.lastChild;
  }

  return current ?? null;
}

function trimTrailingWhitespace(root: Node): void {
  while (true) {
    const leaf = trailingLeaf(root);
    if (!leaf) {
      return;
    }

    if (leaf instanceof Text) {
      // The ellipsis is appended at the rich body root. Trimming the fragment
      // keeps it visually adjacent without inserting it inside inline markup.
      const nextText = leaf.data.replace(/[\t\n\f\r ]+$/u, "");
      if (nextText === leaf.data) {
        return;
      }

      if (nextText) {
        leaf.data = nextText;
        return;
      }

      leaf.remove();
      continue;
    }

    if (leaf instanceof Element && leaf.tagName.toLowerCase() === "wbr") {
      leaf.remove();
      continue;
    }

    return;
  }
}

function appendEllipsis(target: Node, ellipsis: string): void {
  if (!ellipsis) {
    return;
  }

  target.appendChild(document.createTextNode(ellipsis));
}

function removeRootEllipsis(target: Node, ellipsis: string): void {
  if (!ellipsis) {
    return;
  }

  const lastChild = target.lastChild;
  if (lastChild instanceof Text && lastChild.data === ellipsis) {
    // Only remove the root-level ellipsis that this module appended; identical
    // text inside source markup should remain untouched.
    lastChild.remove();
  }
}

function fullEndPoint(root: HTMLElement): BoundaryPoint {
  return {
    path: ROOT_PATH,
    offset: root.childNodes.length,
  };
}

function endPointForDecision(root: HTMLElement, decision: RichClampDecision): BoundaryPoint {
  return decision.kind === "full" ? fullEndPoint(root) : decision.point;
}

function resolvePath(root: Node, path: readonly number[]): Node | null {
  let current: Node | null = root;

  for (const index of path) {
    current = current?.childNodes[index] ?? null;
  }

  return current;
}

function resolvePatchAnchor(root: Node, path: readonly number[]): Node {
  const node = resolvePath(root, path);
  if (!node) {
    throw new Error("Expected rich patch anchor.");
  }

  return node;
}

function boundaryPosition(root: HTMLElement, point: BoundaryPoint): BoundaryPosition {
  const node = resolvePath(root, point.path);

  if (node?.nodeType === Node.TEXT_NODE) {
    // Text offsets refer inside a child node, so patching starts at that text
    // node's index within its parent.
    return {
      containerPath: point.path.slice(0, -1),
      childIndex: point.path.at(-1) ?? 0,
    };
  }

  return {
    containerPath: point.path,
    childIndex: point.offset,
  };
}

function sharedPath(left: readonly number[], right: readonly number[]): readonly number[] {
  const length = Math.min(left.length, right.length);
  const path: number[] = [];

  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) {
      break;
    }

    path.push(left[index]!);
  }

  return path;
}

function childIndexInAncestor(position: BoundaryPosition, ancestorPath: readonly number[]): number {
  return position.containerPath.length === ancestorPath.length
    ? position.childIndex
    : (position.containerPath[ancestorPath.length] ?? 0);
}

function patchAnchorFor(
  root: HTMLElement,
  currentPoint: BoundaryPoint,
  nextPoint: BoundaryPoint,
): PatchAnchor {
  const current = boundaryPosition(root, currentPoint);
  const next = boundaryPosition(root, nextPoint);
  // Patching from the shared ancestor keeps stable prefixes alive, which matters
  // for rich descendants such as images and custom inline elements.
  const path = sharedPath(current.containerPath, next.containerPath);

  return {
    path,
    startIndex: Math.min(childIndexInAncestor(current, path), childIndexInAncestor(next, path)),
  };
}

function sameBoundaryPoint(left: BoundaryPoint, right: BoundaryPoint): boolean {
  return left.offset === right.offset && pathKey(left.path) === pathKey(right.path);
}

function sameDecision(left: RichClampDecision | null, right: RichClampDecision): boolean {
  if (!left || left.kind !== right.kind) {
    return false;
  }

  if (left.kind === "full") {
    return true;
  }

  return right.kind === "clamped" && sameBoundaryPoint(left.point, right.point);
}

function removeChildrenFrom(container: Node, startIndex: number): void {
  while (container.childNodes.length > startIndex) {
    container.lastChild?.remove();
  }
}

export function patchRichTextToDecision(
  prepared: PreparedRichText,
  targetElement: HTMLElement,
  currentDecision: RichClampDecision | null,
  nextDecision: RichClampDecision,
  ellipsis: string,
  imageSource?: string,
): RichClampDecision {
  if (sameDecision(currentDecision, nextDecision)) {
    // Avoid touching DOM when the search probes the same structural point again.
    return nextDecision;
  }

  const { root } = prepared;
  const currentPoint = currentDecision
    ? endPointForDecision(root, currentDecision)
    : ROOT_START_POINT;
  const nextPoint = endPointForDecision(root, nextDecision);
  const anchor = patchAnchorFor(root, currentPoint, nextPoint);
  const fragment = clonePatchFromAnchor(root, anchor, nextPoint, imageSource);

  if (currentDecision?.kind === "clamped") {
    // The root-level ellipsis is outside the structural source tree, so remove it
    // before calculating the next source-derived suffix.
    removeRootEllipsis(targetElement, ellipsis);
  }

  const liveAnchor = resolvePatchAnchor(targetElement, anchor.path);

  removeChildrenFrom(liveAnchor, anchor.startIndex);

  if (nextDecision.kind === "clamped") {
    trimTrailingWhitespace(fragment);
  }

  liveAnchor.appendChild(fragment);

  if (nextDecision.kind === "clamped") {
    // Ellipsis is deliberately appended to the rich body root, not inside the
    // innermost inline element, so source markup remains structurally intact.
    appendEllipsis(targetElement, ellipsis);
  }

  return nextDecision;
}

export function prepareRichText(
  html: string,
  boundary: ClampBoundary = "grapheme",
): PreparedRichText | null {
  if (typeof DOMParser === "undefined") {
    return null;
  }

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(html, "text/html");

  return {
    root: documentNode.body,
    nodes: buildPreparedRichNodes(documentNode.body, ROOT_PATH, boundary),
  };
}

function boundaryPointIndex(points: readonly BoundaryPoint[], point: BoundaryPoint): number | null {
  for (let index = 0; index < points.length; index += 1) {
    if (sameBoundaryPoint(points[index]!, point)) {
      return index;
    }
  }

  return null;
}

function runIndexHintForDecision(
  runs: readonly LogicalRun[],
  decision: RichClampDecision | null,
): number | null {
  if (!decision) {
    return null;
  }

  if (decision.kind === "full") {
    // Full content corresponds to the last run end and is a good warm-start
    // point before a shrink.
    return runs.length - 1;
  }

  const { point } = decision;

  for (let index = 0; index < runs.length; index += 1) {
    const run = runs[index]!;

    if (sameBoundaryPoint(run.endPoint, point)) {
      return index;
    }

    if (
      run.kind === "text" &&
      (boundaryPointIndex(run.textCuts, point) !== null ||
        boundaryPointIndex(run.fallbackTextCuts ?? [], point) !== null)
    ) {
      // A cut inside this text run means the coarse run search should restart
      // from the previous complete run end.
      return Math.max(0, index - 1);
    }
  }

  return null;
}

export function clampRichTextToLayout(
  prepared: PreparedRichText,
  rootElement: HTMLElement,
  contentElement: HTMLElement,
  richElement: HTMLElement,
  currentDecision: RichClampDecision | null,
  searchDecision: RichClampDecision | null,
  ellipsis: string,
  lineLimit: number | undefined,
  maxHeight: number | string | undefined,
): RichClampResult {
  const { nodes } = prepared;

  if (rootElement.getBoundingClientRect().width <= 0) {
    // An unmeasurable probe cannot produce a trustworthy structural decision.
    return {
      decision: null,
      fallback: false,
    };
  }

  let decision = patchRichTextToDecision(
    prepared,
    richElement,
    currentDecision,
    { kind: "full" },
    ellipsis,
    PROBE_IMAGE_SRC,
  );

  function applyCandidate(point: BoundaryPoint): void {
    decision = patchRichTextToDecision(
      prepared,
      richElement,
      decision,
      {
        kind: "clamped",
        point,
      },
      ellipsis,
      PROBE_IMAGE_SRC,
    );
  }

  function fitsCandidate(endPoint: BoundaryPoint): boolean {
    applyCandidate(endPoint);
    return fitsContent(rootElement, contentElement, lineLimit, maxHeight);
  }

  const atomicPaths = inspectLayout(richElement);
  if (!atomicPaths) {
    // Unsupported inline layout falls back to the original HTML instead of
    // risking a structurally valid but visually wrong clamp.
    return {
      decision,
      fallback: true,
    };
  }

  if (fitsContent(rootElement, contentElement, lineLimit, maxHeight)) {
    // The full rich tree fits; exit before logical-run construction because no
    // searchable candidate is needed.
    return {
      decision,
      fallback: false,
    };
  }

  const runs = buildLogicalRuns(nodes, atomicPaths);
  if (runs.length === 0) {
    // Rich content can be all comments/empty text; in that case the full patched
    // state is already the only meaningful answer.
    return {
      decision,
      fallback: false,
    };
  }

  const coarseHint = runIndexHintForDecision(runs, searchDecision);
  // Coarse search skips over complete logical runs first so refinement only has
  // to slice the one text run that crosses the fit boundary.
  const coarseIndex = findLastFittingIndex(
    runs.length,
    (index) => fitsCandidate(runs[index]!.endPoint),
    coarseHint === null ? null : { index: coarseHint },
  );
  const coarsePoint = coarseIndex >= 0 ? runs[coarseIndex]!.endPoint : ROOT_START_POINT;
  const nextRun = runs[coarseIndex + 1];

  if (!nextRun || nextRun.kind === "atomic") {
    // If the next unit is atomic, there is no legal smaller slice after the
    // coarse point.
    applyCandidate(coarsePoint);
    return {
      decision,
      fallback: false,
    };
  }

  const fineHint =
    searchDecision?.kind === "clamped"
      ? boundaryPointIndex(nextRun.textCuts, searchDecision.point)
      : null;
  // Fine search is limited to text cuts inside the first overflowing text run.
  const fineIndex = findLastFittingIndex(
    nextRun.textCuts.length,
    (index) => fitsCandidate(nextRun.textCuts[index]!),
    fineHint === null ? null : { index: fineHint },
  );
  let finePoint = fineIndex >= 0 ? nextRun.textCuts[fineIndex]! : coarsePoint;

  if (fineIndex < 0 && nextRun.fallbackTextCuts) {
    // Word boundary mode retries with grapheme cuts only when no whole-word cut
    // in the overflowing run can fit.
    const fallbackHint =
      searchDecision?.kind === "clamped"
        ? boundaryPointIndex(nextRun.fallbackTextCuts, searchDecision.point)
        : null;
    const fallbackIndex = findLastFittingIndex(
      nextRun.fallbackTextCuts.length,
      (index) => fitsCandidate(nextRun.fallbackTextCuts![index]!),
      fallbackHint === null ? null : { index: fallbackHint },
    );
    finePoint = fallbackIndex >= 0 ? nextRun.fallbackTextCuts[fallbackIndex]! : coarsePoint;
  }

  applyCandidate(finePoint);
  return {
    decision,
    fallback: false,
  };
}
