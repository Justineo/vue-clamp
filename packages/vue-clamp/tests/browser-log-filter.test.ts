import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vite-plus/test";
import { browserLogFilter } from "../../../scripts/browser-log-filter.ts";

import type { Logger, ViteDevServer } from "vite";

function createLogger(): Logger & { error: Logger["error"] } {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    warnOnce: vi.fn(),
    error: vi.fn(),
    clearScreen: vi.fn(),
    hasErrorLogged: vi.fn(() => false),
    hasWarned: false,
  };
}

function createServer(
  logger: Logger,
  options: {
    environmentLoggers?: Logger[];
    httpServer?: EventEmitter | null;
    includeEnvironments?: boolean;
    watcher?: EventEmitter;
  } = {},
): ViteDevServer {
  const {
    environmentLoggers = [],
    httpServer = new EventEmitter(),
    includeEnvironments = true,
    watcher,
  } = options;

  return {
    config: { logger },
    httpServer,
    ...(watcher ? { watcher } : {}),
    ...(includeEnvironments
      ? {
          environments: Object.fromEntries(
            environmentLoggers.map((environmentLogger, index) => [
              `environment-${index}`,
              { config: { logger: environmentLogger } },
            ]),
          ),
        }
      : {}),
  } as unknown as ViteDevServer;
}

function configureServer(server: ViteDevServer): void {
  const { configureServer: configure } = browserLogFilter;
  if (typeof configure !== "function") {
    throw new TypeError("Expected browserLogFilter to expose a configureServer hook.");
  }

  (configure as (server: ViteDevServer) => void)(server);
}

describe("browserLogFilter", () => {
  it("mutes known noisy browser errors and forwards other errors", () => {
    const logger = createLogger();
    const originalError = logger.error;
    const server = createServer(logger);

    configureServer(server);
    logger.error("ResizeObserver loop completed with undelivered notifications.");
    logger.error("Real browser failure");

    expect(originalError).toHaveBeenCalledTimes(1);
    expect(originalError).toHaveBeenCalledWith("Real browser failure", undefined);
  });

  it("restores each wrapped logger when the server closes", () => {
    const logger = createLogger();
    const originalError = logger.error;
    const httpServer = new EventEmitter();

    configureServer(createServer(logger, { httpServer }));

    expect(logger.error).not.toBe(originalError);
    httpServer.emit("close");
    expect(logger.error).toBe(originalError);
  });

  it("keeps a shared logger wrapped until all servers close", () => {
    const logger = createLogger();
    const originalError = logger.error;
    const firstHttpServer = new EventEmitter();
    const firstWatcher = new EventEmitter();
    const secondHttpServer = new EventEmitter();

    configureServer(createServer(logger, { httpServer: firstHttpServer, watcher: firstWatcher }));
    const filteredError = logger.error;
    configureServer(createServer(logger, { httpServer: secondHttpServer }));

    expect(logger.error).toBe(filteredError);
    firstHttpServer.emit("close");
    firstWatcher.emit("close");
    expect(logger.error).toBe(filteredError);
    secondHttpServer.emit("close");
    expect(logger.error).toBe(originalError);
  });

  it("restores from the watcher when no HTTP server is available", () => {
    const logger = createLogger();
    const originalError = logger.error;
    const watcher = new EventEmitter();

    configureServer(createServer(logger, { httpServer: null, watcher }));
    watcher.emit("close");

    expect(logger.error).toBe(originalError);
  });

  it("handles servers without environment loggers", () => {
    const logger = createLogger();
    const originalError = logger.error;

    configureServer(createServer(logger, { includeEnvironments: false }));
    logger.error("Real browser failure");

    expect(originalError).toHaveBeenCalledWith("Real browser failure", undefined);
  });

  it("does not double wrap a logger reused by the root config and an environment", () => {
    const logger = createLogger();
    const originalError = logger.error;
    const httpServer = new EventEmitter();

    configureServer(createServer(logger, { environmentLoggers: [logger], httpServer }));
    httpServer.emit("close");

    expect(logger.error).toBe(originalError);
  });
});
