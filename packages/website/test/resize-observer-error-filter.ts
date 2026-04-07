const resizeObserverLoopError = "ResizeObserver loop completed with undelivered notifications.";

window.addEventListener(
  "error",
  (event) => {
    if (event.message !== resizeObserverLoopError) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
  },
  { capture: true },
);
