type DialogFocusOptions = {
  getDialog: () => HTMLElement | null;
  getInitialFocus?: () => HTMLElement | null;
  getRestoreFocus?: () => HTMLElement | null;
  onEscape?: () => void;
};

type ScrollLockSnapshot = {
  bodyLeft: string;
  bodyOverflow: string;
  bodyPosition: string;
  bodyRight: string;
  bodyTop: string;
  bodyWidth: string;
  htmlOverflow: string;
  scrollX: number;
  scrollY: number;
};

const focusableSelector = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "object",
  "embed",
  "audio[controls]",
  "video[controls]",
  "summary",
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

let scrollLockSnapshot: ScrollLockSnapshot | null = null;
let scrollLockCount = 0;

function once(cleanup: () => void): () => void {
  let released = false;

  return function releaseOnce(): void {
    if (released) {
      return;
    }

    released = true;
    cleanup();
  };
}

function focusElement(element: HTMLElement | null | undefined): void {
  if (element?.isConnected) {
    element.focus({ preventScroll: true });
  }
}

function isVisibleFocusable(element: HTMLElement): boolean {
  return (
    element === document.activeElement ||
    (element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden")
  );
}

function focusableElementsIn(dialog: HTMLElement | null): HTMLElement[] {
  if (!dialog) {
    return [];
  }

  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    isVisibleFocusable,
  );
}

export function trapDialogFocus({
  getDialog,
  getInitialFocus,
  getRestoreFocus,
  onEscape,
}: DialogFocusOptions): () => void {
  const fallbackRestoreTarget =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      onEscape?.();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const dialogElement = getDialog();
    if (!dialogElement) {
      return;
    }

    const focusableElements = focusableElementsIn(dialogElement);
    const firstElement = focusableElements[0] ?? getInitialFocus?.();
    const lastElement = focusableElements.at(-1) ?? firstElement;
    const activeElement = document.activeElement;

    if (!firstElement || !lastElement) {
      event.preventDefault();
      return;
    }

    if (!dialogElement.contains(activeElement)) {
      event.preventDefault();
      focusElement(firstElement);
      return;
    }

    if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault();
      focusElement(lastElement);
      return;
    }

    if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      focusElement(firstElement);
    }
  }

  window.addEventListener("keydown", handleKeydown);
  focusElement(getInitialFocus?.() ?? focusableElementsIn(getDialog())[0]);

  return once(() => {
    window.removeEventListener("keydown", handleKeydown);
    focusElement(getRestoreFocus?.() ?? fallbackRestoreTarget);
  });
}

function captureScrollLock(): ScrollLockSnapshot {
  const { body, documentElement } = document;

  return {
    bodyLeft: body.style.left,
    bodyOverflow: body.style.overflow,
    bodyPosition: body.style.position,
    bodyRight: body.style.right,
    bodyTop: body.style.top,
    bodyWidth: body.style.width,
    htmlOverflow: documentElement.style.overflow,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  };
}

function applyScrollLock(snapshot: ScrollLockSnapshot): void {
  const { body, documentElement } = document;

  documentElement.style.overflow = "hidden";
  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${snapshot.scrollY}px`;
  body.style.left = `-${snapshot.scrollX}px`;
  body.style.right = "0";
  body.style.width = "100%";
}

function restoreScrollLock(snapshot: ScrollLockSnapshot): void {
  const { body, documentElement } = document;

  documentElement.style.overflow = snapshot.htmlOverflow;
  body.style.overflow = snapshot.bodyOverflow;
  body.style.position = snapshot.bodyPosition;
  body.style.top = snapshot.bodyTop;
  body.style.left = snapshot.bodyLeft;
  body.style.right = snapshot.bodyRight;
  body.style.width = snapshot.bodyWidth;
  window.scrollTo(snapshot.scrollX, snapshot.scrollY);
}

export function lockPageScroll(): () => void {
  scrollLockCount += 1;

  if (!scrollLockSnapshot) {
    scrollLockSnapshot = captureScrollLock();
    applyScrollLock(scrollLockSnapshot);
  }

  return once(() => {
    scrollLockCount = Math.max(0, scrollLockCount - 1);

    if (scrollLockCount > 0 || !scrollLockSnapshot) {
      return;
    }

    restoreScrollLock(scrollLockSnapshot);
    scrollLockSnapshot = null;
  });
}
