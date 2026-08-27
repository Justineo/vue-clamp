type ResizeListener = (entry: ResizeObserverEntry) => void;

const listeners = new Map<Element, ResizeListener>();
let observer: ResizeObserver | null = null;

export function observeContentBox(element: Element, listener: ResizeListener): () => void {
  observer ??= new ResizeObserver((entries) => {
    for (const entry of entries) {
      listeners.get(entry.target)?.(entry);
    }
  });

  listeners.set(element, listener);
  observer.observe(element);

  return () => {
    observer?.unobserve(element);
    listeners.delete(element);

    if (listeners.size === 0) {
      observer?.disconnect();
      observer = null;
    }
  };
}
