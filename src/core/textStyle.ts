import type { Element } from "./types";
import type { RenderColors } from "./renderer";
import { themeColor } from "./color";

const DEFAULT_FONT_FAMILY = '"Segoe UI", system-ui, sans-serif';
const DEFAULT_LINE_HEIGHT = 1.25;

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
  const family = el.fontFamily || DEFAULT_FONT_FAMILY;
  const style = el.italic ? "italic " : "";
  const weight = el.bold ? "bold " : "";
  return `${style}${weight}${size}px ${family}`;
}

/** effective line height multiplier for an element */
export function lineHeight(el: Element): number {
  return el.lineSpacing ?? DEFAULT_LINE_HEIGHT;
}

/** text underline decoration */
export function textDecoration(el: Element): string {
  return el.underline ? "underline" : "none";
}
