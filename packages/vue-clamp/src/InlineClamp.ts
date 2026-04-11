import { defineComponent, h, mergeProps } from "vue";

import type { CSSProperties, PropType } from "vue";
import type { InlineClampParts, InlineClampSplit } from "./types.ts";

const inlineRootStyle: CSSProperties = {
  alignItems: "baseline",
  display: "inline-flex",
  maxWidth: "100%",
  minWidth: "0",
  verticalAlign: "baseline",
};

const fixedSegmentStyle: CSSProperties = {
  flex: "none",
  maxWidth: "100%",
  whiteSpace: "nowrap",
};

const bodySegmentStyle: CSSProperties = {
  display: "block",
  flex: "0 1 auto",
  minWidth: "1em",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const preservedSpaceStyle: CSSProperties = {
  whiteSpace: "pre",
};

const boundarySpacePattern = /^( *)([\s\S]*?)( *)$/;

const propsDef = {
  as: {
    type: String,
    default: "span",
  },
  text: {
    type: String,
    required: true,
  },
  split: Function as PropType<InlineClampSplit | undefined>,
} as const;

function resolveParts(text: string, split: InlineClampSplit | undefined): InlineClampParts {
  if (!split) {
    return { body: text };
  }

  const parts = split(text);

  if (typeof parts?.body !== "string") {
    return { body: text };
  }

  const normalizedParts: InlineClampParts = {
    body: parts.body,
  };

  if (typeof parts.start === "string") {
    normalizedParts.start = parts.start;
  }

  if (typeof parts.end === "string") {
    normalizedParts.end = parts.end;
  }

  return normalizedParts;
}

function renderPreservedSpaces(text: string) {
  return text
    ? h(
        "span",
        {
          style: preservedSpaceStyle,
        },
        text,
      )
    : null;
}

function renderSegmentContent(text: string) {
  const [, leadingSpaces = "", content = "", trailingSpaces = ""] =
    boundarySpacePattern.exec(text) ?? [];

  if (!leadingSpaces && !trailingSpaces) {
    return text;
  }

  return [
    renderPreservedSpaces(leadingSpaces),
    content || null,
    renderPreservedSpaces(trailingSpaces),
  ];
}

function renderSegment(name: "start" | "body" | "end", text: string, style: CSSProperties) {
  return h(
    "span",
    {
      "data-part": name,
      style,
    },
    renderSegmentContent(text),
  );
}

export const InlineClamp = defineComponent({
  name: "InlineClamp",
  inheritAttrs: false,
  props: propsDef,
  setup(props, { attrs }) {
    return () => {
      const { as, split, text } = props;
      const parts = resolveParts(text, split);

      return h(
        as,
        mergeProps(attrs, {
          "data-part": "root",
          style: inlineRootStyle,
        }),
        [
          parts.start ? renderSegment("start", parts.start, fixedSegmentStyle) : null,
          renderSegment("body", parts.body, bodySegmentStyle),
          parts.end ? renderSegment("end", parts.end, fixedSegmentStyle) : null,
        ],
      );
    };
  },
});

export type { InlineClampParts, InlineClampProps, InlineClampSplit } from "./types.ts";
