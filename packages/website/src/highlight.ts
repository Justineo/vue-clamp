import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import css from "shiki/langs/css.mjs";
import html from "shiki/langs/html.mjs";
import js from "shiki/langs/javascript.mjs";
import shellscript from "shiki/langs/shellscript.mjs";
import ts from "shiki/langs/typescript.mjs";
import vue from "shiki/langs/vue.mjs";
import { websiteShikiTheme } from "./shiki-theme";

export type HighlightLanguage = "shellscript" | "vue";

const shiki = createHighlighterCoreSync({
  engine: createJavaScriptRegexEngine(),
  langs: [vue, shellscript, css, html, js, ts],
  themes: [websiteShikiTheme],
});

export function highlightCode(code: string, lang: HighlightLanguage): string {
  return shiki.codeToHtml(code, {
    lang,
    theme: websiteShikiTheme.name,
  });
}
