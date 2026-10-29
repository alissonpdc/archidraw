import type { Element, TextAlign, TextVAlign } from "./types";
import type { RenderColors } from "./renderer";
import { themeColor } from "./color";

export const DEFAULT_FONT_FAMILY = '"Segoe UI", system-ui, sans-serif';
export const SKETCH_FONT_FAMILY = '"Architects Daughter", cursive';
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

export function defaultFontFamily(roughness: number = 0): string {
  return roughness >= 1 ? SKETCH_FONT_FAMILY : DEFAULT_FONT_FAMILY;
}

export function fontFamilyOf(el: { fontFamily?: string; roughness?: number }): string {
  return el.fontFamily || defaultFontFamily(el.roughness);
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

/**
 * Text element (`type: "text"`) insets. Unlike shape labels, whose base inset
 * defaults to 8, a free text box starts flush with its measured content, so
 * the base offset defaults to 0. Only the side named by `textAlign` /
 * `textVAlign` contributes its per-side offset; centered/middle ignores them.
 */
export function textElementOffsets(el: Element): { padX: number; padY: number } {
  const g = el.textOffsetGlobal ?? 0;
  const align = el.textAlign ?? "left";
  const vAlign = el.textVAlign ?? "middle";
  return {
    padX:
      g +
      (align === "left"
        ? el.textOffsetLeft ?? 0
        : align === "right"
          ? el.textOffsetRight ?? 0
          : 0),
    padY:
      g +
      (vAlign === "top"
        ? el.textOffsetTop ?? 0
        : vAlign === "bottom"
          ? el.textOffsetBottom ?? 0
          : 0),
  };
}

/** scene Y of the first line's top for a `text` element block of `blockH` px */
export function textBlockTop(el: Element, blockH: number): number {
  const vAlign = el.textVAlign ?? "middle";
  const { padY } = textElementOffsets(el);
  if (vAlign === "top") return el.y + padY;
  if (vAlign === "bottom") return el.y + el.height - padY - blockH;
  return el.y + Math.max(0, (el.height - blockH) / 2);
}

/**
 * Adjusts a text element's bounding box when its measured dimensions change,
 * preserving its anchor point according to `textAlign` and `textVAlign`.
 */
export function anchorTextBounds(
  orig: { x: number; y: number; width: number; height: number },
  newWidth: number,
  newHeight: number,
  textAlign: TextAlign = "left",
  textVAlign?: TextVAlign,
): { x: number; y: number; width: number; height: number } {
  let x = orig.x;
  if (textAlign === "center") {
    x = orig.x + (orig.width - newWidth) / 2;
  } else if (textAlign === "right") {
    x = orig.x + (orig.width - newWidth);
  }

  let y = orig.y;
  if (textVAlign === "middle") {
    y = orig.y + (orig.height - newHeight) / 2;
  } else if (textVAlign === "bottom") {
    y = orig.y + (orig.height - newHeight);
  }

  return { x, y, width: newWidth, height: newHeight };
}

