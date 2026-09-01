import { inject, provide } from "vue";

import type { InjectionKey } from "vue";
import type { ClampBoundary, ClampLength } from "../types.ts";

type LineClampPredictorContext = {
  readonly boundary: ClampBoundary;
  readonly ellipsis: string;
  readonly lineLimit: number | undefined;
  readonly locationRatio: number;
  readonly maxHeight: ClampLength | undefined;
};

export type LineClampPredictionInput = {
  readonly afterWidth: number;
  readonly beforeWidth: number;
  readonly boundary: ClampBoundary;
  readonly ellipsis: string;
  readonly lineLimit: number;
  readonly rootWidth: number;
  readonly text: string;
  readonly textElement: HTMLElement;
};

export type LineClampPredictor = {
  readonly invalidate: () => void;
  readonly predict: (input: LineClampPredictionInput) => {
    readonly clamped: boolean;
    readonly text: string;
  } | null;
  readonly supports: (context: LineClampPredictorContext) => boolean;
};

const predictorKey: InjectionKey<LineClampPredictor | null> = Symbol("LineClampPredictor");

export function provideLineClampPredictor(predictor: LineClampPredictor): void {
  provide(predictorKey, predictor);
}

export function useLineClampPredictor(): LineClampPredictor | null {
  const predictor = inject(predictorKey, null);
  // The provider decorates only its direct LineClamp child. Slot descendants
  // must select their own package entry instead of inheriting this engine.
  if (predictor) provide(predictorKey, null);
  return predictor;
}
