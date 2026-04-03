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
  flex: "1 1 auto",
  minWidth: "0",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const inlineClampProps = {
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

export const InlineClamp = defineComponent({
  name: "InlineClamp",
  inheritAttrs: false,
  props: inlineClampProps,
  setup(props, { attrs }) {
    return () => {
      const parts = resolveParts(props.text, props.split);

      return h(
        props.as,
        mergeProps(attrs, {
          "data-part": "root",
          style: inlineRootStyle,
        }),
        [
          parts.start
            ? h(
                "span",
                {
                  "data-part": "start",
                  style: fixedSegmentStyle,
                },
                parts.start,
              )
            : null,
          h(
            "span",
            {
              "data-part": "body",
              style: bodySegmentStyle,
            },
            parts.body,
          ),
          parts.end
            ? h(
                "span",
                {
                  "data-part": "end",
                  style: fixedSegmentStyle,
                },
                parts.end,
              )
            : null,
        ],
      );
    };
  },
});

export type { InlineClampParts, InlineClampProps, InlineClampSplit } from "./types.ts";
