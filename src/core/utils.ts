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

/** escapes a string for safe embedding in XML/SVG text and attributes */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/** corner radius in scene px for a rectangle/component (0–100% of the smaller side) */
export function cornerRadius(el: Element): number {
  if ((el.type !== "rectangle" && el.type !== "component") || el.borderRadius <= 0)
    return 0;
  const max = Math.min(Math.abs(el.width), Math.abs(el.height)) / 2;
  return (Math.min(100, el.borderRadius) / 100) * max;
}

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

/** arrowhead length: stroke-relative, clamped to a minimum */
export function arrowHeadSize(el: Element): number {
  return Math.max(9.7, el.strokeWidth * 3.24);
}

/** the two wing endpoints of an arrowhead drawn from tip toward tail */
export function arrowHeadVectors(tip: Point, tail: Point, size: number): [Point, Point] {
  const angle = Math.atan2(tip.y - tail.y, tip.x - tail.x);
  return [
    {
      x: tip.x - size * Math.cos(angle - Math.PI / 8),
      y: tip.y - size * Math.sin(angle - Math.PI / 8),
    },
    {
      x: tip.x - size * Math.cos(angle + Math.PI / 8),
      y: tip.y - size * Math.sin(angle + Math.PI / 8),
    },
  ];
}

// ---- edge (line/arrow) label positioning ---------------------------------

export type EdgeElement = LineElement | ArrowElement;

export const isEdge = (el: Element): el is EdgeElement =>
  el.type === "line" || el.type === "arrow";

/** control point used when drawing curved edges (shared default) */
export function curvedArrowControl(el: EdgeElement, a: Point, tip: Point): Point {
  const fallback = {
    x: (a.x + tip.x) / 2,
    y: (a.y + tip.y) / 2 - Math.abs(tip.x - a.x) * 0.3,
  };
  return el.controlPoint ?? fallback;
}

/** polyline approximation of an edge path (curved edges are sampled) */
export function edgePathPoints(el: EdgeElement, samples = 32): Point[] {
  const [a, b] = arrowPoints(el);
  const tip = { x: b.x, y: b.y === a.y ? b.y + 1 : b.y };
  const lineType = el.lineType ?? "straight";
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
    const bends = el.bendPoints ?? [];
    if (bends.length === 0) {
      // default L-shaped routing (horizontal then vertical)
      return [a, { x: tip.x, y: a.y }, tip];
    }
    return [a, ...bends, tip];
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
  const next = { ...el, x: el.x + dx, y: el.y + dy };
  // translate absolute control/bend points for edges
  if ((el.type === "line" || el.type === "arrow")) {
    const e = el as LineElement | ArrowElement;
    if (e.controlPoint) {
      (next as LineElement | ArrowElement).controlPoint = { x: e.controlPoint.x + dx, y: e.controlPoint.y + dy };
    }
    if (e.bendPoints) {
      (next as LineElement | ArrowElement).bendPoints = e.bendPoints.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    }
  }
  return next;
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

// ---- edge hit-testing helpers -------------------------------------------

/** minimum distance from point p to a polyline defined by pts */
export function distanceToPolyline(p: Point, pts: Point[]): number {
  let min = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distanceToSegment(p, pts[i], pts[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

/** approximate minimum distance from point p to a quadratic Bézier curve a→tip via cp */
export function distanceToQuadraticBezier(p: Point, a: Point, cp: Point, tip: Point, samples = 32): number {
  let min = Infinity;
  for (let i = 0; i < samples; i++) {
    const t0 = i / samples;
    const t1 = (i + 1) / samples;
    const u0 = 1 - t0;
    const u1 = 1 - t1;
    const p0 = {
      x: u0 * u0 * a.x + 2 * u0 * t0 * cp.x + t0 * t0 * tip.x,
      y: u0 * u0 * a.y + 2 * u0 * t0 * cp.y + t0 * t0 * tip.y,
    };
    const p1 = {
      x: u1 * u1 * a.x + 2 * u1 * t1 * cp.x + t1 * t1 * tip.x,
      y: u1 * u1 * a.y + 2 * u1 * t1 * cp.y + t1 * t1 * tip.y,
    };
    const d = distanceToSegment(p, p0, p1);
    if (d < min) min = d;
  }
  return min;
}

/** min distance from point p to the actual path of an edge element */
export function edgeDistance(el: EdgeElement, p: Point): number {
  const [a, b] = arrowPoints(el);
  const tip = { x: b.x, y: b.y === a.y ? b.y + 1 : b.y };
  const lineType = el.lineType ?? "straight";
  if (lineType === "curved") {
    const cp = curvedArrowControl(el, a, tip);
    return distanceToQuadraticBezier(p, a, cp, tip);
  }
  return distanceToPolyline(p, edgePathPoints(el));
}

/** find the closest segment of a polyline to point p and return the
 *  insertion index (1..pts.length-2) and the projected point on that segment */
export function findInsertPosition(
  p: Point,
  pts: Point[],
): { index: number; point: Point } {
  let bestDist = Infinity;
  let bestIndex = 1;
  let bestPoint = pts[0];
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    const dy = pts[i + 1].y - pts[i].y;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((p.x - pts[i].x) * dx + (p.y - pts[i].y) * dy) / lenSq;
    t = clamp(t, 0, 1);
    const proj = { x: pts[i].x + t * dx, y: pts[i].y + t * dy };
    const d = Math.hypot(p.x - proj.x, p.y - proj.y);
    if (d < bestDist) {
      bestDist = d;
      bestIndex = i + 1;
      bestPoint = proj;
    }
  }
  return { index: bestIndex, point: bestPoint };
}

/** tolerance for treating auto-path coordinates as axis-aligned (scene units) */
const ORTHO_EPS = 0.01;

/**
 * closest orthogonal segment of an auto-mode path to point p, with the drag
 * axis it exposes: "x" for a vertical segment (drags horizontally), "y" for
 * a horizontal one (drags vertically). Diagonal segments produced by free
 * bend points are not draggable. Null for non-auto edges.
 */
export function autoSegmentAt(
  p: Point,
  el: EdgeElement,
): { index: number; dist: number; axis: "x" | "y" } | null {
  if ((el.lineType ?? "straight") !== "auto") return null;
  const pts = edgePathPoints(el);
  let best: { index: number; dist: number; axis: "x" | "y" } | null = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = Math.abs(pts[i + 1].x - pts[i].x);
    const dy = Math.abs(pts[i + 1].y - pts[i].y);
    if (dx > ORTHO_EPS && dy > ORTHO_EPS) continue;
    const d = distanceToSegment(p, pts[i], pts[i + 1]);
    if (!best || d < best.dist) {
      best = { index: i, dist: d, axis: dx < dy ? "x" : "y" };
    }
  }
  return best;
}

/** drops duplicate and collinear middle points from a polyline */
function simplifyPolyline(pts: Point[]): Point[] {
  const dedup: Point[] = [];
  for (const p of pts) {
    const last = dedup[dedup.length - 1];
    if (
      last &&
      Math.abs(last.x - p.x) < ORTHO_EPS &&
      Math.abs(last.y - p.y) < ORTHO_EPS
    ) {
      continue;
    }
    dedup.push(p);
  }
  let out = dedup;
  for (;;) {
    let removed = false;
    const next: Point[] = [];
    for (let i = 0; i < out.length; i++) {
      if (i > 0 && i < out.length - 1) {
        const ax = out[i].x - out[i - 1].x;
        const ay = out[i].y - out[i - 1].y;
        const bx = out[i + 1].x - out[i].x;
        const by = out[i + 1].y - out[i].y;
        if (Math.abs(ax * by - ay * bx) < ORTHO_EPS) {
          removed = true;
          continue;
        }
      }
      next.push(out[i]);
    }
    out = next;
    if (!removed) break;
  }
  return out;
}

/** lead-out margin (scene units) kept between a bound shape's anchor and
 *  the first turn of a dragged auto path, so the routed line never rides
 *  on the shape outline right at the binding point */
const BOUND_ENDPOINT_MARGIN = 16;

/**
 * bends for an auto-mode edge after dragging the polyline segment `index`
 * by `d` along its perpendicular axis, keeping the path orthogonal: the
 * dragged segment slides/stretches and perpendicular stubs reconnect it to
 * the untouched rest of the path. The edge endpoints never move; at a bound
 * endpoint the turn happens `BOUND_ENDPOINT_MARGIN` away from the anchor,
 * preserving the original exit/entry direction. Returns undefined when the
 * result matches the default L-shaped routing.
 */
export function autoDragSegmentBends(
  el: EdgeElement,
  index: number,
  d: number,
): Point[] | undefined {
  if ((el.lineType ?? "straight") !== "auto") return el.bendPoints;
  const pts = edgePathPoints(el);
  if (index < 0 || index >= pts.length - 1) return el.bendPoints;
  const horiz =
    Math.abs(pts[index + 1].y - pts[index].y) <=
    Math.abs(pts[index + 1].x - pts[index].x);
  const moved = (p: Point): Point =>
    horiz ? { x: p.x, y: p.y + d } : { x: p.x + d, y: p.y };
  const isMoved = pts.map(
    (_, i) =>
      (i === index || i === index + 1) && i > 0 && i < pts.length - 1,
  );
  const next = pts.map((p, i) => (isMoved[i] ? moved(p) : p));
  const last = pts.length - 1;
  const aligned = (a: Point, b: Point) =>
    Math.abs(a.x - b.x) <= ORTHO_EPS || Math.abs(a.y - b.y) <= ORTHO_EPS;
  // reconnect the moved segment to the untouched path: each misaligned
  // junction gets a stub point so every segment stays horizontal/vertical
  const withStubs: Point[] = [next[0]];
  for (let i = 1; i < next.length; i++) {
    const prev = next[i - 1];
    const cur = next[i];
    if (aligned(prev, cur)) {
      withStubs.push(cur);
      continue;
    }
    // bound endpoint: run the original exit/entry direction for a margin,
    // then turn — instead of turning right at the anchor
    if (i === 1 && el.startBinding) {
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      if (Math.abs(dx) <= ORTHO_EPS || Math.abs(dy) <= ORTHO_EPS) {
        const m = Math.min(BOUND_ENDPOINT_MARGIN, Math.hypot(dx, dy));
        const turn = {
          x: pts[0].x + Math.sign(dx) * m,
          y: pts[0].y + Math.sign(dy) * m,
        };
        withStubs.push(turn);
        if (!aligned(turn, cur)) {
          withStubs.push(
            dx !== 0 ? { x: turn.x, y: cur.y } : { x: cur.x, y: turn.y },
          );
        }
        withStubs.push(cur);
        continue;
      }
    }
    if (i === last && el.endBinding) {
      const dx = pts[last].x - pts[last - 1].x;
      const dy = pts[last].y - pts[last - 1].y;
      if (Math.abs(dx) <= ORTHO_EPS || Math.abs(dy) <= ORTHO_EPS) {
        const m = Math.min(BOUND_ENDPOINT_MARGIN, Math.hypot(dx, dy));
        const turn = {
          x: pts[last].x - Math.sign(dx) * m,
          y: pts[last].y - Math.sign(dy) * m,
        };
        if (!aligned(prev, turn)) {
          withStubs.push(
            dx !== 0 ? { x: turn.x, y: prev.y } : { x: prev.x, y: turn.y },
          );
        }
        withStubs.push(turn);
        withStubs.push(cur);
        continue;
      }
    }
    // plain stub: keep the moved point's travel parallel to the dragged
    // segment and close the gap perpendicularly into the fixed one
    if (isMoved[i]) {
      withStubs.push(horiz ? { x: prev.x, y: cur.y } : { x: cur.x, y: prev.y });
    } else if (isMoved[i - 1]) {
      withStubs.push(horiz ? { x: cur.x, y: prev.y } : { x: prev.x, y: cur.y });
    }
    withStubs.push(cur);
  }
  const bends = simplifyPolyline(withStubs).slice(1, -1);
  return bends.length > 0 ? bends : undefined;
}

/**
 * magnet for a dragged auto-path segment: when the moving segment's axis
 * coordinate gets within `threshold` of another segment's axis (or an
 * endpoint coordinate) on the same path, the delta snaps so both align
 * exactly and merge into a single segment. Returns the effective delta and
 * the snapped axis value (null when free).
 */
export function snapSegmentDelta(
  el: EdgeElement,
  index: number,
  rawD: number,
  threshold: number,
): { delta: number; target: number | null } {
  const pts = edgePathPoints(el);
  if (index < 0 || index >= pts.length - 1) {
    return { delta: rawD, target: null };
  }
  const horiz =
    Math.abs(pts[index + 1].y - pts[index].y) <=
    Math.abs(pts[index + 1].x - pts[index].x);
  const orig = horiz ? pts[index].y : pts[index].x;
  const targets: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    if (i === index) continue;
    const ddx = Math.abs(pts[i + 1].x - pts[i].x);
    const ddy = Math.abs(pts[i + 1].y - pts[i].y);
    if (horiz) {
      if (ddy <= ORTHO_EPS && ddx > ORTHO_EPS) targets.push(pts[i].y);
    } else {
      if (ddx <= ORTHO_EPS && ddy > ORTHO_EPS) targets.push(pts[i].x);
    }
  }
  const tip = pts[pts.length - 1];
  targets.push(horiz ? pts[0].y : pts[0].x, horiz ? tip.y : tip.x);
  const moving = orig + rawD;
  let best: number | null = null;
  for (const t of targets) {
    if (Math.abs(t - orig) <= ORTHO_EPS) continue; // never snap to itself
    const diff = Math.abs(t - moving);
    if (diff <= threshold && (best === null || diff < Math.abs(best - moving))) {
      best = t;
    }
  }
  return best === null
    ? { delta: rawD, target: null }
    : { delta: best - orig, target: best };
}

// ---- text measurement --------------------------------------------------

import {
  buildFontString,
  DEFAULT_FONT_FAMILY,
  DEFAULT_LINE_HEIGHT,
  textBlockHeight,
} from "./textStyle";

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
  lineSpacing: number = DEFAULT_LINE_HEIGHT,
): { width: number; height: number } {
  const lines = text.split("\n");
  const height = textBlockHeight(fontSize, lines.length, lineSpacing);
  const ctx = getMeasureCtx();
  if (ctx) {
    ctx.font = buildFontString(fontSize, fontFamily || DEFAULT_FONT_FAMILY, bold, italic);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);
    return { width: Math.ceil(widest), height };
  }
  const widestChars = Math.max(...lines.map((l) => l.length), 1);
  return { width: widestChars * fontSize * 0.6, height };
}
