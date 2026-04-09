import { fitsContent } from "./layout.ts";
import { prepareText } from "./text.ts";

import type { PreparedText } from "./text.ts";

type BoundaryPoint = {
  path: readonly number[];
  offset: number;
};

type PreparedTextNode = {
  kind: "text";
  startPoint: BoundaryPoint;
  endPoint: BoundaryPoint;
  graphemeCuts: BoundaryPoint[];
};

type PreparedElementNode = {
  kind: "element";
  pathKey: string;
  isBreak: boolean;
  startPoint: BoundaryPoint;
  endPoint: BoundaryPoint;
  children: PreparedRichNode[];
};

type PreparedRichNode = PreparedTextNode | PreparedElementNode;

type LogicalRun =
  | {
      kind: "text";
      startPoint: BoundaryPoint;
      endPoint: BoundaryPoint;
      graphemeCuts: BoundaryPoint[];
    }
  | {
      kind: "atomic";
      startPoint: BoundaryPoint;
      endPoint: BoundaryPoint;
    };

export type PreparedRichText = {
  html: string;
  root: HTMLElement;
  nodes: PreparedRichNode[];
  supported: boolean;
  reason?: string;
};

export type RichTextValidationResult = {
  supported: boolean;
  reason?: string;
};

type RenderedRichLayoutResult =
  | {
      supported: true;
      atomicPaths: Set<string>;
    }
  | {
      supported: false;
      reason: string;
    };

type ClonePrefixResult = {
  clone: DocumentFragment;
  insertionContainer: Node;
};

const ROOT_PATH: readonly number[] = [];
const ROOT_START_POINT: BoundaryPoint = {
  path: ROOT_PATH,
  offset: 0,
};

function tagNameFor(element: Element): string {
  return element.tagName.toLowerCase();
}

function pathKey(path: readonly number[]): string {
  return path.join(".");
}

function childPathKey(parentKey: string, index: number): string {
  return parentKey ? `${parentKey}.${index}` : `${index}`;
}

function textUnitCount(preparedText: PreparedText): number {
  return Math.max(0, preparedText.boundaryOffsets.length - 1);
}

function isAtomicInlineDisplay(display: string): boolean {
  return display.startsWith("inline-") && display !== "inline";
}

function isInlineWrapperDisplay(display: string): boolean {
  return display === "inline" || display === "contents";
}

function collectRenderedRichLayout(root: HTMLElement): RenderedRichLayoutResult {
  const atomicPaths = new Set<string>();

  function walkChildren(container: Node, parentKey: string): RichTextValidationResult {
    const children = container.childNodes;

    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      if (!child || !(child instanceof Element)) {
        continue;
      }

      const tagName = tagNameFor(child);
      const childKey = childPathKey(parentKey, index);

      if (tagName === "br" || tagName === "wbr") {
        continue;
      }

      const style = getComputedStyle(child);

      if (
        style.position === "absolute" ||
        style.position === "fixed" ||
        style.position === "sticky"
      ) {
        return {
          supported: false,
          reason: `Rich text does not support positioned descendants like <${tagName}>.`,
        };
      }

      if (style.float !== "none") {
        return {
          supported: false,
          reason: `Rich text does not support floated descendants like <${tagName}>.`,
        };
      }

      if (
        tagName === "img" ||
        tagName === "svg" ||
        child.childNodes.length === 0 ||
        isAtomicInlineDisplay(style.display)
      ) {
        if (style.display !== "inline" && !isAtomicInlineDisplay(style.display)) {
          return {
            supported: false,
            reason: `Rich text atomic <${tagName}> must stay in inline flow.`,
          };
        }

        atomicPaths.add(childKey);
        continue;
      }

      if (!isInlineWrapperDisplay(style.display)) {
        return {
          supported: false,
          reason: `Rich text wrapper <${tagName}> must stay in inline flow.`,
        };
      }

      const result = walkChildren(child, childKey);
      if (!result.supported) {
        return result;
      }
    }

    return {
      supported: true,
    };
  }

  const result = walkChildren(root, "");
  if (!result.supported) {
    return {
      supported: false,
      reason: result.reason ?? "Unsupported rich text layout.",
    };
  }

  return {
    supported: true,
    atomicPaths,
  };
}

function boundariesAroundChild(path: readonly number[]): {
  startPoint: BoundaryPoint;
  endPoint: BoundaryPoint;
} {
  const offset = path[path.length - 1] ?? 0;
  const parentPath = path.slice(0, -1);

  return {
    startPoint: {
      path: parentPath,
      offset,
    },
    endPoint: {
      path: parentPath,
      offset: offset + 1,
    },
  };
}

function buildPreparedRichNodes(
  container: ParentNode & Node,
  path: readonly number[],
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
      const preparedText = prepareText(child.textContent ?? "");

      if (textUnitCount(preparedText) <= 0) {
        continue;
      }

      const graphemeCuts: BoundaryPoint[] = [];
      for (
        let boundaryIndex = 1;
        boundaryIndex < preparedText.boundaryOffsets.length;
        boundaryIndex += 1
      ) {
        const offset = preparedText.boundaryOffsets[boundaryIndex];
        if (offset === undefined) {
          continue;
        }

        graphemeCuts.push({
          path: childPath,
          offset,
        });
      }

      nodes.push({
        kind: "text",
        startPoint: {
          path: childPath,
          offset: 0,
        },
        endPoint: {
          path: childPath,
          offset: preparedText.text.length,
        },
        graphemeCuts,
      });
      continue;
    }

    if (!(child instanceof Element)) {
      continue;
    }

    const boundary = boundariesAroundChild(childPath);
    const tagName = tagNameFor(child);

    nodes.push({
      kind: "element",
      pathKey: pathKey(childPath),
      isBreak: tagName === "br" || tagName === "wbr",
      startPoint: boundary.startPoint,
      endPoint: boundary.endPoint,
      children: buildPreparedRichNodes(child, childPath),
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

    if (currentTextNodes.length === 1) {
      const onlyNode = currentTextNodes[0]!;
      runs.push({
        kind: "text",
        startPoint: onlyNode.startPoint,
        endPoint: onlyNode.endPoint,
        graphemeCuts: onlyNode.graphemeCuts,
      });
      currentTextNodes = [];
      return;
    }

    const firstNode = currentTextNodes[0]!;
    const lastNode = currentTextNodes[currentTextNodes.length - 1]!;
    let totalGraphemeCuts = 0;

    for (const textNode of currentTextNodes) {
      totalGraphemeCuts += textNode.graphemeCuts.length;
    }

    const graphemeCuts: BoundaryPoint[] = [];

    for (const textNode of currentTextNodes) {
      for (const cut of textNode.graphemeCuts) {
        graphemeCuts.push(cut);
      }
    }

    runs.push({
      kind: "text",
      startPoint: firstNode.startPoint,
      endPoint: lastNode.endPoint,
      graphemeCuts,
    });

    currentTextNodes = [];
  }

  function walkNodes(nextNodes: readonly PreparedRichNode[]): void {
    for (const node of nextNodes) {
      if (node.kind === "text") {
        currentTextNodes.push(node);
        continue;
      }

      if (node.isBreak || atomicPaths.has(node.pathKey)) {
        flushTextRun();
        runs.push({
          kind: "atomic",
          startPoint: node.startPoint,
          endPoint: node.endPoint,
        });
        continue;
      }

      walkNodes(node.children);
    }
  }

  walkNodes(nodes);
  flushTextRun();

  return runs;
}

function clonePrefixFromContainer(
  container: ParentNode & Node,
  endPoint: BoundaryPoint,
  depth: number,
  isRoot: boolean,
): { clone: Node; insertionContainer: Node } {
  const clone = isRoot ? document.createDocumentFragment() : container.cloneNode(false);
  const children = container.childNodes;

  if (depth === endPoint.path.length) {
    const limit = Math.min(endPoint.offset, children.length);

    for (let index = 0; index < limit; index += 1) {
      const child = children[index];
      if (child) {
        clone.appendChild(child.cloneNode(true));
      }
    }

    return {
      clone,
      insertionContainer: clone,
    };
  }

  const targetIndex = endPoint.path[depth] ?? 0;
  const limit = Math.min(targetIndex, children.length);

  for (let index = 0; index < limit; index += 1) {
    const child = children[index];
    if (child) {
      clone.appendChild(child.cloneNode(true));
    }
  }

  const targetChild = children[targetIndex];
  if (!targetChild) {
    return {
      clone,
      insertionContainer: clone,
    };
  }

  if (targetChild.nodeType === Node.TEXT_NODE) {
    const nextText = (targetChild.textContent ?? "").slice(0, endPoint.offset);
    if (nextText) {
      clone.appendChild(document.createTextNode(nextText));
    }

    return {
      clone,
      insertionContainer: clone,
    };
  }

  if (!(targetChild instanceof Element)) {
    return {
      clone,
      insertionContainer: clone,
    };
  }

  const result = clonePrefixFromContainer(targetChild, endPoint, depth + 1, false);
  clone.appendChild(result.clone);

  return {
    clone,
    insertionContainer: result.insertionContainer,
  };
}

function clonePrefix(root: HTMLElement, endPoint: BoundaryPoint): ClonePrefixResult {
  const result = clonePrefixFromContainer(root, endPoint, 0, true);

  if (!(result.clone instanceof DocumentFragment)) {
    throw new Error("Expected root rich prefix clone to be a document fragment.");
  }

  return {
    clone: result.clone,
    insertionContainer: result.insertionContainer,
  };
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

function applyCandidateFragment(
  sourceRoot: HTMLElement,
  targetElement: HTMLElement,
  endPoint: BoundaryPoint,
  ellipsis: string,
  truncated: boolean,
): void {
  const result = clonePrefix(sourceRoot, endPoint);

  if (truncated) {
    trimTrailingWhitespace(result.clone);
    appendEllipsis(result.insertionContainer, ellipsis);
  }

  targetElement.replaceChildren(result.clone);
}

function findLastFittingIndex<T>(
  values: readonly T[],
  measureValue: (value: T) => boolean,
): number {
  let low = 0;
  let high = values.length - 1;
  let bestIndex = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);

    if (measureValue(values[middle]!)) {
      bestIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return bestIndex;
}

export function prepareRichText(html: string): PreparedRichText | null {
  if (typeof DOMParser === "undefined") {
    return null;
  }

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(html, "text/html");

  return {
    html,
    root: documentNode.body,
    nodes: buildPreparedRichNodes(documentNode.body, ROOT_PATH),
    supported: true,
  };
}

export function validateRenderedRichText(root: HTMLElement): RichTextValidationResult {
  const result = collectRenderedRichLayout(root);

  return result.supported
    ? {
        supported: true,
      }
    : result;
}

export function clampRichTextToLayout(
  prepared: PreparedRichText,
  rootElement: HTMLElement,
  contentElement: HTMLElement,
  richElement: HTMLElement,
  ellipsis: string,
  lineLimit: number | undefined,
  maxHeight: number | string | undefined,
): { html: string | null; reason?: string; fallback?: boolean } {
  function withReason(
    html: string,
    reason: string | undefined,
  ): { html: string; reason?: string; fallback: true } {
    return reason === undefined ? { html, fallback: true } : { html, reason, fallback: true };
  }

  if (rootElement.getBoundingClientRect().width <= 0) {
    return { html: null };
  }

  let currentHtml: string | null = richElement.innerHTML;
  let currentCut: BoundaryPoint | null = null;
  let currentTruncated = false;

  function renderedHtml(): string {
    if (currentHtml === null) {
      currentHtml = richElement.innerHTML;
    }

    return currentHtml;
  }

  function applyHtml(nextHtml: string): void {
    if (nextHtml !== currentHtml) {
      richElement.innerHTML = nextHtml;
      currentHtml = nextHtml;
      currentCut = null;
      currentTruncated = false;
    }
  }

  function applyCandidate(endPoint: BoundaryPoint, truncated: boolean): void {
    if (currentCut === endPoint && currentTruncated === truncated) {
      return;
    }

    applyCandidateFragment(prepared.root, richElement, endPoint, ellipsis, truncated);
    currentHtml = null;
    currentCut = endPoint;
    currentTruncated = truncated;
  }

  function fitsCandidate(endPoint: BoundaryPoint): boolean {
    applyCandidate(endPoint, true);
    return fitsContent(rootElement, contentElement, lineLimit, maxHeight);
  }

  if (!prepared.supported) {
    return withReason(prepared.html, prepared.reason);
  }

  applyHtml(prepared.html);

  const layout = collectRenderedRichLayout(richElement);
  if (!layout.supported) {
    return withReason(prepared.html, layout.reason);
  }

  if (fitsContent(rootElement, contentElement, lineLimit, maxHeight)) {
    return { html: prepared.html };
  }

  const runs = buildLogicalRuns(prepared.nodes, layout.atomicPaths);
  if (runs.length === 0) {
    return { html: prepared.html };
  }

  const coarseIndex = findLastFittingIndex(runs, (run) => fitsCandidate(run.endPoint));
  const coarsePoint = coarseIndex >= 0 ? runs[coarseIndex]!.endPoint : ROOT_START_POINT;
  const nextRun = runs[coarseIndex + 1];

  if (!nextRun || nextRun.kind === "atomic") {
    applyCandidate(coarsePoint, true);
    return { html: renderedHtml() };
  }

  const fineIndex = findLastFittingIndex(nextRun.graphemeCuts, fitsCandidate);
  const finePoint = fineIndex >= 0 ? nextRun.graphemeCuts[fineIndex]! : coarsePoint;

  applyCandidate(finePoint, true);
  return { html: renderedHtml() };
}
