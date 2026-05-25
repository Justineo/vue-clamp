import type { Logger, Plugin, ViteDevServer } from "vite";

const mutedBrowserLogs = ["ResizeObserver loop completed with undelivered notifications."];

type FilteredLoggerState = {
  filteredError: Logger["error"];
  originalError: Logger["error"];
  references: number;
};

const filteredLoggers = new WeakMap<Logger, FilteredLoggerState>();

function shouldMuteBrowserLog(message: string): boolean {
  return mutedBrowserLogs.some((log) => message.includes(log));
}

function restoreBrowserLogFilter(logger: Logger, state: FilteredLoggerState): void {
  const currentState = filteredLoggers.get(logger);
  if (currentState !== state) {
    return;
  }

  state.references -= 1;
  if (state.references > 0) {
    return;
  }

  if (logger.error === state.filteredError) {
    logger.error = state.originalError;
  }

  filteredLoggers.delete(logger);
}

function filterBrowserLogger(logger: Logger): () => void {
  const existingState = filteredLoggers.get(logger);
  if (existingState) {
    existingState.references += 1;
    return () => restoreBrowserLogFilter(logger, existingState);
  }

  const originalError = Reflect.get(logger, "error") as Logger["error"];
  const callOriginalError = originalError.bind(logger);
  const filteredError: Logger["error"] = (message, options) => {
    if (!shouldMuteBrowserLog(message)) {
      callOriginalError(message, options);
    }
  };
  const state: FilteredLoggerState = {
    filteredError,
    originalError,
    references: 1,
  };

  filteredLoggers.set(logger, state);
  logger.error = filteredError;

  return () => restoreBrowserLogFilter(logger, state);
}

function serverLoggers(server: ViteDevServer): Logger[] {
  const loggers = new Set<Logger>([server.config.logger]);
  if ("environments" in server && server.environments) {
    for (const environment of Object.values(server.environments)) {
      loggers.add(environment.config.logger);
    }
  }

  return [...loggers];
}

export const browserLogFilter: Plugin = {
  name: "vue-clamp:browser-log-filter",
  apply: "serve",
  configureServer(server) {
    const restoreLoggerFns = serverLoggers(server).map(filterBrowserLogger);
    let restored = false;
    const restoreLoggers = () => {
      if (restored) {
        return;
      }

      restored = true;
      for (const restoreLogger of restoreLoggerFns) {
        restoreLogger();
      }
    };

    // `configureServer` return values are post hooks, not teardown hooks.
    server.httpServer?.once("close", restoreLoggers);
    server.watcher?.once("close", restoreLoggers);
  },
};
