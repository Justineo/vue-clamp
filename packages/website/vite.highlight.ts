import { readFile } from "node:fs/promises";
import type { Plugin } from "vite";
import { highlightCode, type HighlightLanguage } from "./src/highlight.ts";
import { highlightedPkgManagers, installCommands } from "./src/installCommands.ts";

const highlightedInstallCommandsId = "virtual:website-highlighted-install-commands";
const resolvedHighlightedInstallCommandsId = `\0${highlightedInstallCommandsId}`;
const highlightedModulePrefix = "\0website-highlighted-module?";

function isHighlightLanguage(lang: string | null): lang is HighlightLanguage {
  return lang === "shellscript" || lang === "vue";
}

function parseHighlightedRequest(id: string): { filename: string; lang: HighlightLanguage } | null {
  const queryIndex = id.indexOf("?");
  if (queryIndex < 0) {
    return null;
  }

  const filename = id.slice(0, queryIndex);
  const params = new URLSearchParams(id.slice(queryIndex + 1));
  const lang = params.get("highlight");

  return isHighlightLanguage(lang) ? { filename, lang } : null;
}

function resolvedHighlightedModuleId(filename: string, lang: HighlightLanguage): string {
  return `${highlightedModulePrefix}${new URLSearchParams({ filename, lang })}`;
}

function parseResolvedHighlightedModuleId(
  id: string,
): { filename: string; lang: HighlightLanguage } | null {
  if (!id.startsWith(highlightedModulePrefix)) {
    return null;
  }

  const params = new URLSearchParams(id.slice(highlightedModulePrefix.length));
  const filename = params.get("filename");
  const lang = params.get("lang");

  return filename && isHighlightLanguage(lang) ? { filename, lang } : null;
}

export function websiteCodeHighlightPlugin(): Plugin {
  return {
    name: "website-code-highlight",
    enforce: "pre",

    async resolveId(id, importer) {
      if (id === highlightedInstallCommandsId) {
        return resolvedHighlightedInstallCommandsId;
      }

      const highlightedRequest = parseHighlightedRequest(id);
      if (!highlightedRequest) {
        return null;
      }

      const resolved = await this.resolve(highlightedRequest.filename, importer, {
        skipSelf: true,
      });

      return resolved ? resolvedHighlightedModuleId(resolved.id, highlightedRequest.lang) : null;
    },

    async load(id) {
      if (id === resolvedHighlightedInstallCommandsId) {
        const highlightedInstallCommands = Object.fromEntries(
          highlightedPkgManagers.map((manager) => [
            manager,
            highlightCode(installCommands[manager], "shellscript"),
          ]),
        );

        return `export const highlightedInstallCommands = ${JSON.stringify(
          highlightedInstallCommands,
        )};`;
      }

      const highlightedModule = parseResolvedHighlightedModuleId(id);
      if (!highlightedModule) {
        return null;
      }

      this.addWatchFile(highlightedModule.filename);

      const code = await readFile(highlightedModule.filename, "utf8");
      const html = highlightCode(code, highlightedModule.lang);

      return `export default ${JSON.stringify(html)};`;
    },
  };
}
