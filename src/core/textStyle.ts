import type { Element } from "./types";
import type { RenderColors } from "./renderer";
import { themeColor } from "./color";

export const DEFAULT_FONT_FAMILY = '"Segoe UI", system-ui, sans-serif';
export const DEFAULT_LINE_HEIGHT = 1.25;

/** build a CSS font string from raw text props (shared by font/measure) */
export function buildFontString(
  fontSize: number,
  family = DEFAULT_FONT_FAMILY,
  bold?: boolean,
  italic?: boolean,
): string {
  const style = italic ? "italic " : "";
  const weight = bold ? "bold " : "";
  return `${style}${weight}${fontSize}px ${family}`;
}

/** effective font family string for an element */
export function fontFamilyOf(el: Element): string {
  return el.fontFamily || DEFAULT_FONT_FAMILY;
}

/** render height of a text block with the given line count */
export function textBlockHeight(
  fontSize: number,
  lineCount: number,
  lh: number,
): number {
  const n = Math.max(lineCount, 1);
  return n === 1 ? fontSize : (n - 1) * fontSize * lh + fontSize;
}

/** resolve the effective text color: element's textColor → strokeColor → theme */
export function resolveTextColor(el: Element, colors: RenderColors): string {
  const tc = el.textColor && el.textColor !== "" ? el.textColor : null;
  let color: string;
  if (!tc) {
    color = el.strokeColor === "" ? "transparent" : el.strokeColor;
  } else {
    color = tc;
  }
  return themeColor(color, colors.elementStroke, colors.canvasBg);
}

/** build a CSS font string from element text props */
export function resolveFont(el: Element, fontSizeOverride?: number): string {
  const size = fontSizeOverride ?? el.fontSize ?? 20;
  return buildFontString(size, fontFamilyOf(el), el.bold, el.italic);
}

/** effective line height multiplier for an element */
export function lineHeight(el: Element): number {
  return el.lineSpacing ?? DEFAULT_LINE_HEIGHT;
}

/** text underline decoration */
export function textDecoration(el: Element): string {
  return el.underline ? "underline" : "none";
}
