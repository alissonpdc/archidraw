import type { Bounds, Camera, Element, Point } from "./types";

let seed = 0;
export const newId = () =>
  `el_${Date.now().toString(36)}_${(seed++).toString(36)}`;

export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export function screenToScene(p: Point, cam: Camera): Point {
  return { x: (p.x - cam.scrollX) / cam.zoom, y: (p.y - cam.scrollY) / cam.zoom };
}

export function sceneToScreen(p: Point, cam: Camera): Point {
  return { x: p.x * cam.zoom + cam.scrollX, y: p.y * cam.zoom + cam.scrollY };
}

export function elementBounds(el: Element): Bounds {
  return normalizeBounds({
    x1: el.x,
    y1: el.y,
    x2: el.x + el.width,
    y2: el.y + el.height,
  });
}

export function normalizeBounds(b: Bounds): Bounds {
  return {
    x1: Math.min(b.x1, b.x2),
    y1: Math.min(b.y1, b.y2),
    x2: Math.max(b.x1, b.x2),
    y2: Math.max(b.y1, b.y2),
  };
}

export function boundsContain(outer: Bounds, inner: Bounds): boolean {
  return (
    outer.x1 <= inner.x1 &&
    outer.y1 <= inner.y1 &&
    outer.x2 >= inner.x2 &&
    outer.y2 >= inner.y2
  );
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = clamp(t, 0, 1);
  const proj = { x: a.x + t * dx, y: a.y + t * dy };
  return Math.hypot(p.x - proj.x, p.y - proj.y);
}

export function arrowPoints(el: Element): [Point, Point] {
  return [
    { x: el.x, y: el.y },
    { x: el.x + el.width, y: el.y + el.height },
  ];
}

export function translateElement(el: Element, dx: number, dy: number): Element {
  return { ...el, x: el.x + dx, y: el.y + dy };
}

/** union bounding box of all elements; null when empty */
export function unionBounds(elements: Element[]): Bounds | null {
  if (elements.length === 0) return null;
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const el of elements) {
    const b = elementBounds(el);
    x1 = Math.min(x1, b.x1);
    y1 = Math.min(y1, b.y1);
    x2 = Math.max(x2, b.x2);
    y2 = Math.max(y2, b.y2);
  }
  return { x1, y1, x2, y2 };
}

// ---- text measurement --------------------------------------------------

const LINE_HEIGHT = 1.25;
const DEFAULT_FONT_FAMILY = '"Segoe UI", system-ui, sans-serif';

let measureCtx: CanvasRenderingContext2D | null | undefined;

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (measureCtx === undefined) {
    const canvas =
      typeof document !== "undefined" ? document.createElement("canvas") : null;
    measureCtx = canvas ? canvas.getContext("2d") : null;
  }
  return measureCtx;
}

/** measures a multiline text block; falls back to a heuristic without DOM */
export function measureText(
  text: string,
  fontSize: number,
  fontFamily?: string,
  bold?: boolean,
  italic?: boolean,
  lineSpacing: number = LINE_HEIGHT,
): { width: number; height: number } {
  const lines = text.split("\n");
  const n = Math.max(lines.length, 1);
  const height = n === 1 ? fontSize : (n - 1) * fontSize * lineSpacing + fontSize;
  const ctx = getMeasureCtx();
  if (ctx) {
    const family = fontFamily || DEFAULT_FONT_FAMILY;
    const style = italic ? "italic " : "";
    const weight = bold ? "bold " : "";
    ctx.font = `${style}${weight}${fontSize}px ${family}`;
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);
    return { width: Math.ceil(widest), height };
  }
  const widestChars = Math.max(...lines.map((l) => l.length), 1);
  return { width: widestChars * fontSize * 0.6, height };
}
