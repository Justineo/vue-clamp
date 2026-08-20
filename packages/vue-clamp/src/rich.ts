import { countLineBoxes, fitsContent, simpleLineFitFromStyle } from "./layout.ts";
import { findLastFittingIndex, richWarmExpansionLimit } from "./search.ts";
import { prepareText } from "./text.ts";

import type { ContentFitSample, SimpleLineFit, VisibleBoundsCache } from "./layout.ts";
import type { ClampBoundary, ClampLength } from "./types.ts";

// Rich clamping is structural rather than string-based. We parse once, measure
// candidate DOM fragments, and patch structural states back into visible/probe DOM.
export type RichBoundaryPoint = {
  readonly path: readonly number[];
  readonly offset: number;
};

type BoundaryPoint = RichBoundaryPoint;

export type PreparedRichTextNode = {
  readonly kind: "text";
  readonly endPoint: RichBoundaryPoint;
  readonly textCuts: readonly RichBoundaryPoint[];
  readonly fallbackTextCuts?: readonly RichBoundaryPoint[];
};

export type PreparedRichElementNode = {
  readonly kind: "element";
  readonly pathKey: string;
  readonly isBreak: boolean;
  readonly endPoint: RichBoundaryPoint;
  readonly children: readonly PreparedRichNode[];
};

export type PreparedRichNode = PreparedRichTextNode | PreparedRichElementNode;

type TextLogicalRun = {
  kind: "text";
  endPoint: BoundaryPoint;
  textCuts: readonly BoundaryPoint[];
  fallbackTextCuts?: readonly BoundaryPoint[];
};

type AtomicLogicalRun = {
  kind: "atomic";
  endPoint: BoundaryPoint;
};

type LogicalRun = TextLogicalRun | AtomicLogicalRun;

type RichLayoutInspection = {
  readonly atomicPaths: ReadonlySet<string>;
  readonly hasElements: boolean;
  readonly simpleLineFit?: SimpleLineFit;
  readonly simpleLineStyleKey?: string;
};

export type PreparedRich = {
  readonly boundary: ClampBoundary;
  readonly hasImages: boolean;
  readonly root: HTMLElement;
  readonly nodes: readonly PreparedRichNode[];
};

export type RichSearchIndex = {
  readonly body: HTMLElement;
  readonly hasElements: boolean;
  readonly prepared: PreparedRich;
  readonly rankPoints: readonly BoundaryPoint[] | null;
  readonly runs: readonly LogicalRun[];
  readonly simpleLineFit?: SimpleLineFit;
  readonly simpleLineStyleKey?: string;
};

type TextOnlySimpleLineFit = {
  readonly fit: SimpleLineFit;
  readonly styleKey: string;
};

// States are kept as structural points so width-only reclamps can patch from the
// previous DOM state without serializing and reparsing HTML.
export type RichState =
  | {
      readonly kind: "full";
    }
  | {
      readonly kind: "clamped";
      readonly point: RichBoundaryPoint;
    };

type BoundaryPosition = {
  containerPath: readonly number[];
  childIndex: number;
};

type PatchAnchor = {
  path: readonly number[];
  startIndex: number;
};

export type RichClampProbe = {
  readonly body: HTMLElement;
  readonly content: HTMLElement;
  readonly root: HTMLElement;
  readonly width: number;
};

export type RichClampOptions = {
  readonly ellipsis: string;
  readonly from: RichState | null;
  readonly hint: RichState | null;
  readonly lineLimit: number | undefined;
  readonly maxHeight: ClampLength | undefined;
  readonly prepared: PreparedRich;
  readonly preferHintedTextRun?: boolean;
  readonly probe: RichClampProbe;
  readonly searchIndex?: RichSearchIndex | null;
  readonly skipFullFit?: boolean;
  readonly verifyFullCandidate?: boolean;
};

export type RichClampResult = {
  readonly fallback: boolean;
  readonly rank?: number;
  readonly rankCount?: number;
  readonly searchIndex?: RichSearchIndex | null;
  readonly state: RichState | null;
  readonly textRankSafe?: boolean;
};

export type RichStateRank = {
  readonly rank: number;
  readonly rankCount: number;
  readonly textRankSafe: boolean;
};

function fallbackResult(state: RichState | null): RichClampResult {
  return {
    state,
    fallback: true,
    searchIndex: null,
  };
}

const ROOT_PATH: readonly number[] = [];
const ROOT_START_POINT: BoundaryPoint = {
  path: ROOT_PATH,
  offset: 0,
};
const FULL_STATE: RichState = {
  kind: "full",
};
// Probe images only need layout boxes. Replacing network sources prevents binary
// search candidate churn from triggering repeated image fetches.
const PROBE_IMAGE_SRC = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const activeProbeTag =
  /^(?:animate|animatemotion|animatetransform|audio|base|discard|embed|feimage|fieldset|fencedframe|form|foreignobject|iframe|image|input|link|marquee|meta|object|optgroup|option|output|picture|portal|script|select|set|source|style|textarea|track|use|video)$/u;
const unsafeProbeAttribute = /^(?:autofocus|form|id|is|name|usemap)$/u;
const svgNamespace = "http://www.w3.org/2000/svg";
const trailingWhitespace = /[\t\n\f\r ]+$/u;
const trailingWhitespaceEdge = /[\t\n\f\r ]$/u;

// Connected measurement necessarily duplicates DOM. Keep the supported source
// contract narrow enough that cloning cannot register custom-element lifecycle,
// duplicate document IDs/form owners, or activate an embedded resource. This is
// a guardrail for passive content, not an attempt to sanitize arbitrary HTML.
export function canSafelyCloneRichProbe(root: ParentNode | null): boolean {
  if (!root) {
    return true;
  }

  const elements =
    root instanceof Element
      ? [root, ...root.querySelectorAll("*")]
      : [...root.querySelectorAll("*")];

  for (const element of elements) {
    const tagName = element.localName.toLowerCase();
    if (tagName.includes("-") || activeProbeTag.test(tagName)) {
      return false;
    }

    if (
      tagName === "button" &&
      (element.getAttribute("type") ?? "submit").toLowerCase() !== "button"
    ) {
      return false;
    }

    for (const attribute of element.attributes) {
      const attributeName = attribute.name.toLowerCase();
      if (
        unsafeProbeAttribute.test(attributeName) ||
        attributeName.startsWith("on") ||
        (element.namespaceURI === svgNamespace &&
          (attributeName === "href" || attributeName === "xlink:href"))
      ) {
        return false;
      }
    }
  }

  return true;
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

function sameLineMetrics(style: CSSStyleDeclaration, base: CSSStyleDeclaration): boolean {
  return (
    style.fontSize === base.fontSize &&
    style.lineHeight === base.lineHeight &&
    style.verticalAlign === base.verticalAlign
  );
}

function lineMetricKey(style: CSSStyleDeclaration): string {
  return `${style.fontSize}|${style.lineHeight}|${style.verticalAlign}`;
}

function inspectLayout(
  root: HTMLElement,
  baseStyle = getComputedStyle(root),
): RichLayoutInspection | null {
  const atomicPaths = new Set<string>();
  let hasElements = false;
  const baseStyleKey = lineMetricKey(baseStyle);
  const simpleLineFit = simpleLineFitFromStyle(baseStyle);
  let canUseSimpleLineHeight =
    simpleLineFit !== undefined && baseStyle.verticalAlign === "baseline";

  function addAtomicPath(path: string): void {
    atomicPaths.add(path);
  }

  function walkChildren(container: Node, parentKey: string): boolean {
    const { childNodes: children } = container;

    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      if (!child || !(child instanceof Element)) {
        continue;
      }

      hasElements = true;
      const tagName = child.localName;
      const childKey = childPathKey(parentKey, index);

      if (tagName === "br" || tagName === "wbr") {
        // Break opportunities are inline-flow participants and are represented
        // as atomic runs later.
        canUseSimpleLineHeight = false;
        continue;
      }

      const style = getComputedStyle(child);
      const { display, float: floatValue, position } = style;
      const isAtomicInline = isAtomicInlineDisplay(display);

      if (display === "none") {
        // Hidden elements do not expose searchable text, but preserving them as
        // atomic structure keeps patch points aligned with the source tree.
        addAtomicPath(childKey);
        canUseSimpleLineHeight = false;
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
        addAtomicPath(childKey);
        canUseSimpleLineHeight = false;
        continue;
      }

      if (!isInlineWrapperDisplay(display)) {
        // Search can descend only through transparent inline wrappers; other
        // display types become unsupported to avoid changing layout semantics.
        return false;
      }

      const hasSimpleLineMetrics = sameLineMetrics(style, baseStyle);
      if (canUseSimpleLineHeight && !hasSimpleLineMetrics) {
        canUseSimpleLineHeight = false;
      }

      if (!walkChildren(child, childKey)) {
        return false;
      }
    }

    return true;
  }

  if (!walkChildren(root, "")) {
    return null;
  }

  return {
    atomicPaths,
    hasElements,
    ...(canUseSimpleLineHeight && simpleLineFit !== undefined
      ? { simpleLineFit, simpleLineStyleKey: baseStyleKey }
      : {}),
  };
}

function endPointForChild(path: readonly number[]): BoundaryPoint {
  const offset = path[path.length - 1] ?? 0;
  const parentPath = path.slice(0, -1);

  return {
    path: parentPath,
    offset: offset + 1,
  };
}

function boundaryPointsForOffsets(
  offsets: readonly number[],
  path: readonly number[],
): BoundaryPoint[] {
  const points: BoundaryPoint[] = [];

  for (let index = 1; index < offsets.length; index += 1) {
    points.push({
      path,
      offset: offsets[index]!,
    });
  }

  return points;
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

      const textCuts = boundaryPointsForOffsets(boundaryOffsets, childPath);
      const fallbackTextCuts = preparedText.fallbackBoundaryOffsets
        ? boundaryPointsForOffsets(preparedText.fallbackBoundaryOffsets, childPath)
        : undefined;

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

    const tagName = child.localName;

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
  let currentTextNodes: PreparedRichTextNode[] = [];

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

      const fallbackCuts = textNode.fallbackTextCuts;
      if (fallbackCuts) {
        for (const cut of fallbackCuts) {
          fallbackTextCuts.push(cut);
        }
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

function clonePatchFromAnchor(
  root: HTMLElement,
  anchor: PatchAnchor,
  endPoint: BoundaryPoint,
  imageSource?: string,
): DocumentFragment {
  const start = resolvePatchAnchor(root, anchor.path);
  const end = resolvePatchAnchor(root, endPoint.path);
  const range = document.createRange();
  range.setStart(start, Math.min(anchor.startIndex, start.childNodes.length));
  range.setEnd(
    end,
    Math.min(endPoint.offset, end instanceof Text ? end.data.length : end.childNodes.length),
  );
  const fragment = range.cloneContents();

  if (imageSource !== undefined) {
    // Rewrite detached image resources before the fragment is connected; rich
    // measurement only depends on their box, not the decoded image.
    for (const image of fragment.querySelectorAll("img")) {
      image.removeAttribute("srcset");
      image.removeAttribute("sizes");
      image.setAttribute("src", imageSource);
    }
  }

  return fragment;
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
      const nextText = leaf.data.replace(trailingWhitespace, "");
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

    if (leaf instanceof Element && leaf.localName === "wbr") {
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

function rootEllipsisNode(target: Node, ellipsis: string): Text | null {
  if (!ellipsis) {
    return null;
  }

  const lastChild = target.lastChild;

  return lastChild instanceof Text && lastChild.data === ellipsis ? lastChild : null;
}

function fullEndPoint(root: HTMLElement): BoundaryPoint {
  return {
    path: ROOT_PATH,
    offset: root.childNodes.length,
  };
}

function pointForState(root: HTMLElement, state: RichState): BoundaryPoint {
  return state.kind === "full" ? fullEndPoint(root) : state.point;
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

function samePath(left: readonly number[], right: readonly number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function compareBoundaryPoint(left: BoundaryPoint, right: BoundaryPoint): number {
  if (samePath(left.path, right.path)) {
    return Math.sign(left.offset - right.offset);
  }

  const sharedLength = Math.min(left.path.length, right.path.length);
  let index = 0;
  for (; index < sharedLength; index += 1) {
    const delta = left.path[index]! - right.path[index]!;
    if (delta !== 0) {
      return Math.sign(delta);
    }
  }

  if (index === left.path.length) {
    return left.offset <= (right.path[index] ?? 0) ? -1 : 1;
  }

  return right.offset <= (left.path[index] ?? 0) ? 1 : -1;
}

function wholePrefixBoundaryForPoint(
  root: HTMLElement,
  point: BoundaryPoint,
): BoundaryPoint | null {
  const node = resolvePath(root, point.path);
  let containerPath: number[];
  let boundaryOffset: number;

  if (node instanceof Text) {
    if (point.offset !== node.data.length) {
      return null;
    }

    containerPath = point.path.slice(0, -1);
    boundaryOffset = (point.path.at(-1) ?? 0) + 1;
  } else {
    containerPath = [...point.path];
    boundaryOffset = point.offset;
  }

  while (containerPath.length > 0) {
    const container = resolvePath(root, containerPath);
    if (!container || boundaryOffset !== container.childNodes.length) {
      break;
    }

    boundaryOffset = containerPath[containerPath.length - 1]! + 1;
    containerPath = containerPath.slice(0, -1);
  }

  return {
    path: containerPath,
    offset: boundaryOffset,
  };
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
  return left.offset === right.offset && samePath(left.path, right.path);
}

function sameState(left: RichState | null, right: RichState): boolean {
  if (!left || left.kind !== right.kind) {
    return false;
  }

  if (left.kind === "full") {
    return true;
  }

  return right.kind === "clamped" && sameBoundaryPoint(left.point, right.point);
}

function textPrefixForPoint(root: HTMLElement, point: BoundaryPoint): string | null {
  const node = resolvePath(root, point.path);
  if (node?.nodeType !== Node.TEXT_NODE) {
    return null;
  }

  const text = (node.textContent ?? "").slice(0, point.offset).replace(trailingWhitespace, "");

  // Generic structural patching trims trailing whitespace before appending the
  // root ellipsis; same-node patching can do the same without replacing siblings.
  return text.length > 0 ? text : null;
}

function patchSameTextCut(
  prepared: PreparedRich,
  target: HTMLElement,
  from: RichState | null,
  to: RichState,
  ellipsis: string,
): boolean {
  if (
    from?.kind !== "clamped" ||
    to.kind !== "clamped" ||
    !samePath(from.point.path, to.point.path)
  ) {
    return false;
  }

  const text = textPrefixForPoint(prepared.root, to.point);
  if (text === null) {
    return false;
  }

  const liveNode = resolvePath(target, to.point.path);
  if (!(liveNode instanceof Text) || (ellipsis !== "" && liveNode === target.lastChild)) {
    return false;
  }

  if (liveNode.data !== text) {
    liveNode.data = text;
  }

  return true;
}

function removeChildrenFrom(
  container: Node,
  startIndex: number,
  preservedLastChild?: Text | null,
): void {
  const preservesLastChild = preservedLastChild?.parentNode === container;

  while (container.childNodes.length > startIndex) {
    if (preservesLastChild && container.childNodes[startIndex] === preservedLastChild) {
      return;
    }

    const child =
      preservesLastChild && container.lastChild === preservedLastChild
        ? preservedLastChild.previousSibling
        : container.lastChild;
    if (!child) {
      return;
    }

    child.remove();
  }
}

function lastLeafIn(node: Node): Node {
  let current = node;

  while (current.lastChild) {
    current = current.lastChild;
  }

  return current;
}

function trailingLeafBeforeBoundary(root: HTMLElement, boundary: BoundaryPoint): Node | null {
  let path = boundary.path;
  let offset = boundary.offset;

  while (true) {
    const container = resolvePath(root, path);
    if (!container) {
      return null;
    }

    if (offset > 0) {
      const child = container.childNodes[offset - 1];
      return child ? lastLeafIn(child) : null;
    }

    if (path.length === 0) {
      return null;
    }

    offset = path[path.length - 1] ?? 0;
    path = path.slice(0, -1);
  }
}

function clampedPrefixBoundary(root: HTMLElement, boundary: BoundaryPoint): BoundaryPoint | null {
  let liveBoundary = boundary;

  if (boundary.path.length === 0) {
    let offset = boundary.offset;
    while (offset > 0) {
      const child = root.childNodes[offset - 1];

      if (child instanceof Text && child.data.replace(trailingWhitespace, "") === "") {
        offset -= 1;
        continue;
      }

      if (child instanceof Element && child.localName === "wbr") {
        offset -= 1;
        continue;
      }

      break;
    }

    if (offset !== boundary.offset) {
      liveBoundary = { path: ROOT_PATH, offset };
    }
  }

  const leaf = trailingLeafBeforeBoundary(root, liveBoundary);

  if (!leaf) {
    return liveBoundary;
  }

  if (leaf instanceof Element && leaf.localName === "wbr") {
    return null;
  }

  return leaf instanceof Text && trailingWhitespaceEdge.test(leaf.data) ? null : liveBoundary;
}

function removeAfterBoundary(
  root: HTMLElement,
  boundary: BoundaryPoint,
  preservedRootEllipsis?: Text | null,
): boolean {
  const container = resolvePath(root, boundary.path);
  if (!container || container.childNodes.length < boundary.offset) {
    return false;
  }

  removeChildrenFrom(container, boundary.offset, preservedRootEllipsis);

  for (let depth = boundary.path.length - 1; depth >= 0; depth -= 1) {
    const ancestor = resolvePath(root, boundary.path.slice(0, depth));
    if (!ancestor) {
      return false;
    }

    removeChildrenFrom(ancestor, boundary.path[depth]! + 1, preservedRootEllipsis);
  }

  return true;
}

function canRemoveAfterBoundary(root: HTMLElement, boundary: BoundaryPoint): boolean {
  const container = resolvePath(root, boundary.path);
  if (!container || container.childNodes.length < boundary.offset) {
    return false;
  }

  for (let depth = boundary.path.length - 1; depth >= 0; depth -= 1) {
    if (!resolvePath(root, boundary.path.slice(0, depth))) {
      return false;
    }
  }

  return true;
}

function appendPatchFragment(
  target: HTMLElement,
  liveAnchor: Node,
  fragment: DocumentFragment,
  to: RichState,
  ellipsis: string,
  existingEllipsis: Text | null,
): void {
  if (existingEllipsis && liveAnchor === target) {
    target.insertBefore(fragment, existingEllipsis);
  } else {
    liveAnchor.appendChild(fragment);
  }

  if (to.kind === "clamped" && !existingEllipsis) {
    appendEllipsis(target, ellipsis);
  }
}

function patchForwardWholePrefix(
  prepared: PreparedRich,
  target: HTMLElement,
  from: RichState | null,
  to: RichState,
  ellipsis: string,
  imageSource?: string,
): boolean {
  if (from?.kind !== "clamped") {
    return false;
  }

  const { root } = prepared;
  const sourceBoundary = wholePrefixBoundaryForPoint(root, from.point);

  if (!sourceBoundary) {
    return false;
  }

  const liveBoundary = clampedPrefixBoundary(root, sourceBoundary);
  if (!liveBoundary) {
    return false;
  }

  const nextPoint = pointForState(root, to);
  const anchor = patchAnchorFor(root, liveBoundary, nextPoint);
  if (!samePath(anchor.path, liveBoundary.path) || anchor.startIndex !== liveBoundary.offset) {
    return false;
  }

  const liveAnchor = resolvePath(target, liveBoundary.path);
  if (!liveAnchor) {
    return false;
  }

  const hasEllipsis =
    ellipsis !== "" && target.lastChild instanceof Text && target.lastChild.data === ellipsis;
  const expectedChildren =
    liveBoundary.path.length === 0 && hasEllipsis ? liveBoundary.offset + 1 : liveBoundary.offset;

  if (liveAnchor.childNodes.length !== expectedChildren) {
    return false;
  }

  const fragment = clonePatchFromAnchor(root, anchor, nextPoint, imageSource);
  const existingEllipsis = to.kind === "clamped" ? rootEllipsisNode(target, ellipsis) : null;

  if (to.kind === "full") {
    removeRootEllipsis(target, ellipsis);
  }
  if (to.kind === "clamped") {
    trimTrailingWhitespace(fragment);
  }

  appendPatchFragment(target, liveAnchor, fragment, to, ellipsis, existingEllipsis);

  return true;
}

function patchForwardTextPrefix(
  prepared: PreparedRich,
  target: HTMLElement,
  from: RichState | null,
  to: RichState,
  ellipsis: string,
  imageSource?: string,
): boolean {
  if (from?.kind !== "clamped") {
    return false;
  }

  const { root } = prepared;
  const sourceText = resolvePath(root, from.point.path);
  if (!(sourceText instanceof Text) || from.point.offset >= sourceText.data.length) {
    return false;
  }

  const sourceBoundary = wholePrefixBoundaryForPoint(root, {
    path: from.point.path,
    offset: sourceText.data.length,
  });
  if (!sourceBoundary) {
    return false;
  }

  const nextPoint = pointForState(root, to);
  if (compareBoundaryPoint(sourceBoundary, nextPoint) > 0) {
    return false;
  }

  const anchor = patchAnchorFor(root, sourceBoundary, nextPoint);
  if (!samePath(anchor.path, sourceBoundary.path) || anchor.startIndex !== sourceBoundary.offset) {
    return false;
  }

  const liveText = resolvePath(target, from.point.path);
  if (!(liveText instanceof Text)) {
    return false;
  }

  const rootEllipsis = rootEllipsisNode(target, ellipsis);
  const existingEllipsis = to.kind === "clamped" ? rootEllipsis : null;
  if (!removeAfterBoundary(target, sourceBoundary, rootEllipsis)) {
    return false;
  }
  if (to.kind === "full") {
    removeRootEllipsis(target, ellipsis);
  }

  liveText.data = sourceText.data;
  const liveAnchor = resolvePatchAnchor(target, anchor.path);
  const fragment = clonePatchFromAnchor(root, anchor, nextPoint, imageSource);
  if (to.kind === "clamped") {
    trimTrailingWhitespace(fragment);
  }

  appendPatchFragment(target, liveAnchor, fragment, to, ellipsis, existingEllipsis);

  return true;
}

function patchFullToClamped(
  prepared: PreparedRich,
  target: HTMLElement,
  from: RichState | null,
  to: RichState,
  ellipsis: string,
): boolean {
  if (from?.kind !== "full" || to.kind !== "clamped") {
    return false;
  }

  const { root } = prepared;
  const liveNode = resolvePath(target, to.point.path);

  if (liveNode instanceof Text) {
    const text = textPrefixForPoint(root, to.point);
    if (text === null) {
      return false;
    }

    const boundary = {
      path: to.point.path.slice(0, -1),
      offset: (to.point.path.at(-1) ?? 0) + 1,
    };
    if (!canRemoveAfterBoundary(target, boundary)) {
      return false;
    }

    liveNode.data = text;
    if (!removeAfterBoundary(target, boundary)) {
      return false;
    }
  } else if (!removeAfterBoundary(target, to.point)) {
    return false;
  }

  trimTrailingWhitespace(target);
  appendEllipsis(target, ellipsis);

  return true;
}

function patchBackwardWholePrefix(
  prepared: PreparedRich,
  target: HTMLElement,
  from: RichState | null,
  to: RichState,
  ellipsis: string,
): boolean {
  if (!from || to.kind !== "clamped") {
    return false;
  }

  const { root } = prepared;
  const sourceBoundary = wholePrefixBoundaryForPoint(root, to.point);
  if (!sourceBoundary) {
    return false;
  }

  const liveBoundary = clampedPrefixBoundary(root, sourceBoundary);
  if (!liveBoundary) {
    return false;
  }

  if (compareBoundaryPoint(liveBoundary, pointForState(root, from)) >= 0) {
    return false;
  }

  const trimmedPrefix = !sameBoundaryPoint(liveBoundary, sourceBoundary);
  const existingEllipsis = from.kind === "clamped" ? rootEllipsisNode(target, ellipsis) : null;
  if (existingEllipsis) {
    return removeAfterBoundary(target, liveBoundary, existingEllipsis);
  }

  removeRootEllipsis(target, ellipsis);
  if (!removeAfterBoundary(target, liveBoundary)) {
    return false;
  }

  if (!trimmedPrefix) {
    trimTrailingWhitespace(target);
  }
  appendEllipsis(target, ellipsis);

  return true;
}

function reusablePointForState(root: HTMLElement, state: RichState | null): BoundaryPoint {
  if (state?.kind !== "clamped") {
    return state ? pointForState(root, state) : ROOT_START_POINT;
  }

  const sourceBoundary = wholePrefixBoundaryForPoint(root, state.point);

  return sourceBoundary && !clampedPrefixBoundary(root, sourceBoundary)
    ? ROOT_START_POINT
    : state.point;
}

export function patchRich(
  prepared: PreparedRich,
  target: HTMLElement,
  from: RichState | null,
  to: RichState,
  ellipsis: string,
  imageSource?: string,
): RichState {
  if (sameState(from, to)) {
    // Avoid touching DOM when the search probes the same structural point again.
    return to;
  }

  if (patchSameTextCut(prepared, target, from, to, ellipsis)) {
    return to;
  }

  if (patchForwardTextPrefix(prepared, target, from, to, ellipsis, imageSource)) {
    return to;
  }

  if (patchForwardWholePrefix(prepared, target, from, to, ellipsis, imageSource)) {
    return to;
  }

  if (patchFullToClamped(prepared, target, from, to, ellipsis)) {
    return to;
  }

  if (patchBackwardWholePrefix(prepared, target, from, to, ellipsis)) {
    return to;
  }

  const { root } = prepared;
  const currentPoint = reusablePointForState(root, from);
  const nextPoint = pointForState(root, to);
  const anchor = patchAnchorFor(root, currentPoint, nextPoint);
  const fragment = clonePatchFromAnchor(root, anchor, nextPoint, imageSource);
  const existingEllipsis =
    from?.kind === "clamped" && to.kind === "clamped" ? rootEllipsisNode(target, ellipsis) : null;

  if (from?.kind === "clamped" && !existingEllipsis) {
    // The root-level ellipsis is outside the structural source tree, so remove it
    // before calculating the next source-derived suffix.
    removeRootEllipsis(target, ellipsis);
  }

  const liveAnchor = resolvePatchAnchor(target, anchor.path);

  removeChildrenFrom(liveAnchor, anchor.startIndex, existingEllipsis);

  if (to.kind === "clamped") {
    trimTrailingWhitespace(fragment);
  }

  // Ellipsis is deliberately appended to the rich body root, not inside the
  // innermost inline element, so source markup remains structurally intact.
  appendPatchFragment(target, liveAnchor, fragment, to, ellipsis, existingEllipsis);

  return to;
}

export function prepareRich(
  html: string,
  boundary: ClampBoundary = "grapheme",
): PreparedRich | null {
  if (typeof DOMParser === "undefined") {
    return null;
  }

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(html, "text/html");

  return {
    boundary,
    hasImages: documentNode.body.querySelector("img") !== null,
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

function addRankPoint(points: BoundaryPoint[], point: BoundaryPoint): void {
  if (boundaryPointIndex(points, point) === null) {
    points.push(point);
  }
}

function textRankPoints(run: TextLogicalRun, includeFallback: boolean): BoundaryPoint[] {
  if (!includeFallback || !run.fallbackTextCuts) {
    return run.textCuts.slice();
  }

  const points = [...run.textCuts, ...run.fallbackTextCuts].sort(compareBoundaryPoint);
  const unique: BoundaryPoint[] = [];

  for (const point of points) {
    addRankPoint(unique, point);
  }

  return unique;
}

function rankPointsForRuns(runs: readonly LogicalRun[], includeFallback = false): BoundaryPoint[] {
  const points = [ROOT_START_POINT];

  for (const run of runs) {
    if (run.kind === "atomic") {
      points.push(run.endPoint);
      continue;
    }

    if (!includeFallback) {
      for (const point of run.textCuts) {
        points.push(point);
      }
      continue;
    }

    for (const point of textRankPoints(run, true)) {
      addRankPoint(points, point);
    }
  }

  return points;
}

function rankForState(state: RichState, points: readonly BoundaryPoint[]): number | undefined {
  if (state.kind === "full") {
    return points.length;
  }

  return boundaryPointIndex(points, state.point) ?? undefined;
}

export function rankRichState(
  searchIndex: RichSearchIndex,
  state: RichState,
): RichStateRank | null {
  const points = rankPointsForRuns(searchIndex.runs, true);
  const rank = rankForState(state, points);

  return rank === undefined
    ? null
    : {
        rank,
        rankCount: points.length,
        textRankSafe: textRankSafeForState(state, searchIndex.runs, searchIndex.prepared.root),
      };
}

export function richStateForRank(searchIndex: RichSearchIndex, rank: number): RichState | null {
  if (!Number.isFinite(rank)) {
    return null;
  }

  const points = rankPointsForRuns(searchIndex.runs, true);
  const index = Math.floor(rank);
  if (index < 0 || index > points.length) {
    return null;
  }

  const state: RichState =
    index === points.length
      ? FULL_STATE
      : {
          kind: "clamped",
          point: points[index]!,
        };

  return state;
}

function canUseBodyOnlyLineFit(
  content: HTMLElement,
  body: HTMLElement,
  lineLimit: number | undefined,
  maxHeight: ClampLength | undefined,
): boolean {
  return (
    lineLimit !== undefined &&
    maxHeight === undefined &&
    content.childNodes.length === 1 &&
    content.firstChild === body
  );
}

function textOnlySimpleLineFit(
  inspection: RichLayoutInspection,
  runs: readonly LogicalRun[],
): TextOnlySimpleLineFit | null {
  if (
    inspection.simpleLineFit === undefined ||
    inspection.simpleLineStyleKey === undefined ||
    !runs.every((run) => run.kind === "text")
  ) {
    return null;
  }

  return {
    fit: inspection.simpleLineFit,
    styleKey: inspection.simpleLineStyleKey,
  };
}

function createSearchIndex(
  prepared: PreparedRich,
  body: HTMLElement,
  inspection = inspectLayout(body),
): RichSearchIndex | null {
  if (!inspection) {
    return null;
  }

  const runs = buildLogicalRuns(prepared.nodes, inspection.atomicPaths);
  const simpleLine = textOnlySimpleLineFit(inspection, runs);

  return {
    body,
    hasElements: inspection.hasElements,
    prepared,
    rankPoints: prepared.boundary === "word" ? rankPointsForRuns(runs) : null,
    runs,
    ...(simpleLine
      ? {
          simpleLineFit: simpleLine.fit,
          simpleLineStyleKey: simpleLine.styleKey,
        }
      : {}),
  };
}

function searchIndexWithSimpleLineFit(
  searchIndex: RichSearchIndex,
  simpleLineFit: SimpleLineFit | undefined,
  simpleLineStyleKey: string | undefined,
): RichSearchIndex {
  const {
    simpleLineFit: _simpleLineFit,
    simpleLineStyleKey: _simpleLineStyleKey,
    ...rest
  } = searchIndex;

  return simpleLineFit !== undefined && simpleLineStyleKey !== undefined
    ? {
        ...rest,
        simpleLineFit,
        simpleLineStyleKey,
      }
    : rest;
}

function textRunContainsPoint(run: TextLogicalRun, point: BoundaryPoint): boolean {
  if (boundaryPointIndex(run.textCuts, point) !== null) {
    return true;
  }

  return (
    run.fallbackTextCuts !== undefined && boundaryPointIndex(run.fallbackTextCuts, point) !== null
  );
}

function runHintForState(runs: readonly LogicalRun[], state: RichState | null): number | null {
  if (!state) {
    return null;
  }

  if (state.kind === "full") {
    // Full content corresponds to the last run end and is a good warm-start
    // point before a shrink.
    return runs.length - 1;
  }

  const { point } = state;

  for (let index = 0; index < runs.length; index += 1) {
    const run = runs[index]!;

    if (sameBoundaryPoint(run.endPoint, point)) {
      return index;
    }

    if (run.kind === "text" && textRunContainsPoint(run, point)) {
      // A cut inside this text run means the coarse run search should restart
      // from the previous complete run end.
      return Math.max(0, index - 1);
    }
  }

  return null;
}

function textRunIndexForPoint(runs: readonly LogicalRun[], point: BoundaryPoint): number | null {
  for (let index = 0; index < runs.length; index += 1) {
    const run = runs[index]!;

    if (run.kind === "text" && textRunContainsPoint(run, point)) {
      return index;
    }
  }

  return null;
}

function textPointHasContent(root: HTMLElement, point: BoundaryPoint): boolean {
  const node = resolvePath(root, point.path);

  return node instanceof Text && node.data.slice(0, point.offset).trim().length > 0;
}

function hasAtomicRunNeighbor(runs: readonly LogicalRun[], index: number): boolean {
  return runs[index - 1]?.kind === "atomic" || runs[index + 1]?.kind === "atomic";
}

function textRankSafeForState(
  state: RichState,
  runs: readonly LogicalRun[],
  root: HTMLElement,
): boolean {
  if (state.kind !== "clamped") {
    return false;
  }

  const runIndex = textRunIndexForPoint(runs, state.point);

  return (
    runIndex !== null &&
    (textPointHasContent(root, state.point) || !hasAtomicRunNeighbor(runs, runIndex))
  );
}

export function clampRich({
  ellipsis,
  from,
  hint,
  lineLimit,
  maxHeight,
  prepared,
  preferHintedTextRun,
  probe,
  searchIndex,
  skipFullFit = false,
  verifyFullCandidate = true,
}: RichClampOptions): RichClampResult {
  const { body, content, root, width } = probe;

  if (width <= 0) {
    // An unmeasurable probe cannot produce a trustworthy structural state.
    return {
      state: null,
      fallback: false,
    };
  }

  const visibleBoundsCache: VisibleBoundsCache | undefined =
    maxHeight === undefined ? undefined : {};
  let currentFit: { readonly fits: boolean; readonly state: RichState } | null = null;
  let nextSearchIndex =
    searchIndex?.prepared === prepared && searchIndex.body === body ? searchIndex : null;
  let state = from;
  let probeHint = hint;
  const probeImageSource = prepared.hasImages ? PROBE_IMAGE_SRC : undefined;
  let fullFitSample: ContentFitSample | undefined;
  const captureFullFit =
    hint === null && lineLimit !== undefined
      ? (sample: ContentFitSample) => {
          fullFitSample = sample;
        }
      : undefined;

  function applyFullCandidate(): void {
    state = patchRich(prepared, body, state, FULL_STATE, ellipsis, probeImageSource);
  }

  function applyCandidate(point: BoundaryPoint): void {
    state = patchRich(
      prepared,
      body,
      state,
      {
        kind: "clamped",
        point,
      },
      ellipsis,
      probeImageSource,
    );
  }

  function unrankedProbeResult(candidate: RichState | null): RichClampResult {
    return {
      fallback: false,
      searchIndex: nextSearchIndex,
      state: candidate,
    };
  }

  let checkedFullCandidate = false;

  function fitsFullCandidate(): boolean {
    if (currentFit && sameState(state, FULL_STATE) && sameState(currentFit.state, FULL_STATE)) {
      checkedFullCandidate = true;
      return currentFit.fits;
    }

    applyFullCandidate();
    checkedFullCandidate = true;

    const fits = fitsContent(
      root,
      content,
      lineLimit,
      maxHeight,
      true,
      visibleBoundsCache,
      simpleLineFit,
      captureFullFit,
    );

    currentFit = {
      fits,
      state: FULL_STATE,
    };

    return fits;
  }

  if (!nextSearchIndex) {
    applyFullCandidate();
    nextSearchIndex = createSearchIndex(prepared, body, inspectLayout(body));
  } else if (nextSearchIndex.hasElements) {
    // CSSOM cannot describe every context that affects descendant layout
    // (cross-origin rules, container queries, ancestor attributes, shadow
    // boundaries). Restore the full probe and inspect the browser's computed
    // result instead of treating a stylesheet fingerprint as proof.
    applyFullCandidate();
    currentFit = null;
    checkedFullCandidate = false;
    nextSearchIndex = createSearchIndex(prepared, body, inspectLayout(body));
  }

  if (!nextSearchIndex) {
    // Unsupported inline layout falls back to the original HTML instead of
    // risking a structurally valid but visually wrong clamp.
    return fallbackResult(state);
  }

  const canUseSimpleLineLayout = canUseBodyOnlyLineFit(content, body, lineLimit, maxHeight);
  let shouldSkipFullFit = skipFullFit;
  let simpleLineFit: SimpleLineFit | undefined;
  if (canUseSimpleLineLayout) {
    let nextSimpleLine: TextOnlySimpleLineFit | null = null;

    if (
      nextSearchIndex.hasElements &&
      nextSearchIndex.simpleLineFit !== undefined &&
      nextSearchIndex.simpleLineStyleKey !== undefined
    ) {
      // Element-bearing indexes were rebuilt from a full, freshly inspected
      // probe above, so their simple-line model is current for this pass.
      nextSimpleLine = {
        fit: nextSearchIndex.simpleLineFit,
        styleKey: nextSearchIndex.simpleLineStyleKey,
      };
    } else if (!nextSearchIndex.hasElements) {
      const currentBaseStyle = getComputedStyle(body);
      const currentSimpleLineFit =
        currentBaseStyle.verticalAlign === "baseline"
          ? simpleLineFitFromStyle(currentBaseStyle)
          : undefined;

      if (currentSimpleLineFit) {
        nextSimpleLine = {
          fit: currentSimpleLineFit,
          styleKey: lineMetricKey(currentBaseStyle),
        };
      }

      if (nextSimpleLine?.styleKey !== nextSearchIndex.simpleLineStyleKey) {
        nextSearchIndex = searchIndexWithSimpleLineFit(
          nextSearchIndex,
          nextSimpleLine?.fit,
          nextSimpleLine?.styleKey,
        );
      }
    }

    simpleLineFit = nextSimpleLine?.fit;
  }

  const { rankPoints, runs } = nextSearchIndex;

  if (!shouldSkipFullFit && fitsFullCandidate()) {
    // The full rich tree fits and its layout is safe for the rich search model.
    return unrankedProbeResult(state);
  }

  const fullLineCount = fullFitSample?.rects && countLineBoxes(fullFitSample.rects);
  if (
    probeHint === null &&
    lineLimit !== undefined &&
    fullLineCount !== undefined &&
    fullLineCount >= lineLimit * 3
  ) {
    let coldRankPoints = rankPoints ?? rankPointsForRuns(runs);
    if (coldRankPoints.length <= 16 && prepared.boundary === "word") {
      coldRankPoints = rankPointsForRuns(runs, true);
    }
    if (coldRankPoints.length > 16) {
      probeHint = {
        kind: "clamped",
        point:
          coldRankPoints[
            Math.min(
              coldRankPoints.length - 1,
              Math.max(0, Math.floor((coldRankPoints.length * lineLimit) / fullLineCount)),
            )
          ]!,
      };
    }
  }

  function fitsCandidate(endPoint: BoundaryPoint): boolean {
    const candidate: RichState = {
      kind: "clamped",
      point: endPoint,
    };
    if (currentFit && sameState(state, candidate) && sameState(currentFit.state, candidate)) {
      return currentFit.fits;
    }

    applyCandidate(endPoint);
    const fits = fitsContent(
      root,
      content,
      lineLimit,
      maxHeight,
      true,
      visibleBoundsCache,
      simpleLineFit,
    );

    currentFit = {
      fits,
      state: candidate,
    };

    return fits;
  }

  if (runs.length === 0) {
    // Rich content can be all comments/empty text; in that case the full patched
    // state is already the only meaningful answer.
    applyFullCandidate();
    return unrankedProbeResult(state);
  }

  function currentResult(): RichClampResult {
    if (!state || !rankPoints) {
      return unrankedProbeResult(state);
    }

    const stateRank = rankForState(state, rankPoints);
    if (stateRank === undefined) {
      return {
        fallback: false,
        searchIndex: nextSearchIndex,
        state,
        textRankSafe: false,
      };
    }

    return {
      fallback: false,
      rank: stateRank,
      rankCount: rankPoints.length,
      searchIndex: nextSearchIndex,
      state,
      textRankSafe: textRankSafeForState(state, runs, prepared.root),
    };
  }

  function clampedResult(point: BoundaryPoint): RichClampResult {
    if (shouldSkipFullFit && verifyFullCandidate && !checkedFullCandidate) {
      if (fitsFullCandidate()) {
        return currentResult();
      }
    }

    applyCandidate(point);
    return currentResult();
  }

  const useHintedTextRun = preferHintedTextRun !== undefined ? preferHintedTextRun : hint === from;
  let coarseHint = runHintForState(runs, probeHint);

  if (useHintedTextRun && probeHint?.kind === "clamped") {
    const hintedRunIndex = textRunIndexForPoint(runs, probeHint.point);

    if (hintedRunIndex !== null) {
      const hintedRun = runs[hintedRunIndex]!;

      if (hintedRun.kind === "text") {
        const fineHint = boundaryPointIndex(hintedRun.textCuts, probeHint.point);
        const runEndIndex = hintedRun.textCuts.length - 1;
        const fineIndex = findLastFittingIndex(
          hintedRun.textCuts.length,
          (index) => fitsCandidate(hintedRun.textCuts[index]!),
          fineHint,
          richWarmExpansionLimit,
        );

        if (fineIndex >= 0 && fineIndex < runEndIndex) {
          return clampedResult(hintedRun.textCuts[fineIndex]!);
        }

        if (fineIndex === runEndIndex) {
          const runEndPoint = hintedRun.textCuts[runEndIndex]!;
          const nextRun = runs[hintedRunIndex + 1];

          if (!nextRun) {
            if (fitsFullCandidate()) {
              return currentResult();
            }

            return clampedResult(runEndPoint);
          }

          // Adjacent searchable text is merged into this run, so the next unit is
          // normally atomic. If it fails, this run end is the best legal boundary.
          if (nextRun.kind === "atomic") {
            if (!fitsCandidate(nextRun.endPoint)) {
              return clampedResult(runEndPoint);
            }

            coarseHint = hintedRunIndex + 1;
          }
        }

        const fallbackTextCuts = hintedRun.fallbackTextCuts;
        if (fineIndex < 0 && fallbackTextCuts) {
          const fallbackHint = boundaryPointIndex(fallbackTextCuts, probeHint.point);
          const fallbackIndex = findLastFittingIndex(
            fallbackTextCuts.length,
            (index) => fitsCandidate(fallbackTextCuts[index]!),
            fallbackHint,
            richWarmExpansionLimit,
          );

          if (fallbackIndex >= 0 && fallbackIndex < fallbackTextCuts.length - 1) {
            return clampedResult(fallbackTextCuts[fallbackIndex]!);
          }
        }

        if (fineIndex < 0) {
          const coarsePoint =
            hintedRunIndex > 0 ? runs[hintedRunIndex - 1]!.endPoint : ROOT_START_POINT;
          if (fitsCandidate(coarsePoint)) {
            return clampedResult(coarsePoint);
          }
        }
      }
    }
  }

  const coarseSearchCount = runs.length + (shouldSkipFullFit ? 1 : 0);
  // Coarse search skips over complete logical runs first so refinement only has
  // to slice the one text run that crosses the fit boundary.
  const coarseIndex = findLastFittingIndex(
    coarseSearchCount,
    (index) => {
      if (index === runs.length) {
        return fitsFullCandidate();
      }

      return fitsCandidate(runs[index]!.endPoint);
    },
    coarseHint,
    richWarmExpansionLimit,
  );
  if (coarseIndex === runs.length) {
    return currentResult();
  }

  const coarsePoint = coarseIndex >= 0 ? runs[coarseIndex]!.endPoint : ROOT_START_POINT;
  const nextRun = runs[coarseIndex + 1];

  if (!nextRun || nextRun.kind === "atomic") {
    // If the next unit is atomic, there is no legal smaller slice after the
    // coarse point.
    return clampedResult(coarsePoint);
  }

  const fineHint =
    probeHint?.kind === "clamped" ? boundaryPointIndex(nextRun.textCuts, probeHint.point) : null;
  // Fine search is limited to text cuts inside the first overflowing text run.
  const fineIndex = findLastFittingIndex(
    nextRun.textCuts.length,
    (index) => fitsCandidate(nextRun.textCuts[index]!),
    fineHint,
    richWarmExpansionLimit,
  );
  let finePoint = fineIndex >= 0 ? nextRun.textCuts[fineIndex]! : coarsePoint;

  const fallbackTextCuts = nextRun.fallbackTextCuts;
  if (fineIndex < 0 && fallbackTextCuts) {
    // Word boundary mode retries with grapheme cuts only when no whole-word cut
    // in the overflowing run can fit.
    const fallbackHint =
      probeHint?.kind === "clamped" ? boundaryPointIndex(fallbackTextCuts, probeHint.point) : null;
    const fallbackIndex = findLastFittingIndex(
      fallbackTextCuts.length,
      (index) => fitsCandidate(fallbackTextCuts[index]!),
      fallbackHint,
      richWarmExpansionLimit,
    );
    finePoint = fallbackIndex >= 0 ? fallbackTextCuts[fallbackIndex]! : coarsePoint;
  }

  return clampedResult(finePoint);
}
