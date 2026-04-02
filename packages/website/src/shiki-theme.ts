import type { ThemeRegistration } from "shiki/types";

const tokenColors: NonNullable<ThemeRegistration["tokenColors"]> = [
  {
    scope: ["comment", "punctuation.definition.comment", "string.comment"],
    settings: {
      foreground: "#8e8ea0",
    },
  },
  {
    scope: [
      "delimiter",
      "delimiter.bracket",
      "meta.brace",
      "meta.objectliteral.ts",
      "punctuation",
      "punctuation.definition.string",
      "storage.type.function.arrow",
    ],
    settings: {
      foreground: "#9b9bb0",
    },
  },
  {
    scope: [
      "keyword",
      "keyword.operator",
      "keyword.operator.assignment.compound",
      "keyword.operator.type",
      "keyword.operator.type.annotation",
      "storage",
      "storage.type",
      "entity.name.tag",
      "tag.html",
      "punctuation.definition.template-expression",
    ],
    settings: {
      foreground: "#5b21b6",
    },
  },
  {
    scope: [
      "constant.language",
      "constant.language.boolean",
      "constant.language.null",
      "constant.language.undefined",
      "constant.numeric",
      "number",
      "support.constant",
      "variable.language",
    ],
    settings: {
      foreground: "#7c3aed",
    },
  },
  {
    scope: ["string", "attribute.value", "string variable"],
    settings: {
      foreground: "#9a3412",
    },
  },
  {
    scope: [
      "entity.name.function",
      "support.function",
      "support.type.primitive",
      "entity.name.type",
      "type.identifier",
    ],
    settings: {
      foreground: "#315f9b",
    },
  },
  {
    scope: [
      "entity",
      "entity.name",
      "entity.other.attribute-name",
      "entity.other.attribute-name.html.vue",
      "attribute.name",
      "property",
      "meta.object-literal.key",
      "meta.property-name",
      "support",
    ],
    settings: {
      foreground: "#8a6b1f",
    },
  },
  {
    scope: ["variable", "identifier", "variable.parameter.function"],
    settings: {
      foreground: "#1a1a2e",
    },
  },
];

export const websiteShikiTheme = {
  name: "vue-clamp-light",
  displayName: "Vue Clamp Light",
  type: "light",
  fg: "#1a1a2e",
  bg: "#f9f9fb",
  colors: {
    "editor.background": "#f9f9fb",
    "editor.foreground": "#1a1a2e",
  },
  semanticHighlighting: true,
  semanticTokenColors: {
    class: "#315f9b",
    interface: "#315f9b",
    namespace: "#5b21b6",
    property: "#8a6b1f",
    type: "#315f9b",
  },
  settings: tokenColors,
  tokenColors,
} satisfies ThemeRegistration;
