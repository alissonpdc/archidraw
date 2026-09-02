import { DEFAULT_STROKE } from "./types";

/**
 * Color utilities for the canvas renderer. Keeps shapes legible on any
 * theme: strokes/text that use the theme default are resolved to the active
 * `--element-stroke`, and explicit colors get a cached contrast clamp so they
 * never "disappear" against the canvas background.
 *
 * The render loop paints every frame, so nothing here may recompute per
 * element — results are memoized by input string.
 */

interface Rgb {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a: number; // 0-1
}

const clampCache = new Map<string, string>();

const CHANNEL_RE =
  /^rgba?\(\s*([\d.]+)\s*[,/]\s*([\d.]+)\s*[,/]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/i;

/** parse a CSS color to RGB(A); returns null for anything unparseable */
export function parseColor(color: string): Rgb | null {
  const trimmed = color.trim();
  if (trimmed === "transparent" || trimmed === "none") {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  if (trimmed.startsWith("#")) {
    let hex = trimmed.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) return null;
    const n = parseInt(hex.slice(0, 6), 16);
    const a = hex.length === 8 ? parseInt(hex.slice(6), 16) / 255 : 1;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a };
  }
  const m = trimmed.match(CHANNEL_RE);
  if (m) {
    const a = m[4] === undefined ? 1 : parseFloat(m[4]);
    return {
      r: parseFloat(m[1]),
      g: parseFloat(m[2]),
      b: parseFloat(m[3]),
      a: m[4] && m[4].endsWith("%") ? a / 100 : a,
    };
  }
  return null;
}

/** WCAG relative luminance of an opaque RGB color */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** WCAG contrast ratio between two opaque colors (1..21) */
export function contrastRatio(fg: Rgb, bg: Rgb): number {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

function rgbToHsl({ r, g, b }: Rgb): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const hn = ((h % 360) + 360) % 360;
  const sn = Math.min(100, Math.max(0, s)) / 100;
  const ln = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hn < 60) [r, g, b] = [c, x, 0];
  else if (hn < 120) [r, g, b] = [x, c, 0];
  else if (hn < 180) [r, g, b] = [0, c, x];
  else if (hn < 240) [r, g, b] = [0, x, c];
  else if (hn < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255);
  return { r: to(r), g: to(g), b: to(b), a: 1 };
}

function hexOf({ r, g, b }: Rgb): string {
  const to = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * Ensure `color` keeps at least `minRatio` contrast against `bg`, shifting its
 * lightness away from the background while preserving hue/saturation (so the
 * color identity survives). Returns the original string when already legible
 * or not clampable (transparent / translucent / unparseable).
 */
export function ensureContrast(
  color: string,
  bg: string,
  minRatio = 3,
): string {
  const key = `${color}\u0000${bg}\u0000${minRatio}`;
  const hit = clampCache.get(key);
  if (hit !== undefined) return hit;

  const fg = parseColor(color);
  const back = parseColor(bg);
  const result =
    !fg || fg.a < 1 || !back
      ? color
      : clampForBg(fg, back, minRatio) ?? color;

  clampCache.set(key, result);
  return result;
}

function clampForBg(
  fg: Rgb,
  bg: Rgb,
  minRatio: number,
): string | null {
  if (contrastRatio(fg, bg) >= minRatio) return null;
  const bgLight = relativeLuminance(bg) >= 0.5;
  const [h, s] = rgbToHsl(fg);
  // step lightness away from the background until the contrast passes
  let l = rgbToHsl(fg)[2];
  const step = 12;
  for (let i = 0; i < 12; i++) {
    l = bgLight ? Math.max(4, l - step) : Math.min(97, l + step);
    const cand = hslToRgb(h, s, l);
    if (contrastRatio(cand, bg) >= minRatio) return hexOf(cand);
  }
  return null;
}

/**
 * Resolve a color as stored on an element to the color actually drawn:
 *  - the theme default sentinel → the active theme's `--element-stroke`;
 *  - any explicit color → clamped for minimum contrast on the canvas.
 */
export function themeColor(
  color: string,
  elementStroke: string,
  canvasBg: string,
): string {
  if (color === "" || color === "transparent") return "transparent";
  if (color === DEFAULT_STROKE) return elementStroke;
  return ensureContrast(color, canvasBg);
}