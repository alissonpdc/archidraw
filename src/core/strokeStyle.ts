import type { StrokeStyle } from "./types";

/** canvas line-dash array for a stroke style — single source of truth for
 *  both the canvas renderer and the SVG exporter (which joins the values). */
export function strokeDashArray(style: StrokeStyle, strokeWidth: number): number[] {
  switch (style) {
    case "dashed":
      return [strokeWidth * 5, strokeWidth * 4];
    case "dotted":
      return [strokeWidth * 0.01 + 0.01, strokeWidth * 2.6];
    case "dashdot":
      return [
        strokeWidth * 5,
        strokeWidth * 3,
        strokeWidth * 0.01 + 0.01,
        strokeWidth * 3,
      ];
    default:
      return [];
  }
}

/** round line-cap is required by dotted / dash-dot patterns to render dots */
export function strokeRoundCap(style: StrokeStyle): boolean {
  return style === "dotted" || style === "dashdot";
}