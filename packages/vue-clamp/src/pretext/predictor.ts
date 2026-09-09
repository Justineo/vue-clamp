import { clearCache } from "@chenglou/pretext";
import { clampPreparedLine, prepareLineClamp } from "./clamp.ts";

import type { PrepareOptions } from "@chenglou/pretext";
import type { LineClampPredictionInput, LineClampPredictor } from "../line/predictor.ts";

type Typography = {
  readonly font: string;
  readonly options: PrepareOptions;
};

type PreparedCache = {
  readonly boundary: LineClampPredictionInput["boundary"];
  readonly ellipsis: string;
  readonly prepared: ReturnType<typeof prepareLineClamp>;
  readonly text: string;
  readonly typography: Typography;
};

const maxSharedPreparationLength = 8192;
let fontMetricsDirty = false;
// One width-independent preparation can serve adjacent identical instances.
// Bound retained input size and never cache a rendered clamp result.
let lastPreparation: PreparedCache | null = null;

function fallbackFont(style: CSSStyleDeclaration): string {
  const variant = style.fontVariantCaps === "small-caps" ? "small-caps" : "normal";
  return [
    style.fontStyle,
    variant,
    style.fontWeight,
    style.fontStretch,
    style.fontSize,
    style.fontFamily,
  ].join(" ");
}

function readTypography(element: HTMLElement): Typography {
  const style = getComputedStyle(element);
  const letterSpacing = Number.parseFloat(style.letterSpacing);

  return {
    font: style.font.trim() || fallbackFont(style),
    options: {
      ...(Number.isFinite(letterSpacing) && letterSpacing !== 0 ? { letterSpacing } : {}),
      ...(style.whiteSpace === "pre-wrap" ? { whiteSpace: "pre-wrap" as const } : {}),
      ...(style.wordBreak === "keep-all" ? { wordBreak: "keep-all" as const } : {}),
    },
  };
}

export function createPretextLineClampPredictor(): LineClampPredictor {
  let preparedCache: PreparedCache | null = null;
  let typography: Typography | null = null;

  return {
    invalidate() {
      // All affected instances invalidate before their queued predictions.
      // Clear shared font metrics once when the next prediction needs them.
      fontMetricsDirty = true;
      lastPreparation = null;
      preparedCache = null;
      typography = null;
    },
    predict(input) {
      if (
        !Number.isFinite(input.rootWidth) ||
        !Number.isFinite(input.beforeWidth) ||
        !Number.isFinite(input.afterWidth)
      ) {
        return null;
      }

      typography ??= readTypography(input.textElement);
      if (
        preparedCache === null ||
        preparedCache.text !== input.text ||
        preparedCache.boundary !== input.boundary ||
        preparedCache.ellipsis !== input.ellipsis
      ) {
        if (fontMetricsDirty) {
          clearCache();
          fontMetricsDirty = false;
        }
        const shared = lastPreparation;
        if (
          shared &&
          shared.text === input.text &&
          shared.boundary === input.boundary &&
          shared.ellipsis === input.ellipsis &&
          shared.typography.font === typography.font &&
          shared.typography.options.letterSpacing === typography.options.letterSpacing &&
          shared.typography.options.whiteSpace === typography.options.whiteSpace &&
          shared.typography.options.wordBreak === typography.options.wordBreak
        ) {
          preparedCache = shared;
        } else {
          preparedCache = {
            boundary: input.boundary,
            ellipsis: input.ellipsis,
            prepared: prepareLineClamp(input.text, typography.font, {
              ...typography.options,
              boundary: input.boundary,
              ellipsis: input.ellipsis,
            }),
            text: input.text,
            typography,
          };
          lastPreparation =
            input.text.length + input.ellipsis.length + typography.font.length <=
            maxSharedPreparationLength
              ? preparedCache
              : null;
        }
      }

      return clampPreparedLine(
        preparedCache.prepared,
        input.rootWidth,
        input.lineLimit,
        input.beforeWidth,
        input.afterWidth,
      );
    },
    supports({ ellipsis, lineLimit, locationRatio, maxHeight }) {
      return (
        maxHeight === undefined &&
        lineLimit !== undefined &&
        locationRatio === 1 &&
        !/[\n\r\f]/u.test(ellipsis)
      );
    },
  };
}
