import type {
  ArrowBinding,
  ArrowElement,
  Bounds,
  Camera,
  Element,
  LineElement,
  Point,
} from "./types";

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

// ---- edge (line/arrow) label positioning ---------------------------------

export type EdgeElement = LineElement | ArrowElement;

export const isEdge = (el: Element): el is EdgeElement =>
  el.type === "line" || el.type === "arrow";

/** control point used when drawing curved arrows (shared default) */
export function curvedArrowControl(el: EdgeElement, a: Point, tip: Point): Point {
  const fallback = {
    x: (a.x + tip.x) / 2,
    y: (a.y + tip.y) / 2 - Math.abs(tip.x - a.x) * 0.3,
  };
  return el.type === "arrow" ? (el.controlPoint ?? fallback) : fallback;
}

/** polyline approximation of an edge path (curved arrows are sampled) */
export function edgePathPoints(el: EdgeElement, samples = 32): Point[] {
  const [a, b] = arrowPoints(el);
  const tip = { x: b.x, y: b.y === a.y ? b.y + 1 : b.y };
  const lineType = el.type === "arrow" ? (el.lineType ?? "straight") : "straight";
  if (lineType === "curved") {
    const cp = curvedArrowControl(el, a, tip);
    const pts: Point[] = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const u = 1 - t;
      pts.push({
        x: u * u * a.x + 2 * u * t * cp.x + t * t * tip.x,
        y: u * u * a.y + 2 * u * t * cp.y + t * t * tip.y,
      });
    }
    return pts;
  }
  if (lineType === "auto") {
    // L-shaped routing (horizontal then vertical)
    return [a, { x: tip.x, y: a.y }, tip];
  }
  return [a, tip];
}

function polylineLengths(pts: Point[]): { lens: number[]; total: number } {
  const lens: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    lens.push(len);
    total += len;
  }
  return { lens, total };
}

/** point at arc-length parameter t (0 = start, 1 = end) along the edge */
export function edgePointAt(el: EdgeElement, t: number): Point {
  const pts = edgePathPoints(el);
  const { lens, total } = polylineLengths(pts);
  if (total === 0) return pts[0];
  let remaining = clamp(t, 0, 1) * total;
  for (let i = 0; i < lens.length; i++) {
    if (remaining <= lens[i] || i === lens.length - 1) {
      const f = lens[i] === 0 ? 0 : remaining / lens[i];
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * f,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * f,
      };
    }
    remaining -= lens[i];
  }
  return pts[pts.length - 1];
}

/** arc-length parameter (0..1) of the point on the edge closest to p */
export function edgeParamAt(el: EdgeElement, p: Point): number {
  const pts = edgePathPoints(el, 64);
  const { lens, total } = polylineLengths(pts);
  if (total === 0) return 0.5;
  let acc = 0;
  let bestT = 0;
  let bestDist = Infinity;
  for (let i = 0; i < lens.length; i++) {
    const a = pts[i];
    const dx = pts[i + 1].x - a.x;
    const dy = pts[i + 1].y - a.y;
    const lenSq = dx * dx + dy * dy;
    let f = lenSq === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    f = clamp(f, 0, 1);
    const d = Math.hypot(p.x - (a.x + f * dx), p.y - (a.y + f * dy));
    if (d < bestDist) {
      bestDist = d;
      bestT = (acc + f * lens[i]) / total;
    }
    acc += lens[i];
  }
  return clamp(bestT, 0, 1);
}

/** label center of a line/arrow (null for other element types) */
export function edgeLabelAnchor(el: Element): Point | null {
  if (!isEdge(el)) return null;
  return edgePointAt(el, el.labelT ?? 0.5);
}

/** the four vertices of a diamond inscribed in the element bbox */
export function diamondVertices(el: Element): Point[] {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  return [
    { x: cx, y: el.y },
    { x: el.x + el.width, y: cy },
    { x: cx, y: el.y + el.height },
    { x: el.x, y: cy },
  ];
}

export function translateElement(el: Element, dx: number, dy: number): Element {
  return { ...el, x: el.x + dx, y: el.y + dy };
}

/** absolute point of a binding (normalized position within element bounds) */
export function bindingPoint(el: Element, binding: ArrowBinding): Point {
  const b = elementBounds(el);
  return {
    x: b.x1 + clamp(binding.nx, 0, 1) * (b.x2 - b.x1),
    y: b.y1 + clamp(binding.ny, 0, 1) * (b.y2 - b.y1),
  };
}

/** nearest point on the element outline from p (per-shape geometry) */
export function nearestOutlinePoint(el: Element, p: Point): Point {
  const b = elementBounds(el);
  const cx = (b.x1 + b.x2) / 2;
  const cy = (b.y1 + b.y2) / 2;
  const hw = (b.x2 - b.x1) / 2;
  const hh = (b.y2 - b.y1) / 2;
  if (el.type === "ellipse") {
    // radial projection of the direction onto the ellipse
    const dx = p.x - cx;
    const dy = p.y - cy;
    if (dx === 0 && dy === 0) return { x: cx + hw, y: cy };
    const t = 1 / Math.hypot(dx / (hw || 1), dy / (hh || 1));
    return { x: cx + dx * t, y: cy + dy * t };
  }
  if (el.type === "diamond") {
    // radial projection onto the rhombus |dx|/hw + |dy|/hh = 1
    const dx = p.x - cx;
    const dy = p.y - cy;
    if (dx === 0 && dy === 0) return { x: cx + hw, y: cy };
    const t = 1 / (Math.abs(dx) / (hw || 1) + Math.abs(dy) / (hh || 1));
    return { x: cx + dx * t, y: cy + dy * t };
  }
  // rectangle outline: clamp to the border; points inside project to the
  // nearest edge
  const qx = clamp(p.x, b.x1, b.x2);
  const qy = clamp(p.y, b.y1, b.y2);
  if (qx !== p.x || qy !== p.y) return { x: qx, y: qy };
  const dl = p.x - b.x1;
  const dr = b.x2 - p.x;
  const dt = p.y - b.y1;
  const db = b.y2 - p.y;
  const m = Math.min(dl, dr, dt, db);
  if (m === dl) return { x: b.x1, y: p.y };
  if (m === dr) return { x: b.x2, y: p.y };
  if (m === dt) return { x: p.x, y: b.y1 };
  return { x: p.x, y: b.y2 };
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
