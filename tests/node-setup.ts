type CanvasContextMock = {
  font: string;
  measureText: (text: string) => TextMetrics;
};

function createCanvasContext(): CanvasContextMock {
  return {
    font: "16px sans-serif",
    measureText(text: string): TextMetrics {
      const fontSize = Number.parseFloat(this.font) || 16;
      const width = text.length * fontSize * 0.5;

      return {
        actualBoundingBoxAscent: fontSize * 0.8,
        actualBoundingBoxDescent: fontSize * 0.2,
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: width,
        alphabeticBaseline: 0,
        emHeightAscent: fontSize * 0.8,
        emHeightDescent: fontSize * 0.2,
        fontBoundingBoxAscent: fontSize * 0.8,
        fontBoundingBoxDescent: fontSize * 0.2,
        hangingBaseline: 0,
        ideographicBaseline: 0,
        width,
      } as TextMetrics;
    },
  };
}

class OffscreenCanvasMock {
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext(type: string): OffscreenCanvasRenderingContext2D | null {
    if (type !== "2d") {
      return null;
    }

    return createCanvasContext() as unknown as OffscreenCanvasRenderingContext2D;
  }
}

Object.defineProperty(globalThis, "OffscreenCanvas", {
  configurable: true,
  value: OffscreenCanvasMock,
});
