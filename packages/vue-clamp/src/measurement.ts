export function parsePx(value: string | null | undefined): number | undefined {
  if (!value || value === "none" || value === "normal") {
    return undefined;
  }

  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function fontShorthand(style: CSSStyleDeclaration): string {
  if (style.font && style.font.length > 0) {
    return style.font;
  }

  const size = style.fontSize || "16px";
  const family = style.fontFamily || "sans-serif";
  const prefix = [style.fontStyle, style.fontVariant, style.fontWeight, style.fontStretch].filter(
    (part) => part && part !== "normal",
  );

  return prefix.length > 0 ? `${prefix.join(" ")} ${size} ${family}` : `${size} ${family}`;
}

export function contentWidth(element: HTMLElement): number {
  const style = getComputedStyle(element);
  const padding = (parsePx(style.paddingLeft) ?? 0) + (parsePx(style.paddingRight) ?? 0);
  const border = (parsePx(style.borderLeftWidth) ?? 0) + (parsePx(style.borderRightWidth) ?? 0);
  const styledWidth = parsePx(style.width);

  if (styledWidth !== undefined) {
    const extra = style.boxSizing === "border-box" ? padding + border : 0;
    return Math.max(0, styledWidth - extra);
  }

  const rectWidth = element.getBoundingClientRect().width;
  if (Number.isFinite(rectWidth) && rectWidth > 0) {
    return Math.max(0, rectWidth - padding - border);
  }

  return 0;
}

export function measureWidth(element: HTMLElement | null): number {
  if (!element) {
    return 0;
  }

  return element.getBoundingClientRect().width;
}

export function boxHeightOffset(element: HTMLElement | null): number {
  if (!element) {
    return 0;
  }

  const style = getComputedStyle(element);
  if (style.boxSizing !== "border-box") {
    return 0;
  }

  return (
    (parsePx(style.paddingTop) ?? 0) +
    (parsePx(style.paddingBottom) ?? 0) +
    (parsePx(style.borderTopWidth) ?? 0) +
    (parsePx(style.borderBottomWidth) ?? 0)
  );
}

export function lineHeight(
  textElement: HTMLElement | null,
  probeElement: HTMLElement | null,
): number {
  if (!textElement) {
    return 0;
  }

  const style = getComputedStyle(textElement);
  const computedLineHeight = parsePx(style.lineHeight);
  if (computedLineHeight !== undefined) {
    return computedLineHeight;
  }

  return probeElement?.getBoundingClientRect().height ?? 0;
}
