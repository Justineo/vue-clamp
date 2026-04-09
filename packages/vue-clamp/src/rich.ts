import { fitsContent } from "./layout.ts";
import { prepareText } from "./text.ts";

type BoundaryPoint = {
  path: readonly number[];
  offset: number;
};

type PreparedTextNode = {
  kind: "text";
  endPoint: BoundaryPoint;
  graphemeCuts: BoundaryPoint[];
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
      graphemeCuts: BoundaryPoint[];
    }
  | {
      kind: "atomic";
      endPoint: BoundaryPoint;
    };

export type PreparedRichText = {
  html: string;
  root: HTMLElement;
  nodes: PreparedRichNode[];
};

type ClonePrefixResult = {
  clone: DocumentFragment;
  appendTarget: Node;
};

type RichClampResult =
  | {
      html: null;
    }
  | {
      html: string;
      fallback: boolean;
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

function isAtomicInlineDisplay(display: string): boolean {
  return display.startsWith("inline-") && display !== "inline";
}

function isInlineWrapperDisplay(display: string): boolean {
  return display === "inline" || display === "contents";
}

function collectAtomicPaths(root: HTMLElement): Set<string> | null {
  const atomicPaths = new Set<string>();

  function walkChildren(container: Node, parentKey: string): boolean {
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

      if (style.display === "none") {
        atomicPaths.add(childKey);
        continue;
      }

      if (
        style.position === "absolute" ||
        style.position === "fixed" ||
        style.position === "sticky" ||
        style.float !== "none"
      ) {
        return false;
      }

      if (
        tagName === "img" ||
        tagName === "svg" ||
        child.childNodes.length === 0 ||
        isAtomicInlineDisplay(style.display)
      ) {
        if (style.display !== "inline" && !isAtomicInlineDisplay(style.display)) {
          return false;
        }

        atomicPaths.add(childKey);
        continue;
      }

      if (!isInlineWrapperDisplay(style.display)) {
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

      if (preparedText.boundaryOffsets.length <= 1) {
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

    const tagName = tagNameFor(child);

    nodes.push({
      kind: "element",
      pathKey: pathKey(childPath),
      isBreak: tagName === "br" || tagName === "wbr",
      endPoint: endPointForChild(childPath),
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
        endPoint: onlyNode.endPoint,
        graphemeCuts: onlyNode.graphemeCuts,
      });
      currentTextNodes = [];
      return;
    }

    const lastNode = currentTextNodes[currentTextNodes.length - 1]!;
    const graphemeCuts: BoundaryPoint[] = [];

    for (const textNode of currentTextNodes) {
      for (const cut of textNode.graphemeCuts) {
        graphemeCuts.push(cut);
      }
    }

    runs.push({
      kind: "text",
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
    appendTarget: result.insertionContainer,
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
): void {
  const result = clonePrefix(sourceRoot, endPoint);
  trimTrailingWhitespace(result.clone);
  appendEllipsis(result.appendTarget, ellipsis);

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
  };
}

export function clampRichTextToLayout(
  prepared: PreparedRichText,
  rootElement: HTMLElement,
  contentElement: HTMLElement,
  richElement: HTMLElement,
  ellipsis: string,
  lineLimit: number | undefined,
  maxHeight: number | string | undefined,
): RichClampResult {
  if (rootElement.getBoundingClientRect().width <= 0) {
    return { html: null };
  }

  let currentHtml: string | null = richElement.innerHTML;
  let currentCutPoint: BoundaryPoint | null = null;

  function readCurrentHtml(): string {
    if (currentHtml === null) {
      currentHtml = richElement.innerHTML;
    }

    return currentHtml;
  }

  function applySourceHtml(nextHtml: string): void {
    if (nextHtml !== currentHtml) {
      richElement.innerHTML = nextHtml;
      currentHtml = nextHtml;
      currentCutPoint = null;
    }
  }

  function applyCandidate(endPoint: BoundaryPoint): void {
    if (currentCutPoint === endPoint) {
      return;
    }

    applyCandidateFragment(prepared.root, richElement, endPoint, ellipsis);
    currentHtml = null;
    currentCutPoint = endPoint;
  }

  function fitsCandidate(endPoint: BoundaryPoint): boolean {
    applyCandidate(endPoint);
    return fitsContent(rootElement, contentElement, lineLimit, maxHeight);
  }

  applySourceHtml(prepared.html);

  if (fitsContent(rootElement, contentElement, lineLimit, maxHeight)) {
    return {
      html: prepared.html,
      fallback: false,
    };
  }

  const atomicPaths = collectAtomicPaths(richElement);
  if (atomicPaths === null) {
    return {
      html: prepared.html,
      fallback: true,
    };
  }

  const runs = buildLogicalRuns(prepared.nodes, atomicPaths);
  if (runs.length === 0) {
    return {
      html: prepared.html,
      fallback: false,
    };
  }

  const coarseIndex = findLastFittingIndex(runs, (run) => fitsCandidate(run.endPoint));
  const coarsePoint = coarseIndex >= 0 ? runs[coarseIndex]!.endPoint : ROOT_START_POINT;
  const nextRun = runs[coarseIndex + 1];

  if (!nextRun || nextRun.kind === "atomic") {
    applyCandidate(coarsePoint);
    return {
      html: readCurrentHtml(),
      fallback: false,
    };
  }

  const fineIndex = findLastFittingIndex(nextRun.graphemeCuts, fitsCandidate);
  const finePoint = fineIndex >= 0 ? nextRun.graphemeCuts[fineIndex]! : coarsePoint;

  applyCandidate(finePoint);
  return {
    html: readCurrentHtml(),
    fallback: false,
  };
}
