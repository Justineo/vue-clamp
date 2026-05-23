import type { Plugin } from "vite";

const mutedBrowserLogs = ["ResizeObserver loop completed with undelivered notifications."];

export const browserLogFilter: Plugin = {
  name: "vue-clamp:browser-log-filter",
  apply: "serve",
  configureServer(server) {
    const loggers = [
      server.config.logger,
      ...Object.values(server.environments).map((environment) => environment.config.logger),
    ];

    for (const logger of loggers) {
      const error = logger.error.bind(logger);
      logger.error = (message, options) => {
        if (!mutedBrowserLogs.some((log) => message.includes(log))) {
          error(message, options);
        }
      };
    }
  },
};
