import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import shellscript from "shiki/langs/shellscript.mjs";
import vue from "shiki/langs/vue.mjs";
import { websiteShikiTheme } from "./shiki-theme.ts";

export type HighlightLanguage = "shellscript" | "vue";

const shiki = createHighlighterCoreSync({
  engine: createJavaScriptRegexEngine(),
  langs: [vue, shellscript],
  themes: [websiteShikiTheme],
});

export function highlightCode(code: string, lang: HighlightLanguage): string {
  return shiki.codeToHtml(code, {
    lang,
    theme: websiteShikiTheme.name,
  });
}
