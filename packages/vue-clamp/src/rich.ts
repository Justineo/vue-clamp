import { fitsContent, simpleLineFitFromStyle } from "./layout.ts";
import { findLastFittingIndex, richWarmExpansionLimit } from "./search.ts";
import { prepareText } from "./text.ts";

import type { SimpleLineFit, VisibleBoundsCache } from "./layout.ts";
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
  readonly atomicPathSignature: string;
  readonly atomicPaths: ReadonlySet<string>;
  readonly hasElements: boolean;
  readonly hasStyleDependentDisplay: boolean;
  readonly hasStyleDependentLineMetrics: boolean;
  readonly inheritsLineMetrics: boolean;
  readonly simpleLineFit?: SimpleLineFit;
  readonly simpleLineStyleKey?: string;
};

export type PreparedRich = {
  readonly boundary: ClampBoundary;
  readonly root: HTMLElement;
  readonly nodes: readonly PreparedRichNode[];
};

export type RichSearchIndex = {
  readonly atomicPathSignature: string;
  readonly body: HTMLElement;
  readonly hasElements: boolean;
  readonly hasStyleDependentDisplay: boolean;
  readonly hasStyleDependentLineMetrics: boolean;
  readonly prepared: PreparedRich;
  readonly rankPoints: readonly BoundaryPoint[] | null;
  readonly runs: readonly LogicalRun[];
  readonly inheritsLineMetrics: boolean;
  readonly simpleLineFit?: SimpleLineFit;
  readonly simpleLineStyleKey?: string;
  readonly styleSheetSignature: string;
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
  // Only width-only reclamps may reuse line fit after root metrics change;
  // descendant mutations need full inspection.
  readonly reuseSimpleLineFit?: boolean;
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

function unrankedResult(
  state: RichState | null,
  searchIndex: RichSearchIndex | null,
): RichClampResult {
  return {
    fallback: false,
    searchIndex,
    state,
  };
}

function fallbackResult(state: RichState | null): RichClampResult {
  return {
    state,
    fallback: true,
    searchIndex: null,
  };
}

function unsafeRankResult(state: RichState, searchIndex: RichSearchIndex | null): RichClampResult {
  return {
    fallback: false,
    searchIndex,
    state,
    textRankSafe: false,
  };
}

function rankedResult(
  state: RichState,
  searchIndex: RichSearchIndex | null,
  rank: number,
  rankCount: number,
  textRankSafe: boolean,
): RichClampResult {
  return {
    fallback: false,
    rank,
    rankCount,
    searchIndex,
    state,
    textRankSafe,
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
const trailingWhitespace = /[\t\n\f\r ]+$/u;
const trailingWhitespaceEdge = /[\t\n\f\r ]$/u;

function tagNameFor(element: Element): string {
  return element.localName;
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

let variableDisplayCache = new WeakMap<Element, boolean>();
let variableDisplaySignature: string | undefined;
let variableDisplaySelectors: string[] | null = [];
let hasLineMetricRule = false;
let hasVariableLineMetricRule = false;

function declaresLineMetrics(style: CSSStyleDeclaration): boolean {
  return style.fontSize !== "" || style.lineHeight !== "" || style.verticalAlign !== "";
}

function currentStyleSheetSignature(): string {
  const { styleSheets } = document;
  const signature = [styleSheets.length.toString()];
  const displaySelectors: string[] = [];
  let hasVariableLineMetrics = false;
  let selectorsComplete = true;
  hasLineMetricRule = false;

  for (const sheet of styleSheets) {
    try {
      const sheetHasVariableLineMetrics = appendRuleListSignature(
        signature,
        sheet.cssRules,
        displaySelectors,
      );
      hasVariableLineMetrics ||= sheetHasVariableLineMetrics;
    } catch {
      signature.push("?");
      selectorsComplete = false;
      hasLineMetricRule = true;
      hasVariableLineMetrics = true;
    }
  }

  variableDisplaySelectors = selectorsComplete ? displaySelectors : null;
  hasVariableLineMetricRule = hasVariableLineMetrics;
  return signature.join("|");
}

function appendRuleListSignature(
  signature: string[],
  rules: CSSRuleList,
  displaySelectors: string[],
): boolean {
  signature.push(rules.length.toString());
  let hasVariableLineMetrics = false;

  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      const { selectorText, style } = rule;
      const { display } = style;
      const lineMetrics = lineMetricKey(style);
      signature.push(selectorText, display, lineMetrics);
      if (display.includes("var(")) {
        displaySelectors.push(selectorText);
      }
      if (declaresLineMetrics(style)) {
        hasLineMetricRule = true;
      }
      if (lineMetrics.includes("var(")) {
        hasVariableLineMetrics = true;
      }
      continue;
    }

    const nestedRules = nestedCssRules(rule);
    if (!nestedRules) {
      continue;
    }

    signature.push("{");
    const nestedHasVariableLineMetrics = appendRuleListSignature(
      signature,
      nestedRules,
      displaySelectors,
    );
    hasVariableLineMetrics ||= nestedHasVariableLineMetrics;
    signature.push("}");
  }

  return hasVariableLineMetrics;
}

function refreshVariableDisplayCache(styleSheetSignature: string): void {
  if (variableDisplaySignature === styleSheetSignature) {
    return;
  }

  variableDisplayCache = new WeakMap();
  variableDisplaySignature = styleSheetSignature;
}

function nestedCssRules(rule: CSSRule): CSSRuleList | null {
  if (rule instanceof CSSMediaRule && !matchMedia(rule.conditionText).matches) {
    return null;
  }

  return "cssRules" in rule ? (rule as CSSGroupingRule).cssRules : null;
}

function matchesVariableDisplaySelector(element: Element): boolean {
  const selectors = variableDisplaySelectors;
  if (!selectors) {
    return true;
  }

  for (const selector of selectors) {
    try {
      if (element.matches(selector)) {
        return true;
      }
    } catch {
      // Ignore selectors unsupported by Element.matches.
    }
  }

  return false;
}

function hasVariableDisplay(element: Element, getStyleSheetSignature: () => string): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  if (element.style.display.includes("var(")) {
    return true;
  }

  refreshVariableDisplayCache(getStyleSheetSignature());
  const cached = variableDisplayCache.get(element);
  if (cached !== undefined) {
    return cached;
  }

  const matches = matchesVariableDisplaySelector(element);
  variableDisplayCache.set(element, matches);
  return matches;
}

function inspectLayout(
  root: HTMLElement,
  getStyleSheetSignature: () => string,
  baseStyle = getComputedStyle(root),
): RichLayoutInspection | null {
  const atomicPaths = new Set<string>();
  let hasElements = false;
  let hasStyleDependentDisplay = false;
  let hasStyleDependentLineMetrics = false;
  let inheritsLineMetrics = true;
  const baseStyleKey = lineMetricKey(baseStyle);
  const simpleLineFit = simpleLineFitFromStyle(baseStyle);
  let canUseSimpleLineHeight =
    simpleLineFit !== undefined && baseStyle.verticalAlign === "baseline";

  function addAtomicPath(path: string, styleDependent: boolean): void {
    atomicPaths.add(path);
    hasStyleDependentDisplay ||= styleDependent;
  }

  function walkChildren(container: Node, parentKey: string): boolean {
    const { childNodes: children } = container;

    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      if (!child || !(child instanceof Element)) {
        continue;
      }

      hasElements = true;
      const tagName = tagNameFor(child);
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
      const variableDisplay = hasVariableDisplay(child, getStyleSheetSignature);
      const hasInlineLineMetric = child instanceof HTMLElement && declaresLineMetrics(child.style);
      const hasVariableLineMetric =
        child instanceof HTMLElement && lineMetricKey(child.style).includes("var(");
      hasStyleDependentDisplay ||= variableDisplay;
      hasStyleDependentLineMetrics ||= hasVariableLineMetric;
      inheritsLineMetrics &&= !hasInlineLineMetric;

      if (display === "none") {
        // Hidden elements do not expose searchable text, but preserving them as
        // atomic structure keeps patch points aligned with the source tree.
        addAtomicPath(childKey, variableDisplay);
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
        addAtomicPath(childKey, isAtomicInline && child.childNodes.length > 0 && variableDisplay);
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

  if (hasElements && !hasStyleDependentLineMetrics) {
    getStyleSheetSignature();
    inheritsLineMetrics &&= !hasLineMetricRule;
    hasStyleDependentLineMetrics = hasVariableLineMetricRule;
  }

  return {
    atomicPathSignature: [...atomicPaths].join("|"),
    atomicPaths,
    hasElements,
    hasStyleDependentDisplay,
    hasStyleDependentLineMetrics,
    inheritsLineMetrics,
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

    if (leaf instanceof Element && tagNameFor(leaf) === "wbr") {
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

      if (child instanceof Element && tagNameFor(child) === "wbr") {
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

  if (leaf instanceof Element && tagNameFor(leaf) === "wbr") {
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

function rankPointsForRuns(runs: readonly LogicalRun[]): BoundaryPoint[] {
  const points = [ROOT_START_POINT];

  for (const run of runs) {
    if (run.kind === "atomic") {
      points.push(run.endPoint);
      continue;
    }

    for (const point of run.textCuts) {
      points.push(point);
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

function isTextLogicalRun(run: LogicalRun): run is TextLogicalRun {
  return run.kind === "text";
}

function textOnlySimpleLineFit(
  inspection: RichLayoutInspection,
  runs: readonly LogicalRun[],
): TextOnlySimpleLineFit | null {
  if (
    inspection.simpleLineFit === undefined ||
    inspection.simpleLineStyleKey === undefined ||
    !runs.every(isTextLogicalRun)
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
  getStyleSheetSignature: () => string,
  inspection = inspectLayout(body, getStyleSheetSignature),
): RichSearchIndex | null {
  if (!inspection) {
    return null;
  }

  const runs = buildLogicalRuns(prepared.nodes, inspection.atomicPaths);
  const simpleLine = textOnlySimpleLineFit(inspection, runs);

  return {
    atomicPathSignature: inspection.atomicPathSignature,
    body,
    hasElements: inspection.hasElements,
    hasStyleDependentDisplay: inspection.hasStyleDependentDisplay,
    hasStyleDependentLineMetrics: inspection.hasStyleDependentLineMetrics,
    inheritsLineMetrics: inspection.inheritsLineMetrics,
    prepared,
    rankPoints: prepared.boundary === "word" ? rankPointsForRuns(runs) : null,
    runs,
    ...(simpleLine
      ? {
          simpleLineFit: simpleLine.fit,
          simpleLineStyleKey: simpleLine.styleKey,
        }
      : {}),
    styleSheetSignature: inspection.hasElements ? getStyleSheetSignature() : "",
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
  reuseSimpleLineFit = false,
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

  let state = from;
  let styleSheetSignature: string | undefined;
  const visibleBoundsCache: VisibleBoundsCache | undefined =
    maxHeight === undefined ? undefined : {};

  function getStyleSheetSignature(): string {
    styleSheetSignature ??= currentStyleSheetSignature();
    return styleSheetSignature;
  }

  function applyFullCandidate(): void {
    state = patchRich(prepared, body, state, FULL_STATE, ellipsis, PROBE_IMAGE_SRC);
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
      PROBE_IMAGE_SRC,
    );
  }

  let checkedFullCandidate = false;

  function fitsFullCandidate(): boolean {
    applyFullCandidate();
    checkedFullCandidate = true;

    return fitsContent(
      root,
      content,
      lineLimit,
      maxHeight,
      true,
      visibleBoundsCache,
      simpleLineFit,
    );
  }

  let nextSearchIndex =
    searchIndex?.prepared === prepared && searchIndex.body === body ? searchIndex : null;
  if (!nextSearchIndex) {
    applyFullCandidate();
    nextSearchIndex = createSearchIndex(prepared, body, getStyleSheetSignature);
  }

  if (!nextSearchIndex) {
    // Unsupported inline layout falls back to the original HTML instead of
    // risking a structurally valid but visually wrong clamp.
    return fallbackResult(state);
  }

  const canUseSimpleLineLayout = canUseBodyOnlyLineFit(content, body, lineLimit, maxHeight);
  const styleSheetsChanged =
    nextSearchIndex.hasElements && nextSearchIndex.styleSheetSignature !== getStyleSheetSignature();
  const hasSimpleLineFit = canUseSimpleLineLayout && nextSearchIndex.simpleLineFit !== undefined;
  const displayDependsOnStyle = nextSearchIndex.hasStyleDependentDisplay;
  const lineMetricsDependOnStyle = nextSearchIndex.hasStyleDependentLineMetrics;
  let simpleLineFit: SimpleLineFit | undefined;
  let baseStyleForInspection: CSSStyleDeclaration | undefined;
  let inspectLayoutAgain = displayDependsOnStyle || lineMetricsDependOnStyle || styleSheetsChanged;
  if (hasSimpleLineFit) {
    if (
      reuseSimpleLineFit &&
      !inspectLayoutAgain &&
      nextSearchIndex.simpleLineStyleKey !== undefined
    ) {
      const currentBaseStyle = getComputedStyle(body);
      const currentBaseStyleKey = lineMetricKey(currentBaseStyle);
      const inheritedSimpleLineFit =
        nextSearchIndex.inheritsLineMetrics && currentBaseStyle.verticalAlign === "baseline"
          ? simpleLineFitFromStyle(currentBaseStyle)
          : undefined;
      if (currentBaseStyleKey === nextSearchIndex.simpleLineStyleKey) {
        simpleLineFit = nextSearchIndex.simpleLineFit;
      } else if (inheritedSimpleLineFit) {
        simpleLineFit = inheritedSimpleLineFit;
        nextSearchIndex = searchIndexWithSimpleLineFit(
          nextSearchIndex,
          inheritedSimpleLineFit,
          currentBaseStyleKey,
        );
      } else {
        inspectLayoutAgain = true;
        baseStyleForInspection = currentBaseStyle;
      }
    } else {
      inspectLayoutAgain = true;
    }
  }

  if (inspectLayoutAgain) {
    if (displayDependsOnStyle || lineMetricsDependOnStyle || styleSheetsChanged) {
      applyFullCandidate();
    }

    const inspection = inspectLayout(body, getStyleSheetSignature, baseStyleForInspection);
    if (!inspection) {
      applyFullCandidate();
      return fallbackResult(state);
    }

    if (
      styleSheetsChanged ||
      inspection.atomicPathSignature !== nextSearchIndex.atomicPathSignature
    ) {
      // The cached all-text run map may be stale if CSS turned a transparent
      // inline wrapper into an atomic box, or an atomic box back into text.
      const refreshedSearchIndex = createSearchIndex(
        prepared,
        body,
        getStyleSheetSignature,
        inspection,
      );
      if (!refreshedSearchIndex) {
        applyFullCandidate();
        return fallbackResult(state);
      }

      nextSearchIndex = refreshedSearchIndex;
    }

    const nextSimpleLine = canUseSimpleLineLayout
      ? textOnlySimpleLineFit(inspection, nextSearchIndex.runs)
      : null;
    nextSearchIndex = searchIndexWithSimpleLineFit(
      nextSearchIndex,
      nextSimpleLine?.fit,
      nextSimpleLine?.styleKey,
    );

    if (nextSimpleLine) {
      simpleLineFit = nextSimpleLine.fit;
    }
  }

  const { rankPoints, runs } = nextSearchIndex;

  if (!skipFullFit && fitsFullCandidate()) {
    // The full rich tree fits and its layout is safe for the rich search model.
    return unrankedResult(state, nextSearchIndex);
  }

  function fitsCandidate(endPoint: BoundaryPoint): boolean {
    applyCandidate(endPoint);
    return fitsContent(
      root,
      content,
      lineLimit,
      maxHeight,
      true,
      visibleBoundsCache,
      simpleLineFit,
    );
  }

  if (runs.length === 0) {
    // Rich content can be all comments/empty text; in that case the full patched
    // state is already the only meaningful answer.
    applyFullCandidate();
    return unrankedResult(state, nextSearchIndex);
  }

  function currentResult(): RichClampResult {
    if (!state || !rankPoints) {
      return unrankedResult(state, nextSearchIndex);
    }

    const stateRank = rankForState(state, rankPoints);
    if (stateRank === undefined) {
      return unsafeRankResult(state, nextSearchIndex);
    }

    return rankedResult(
      state,
      nextSearchIndex,
      stateRank,
      rankPoints.length,
      textRankSafeForState(state, runs, prepared.root),
    );
  }

  function clampedResult(point: BoundaryPoint): RichClampResult {
    if (skipFullFit && verifyFullCandidate && !checkedFullCandidate) {
      if (fitsFullCandidate()) {
        return currentResult();
      }
    }

    applyCandidate(point);
    return currentResult();
  }

  const useHintedTextRun = preferHintedTextRun !== undefined ? preferHintedTextRun : hint === from;
  let coarseHint = runHintForState(runs, hint);

  if (useHintedTextRun && hint?.kind === "clamped") {
    const hintedRunIndex = textRunIndexForPoint(runs, hint.point);

    if (hintedRunIndex !== null) {
      const hintedRun = runs[hintedRunIndex]!;

      if (hintedRun.kind === "text") {
        const fineHint = boundaryPointIndex(hintedRun.textCuts, hint.point);
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
          const fallbackHint = boundaryPointIndex(fallbackTextCuts, hint.point);
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

  const coarseSearchCount = runs.length + (skipFullFit ? 1 : 0);
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
    hint?.kind === "clamped" ? boundaryPointIndex(nextRun.textCuts, hint.point) : null;
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
      hint?.kind === "clamped" ? boundaryPointIndex(fallbackTextCuts, hint.point) : null;
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
