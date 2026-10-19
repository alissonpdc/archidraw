import { difference, intersection, union } from "polygon-clipping";
import type { Element, Point, PolygonElement } from "./types";
import { diamondLoop, ellipseLoop, roundedRectLoop } from "./roughPath";
import { elementAngle, elementCenter, newId, rotatePoint } from "./utils";

export type BooleanOp = "union" | "subtract" | "intersect" | "crop";

export const BOOLEAN_OPS: readonly BooleanOp[] = [
  "union",
  "subtract",
  "intersect",
  "crop",
];

/** element types a boolean op can consume (closed, filled shapes) */
export const BOOLEAN_SOURCE_TYPES: readonly string[] = [
  "rectangle",
  "diamond",
  "ellipse",
  "polygon",
];

export function isBooleanSource(el: Element): boolean {
  return !el.locked && BOOLEAN_SOURCE_TYPES.includes(el.type);
}

/** every op needs the same thing: >= 2 unlocked closed shapes in doc order */
export function selectionIsBooleanSource(elements: Element[]): boolean {
  return elements.length >= 2 && elements.every(isBooleanSource);
}

export type GeoRing = [number, number][];
export type GeoPolygon = GeoRing[];
export type GeoMultiPolygon = GeoPolygon[];

type Ring = GeoRing;
type Polygon = GeoPolygon;

/** removes the duplicated closing point in place (GeoJSON rings repeat the start) */
function dropClosingPoint(pts: Point[]): Point[] {
  if (pts.length > 1) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (
      Math.abs(first.x - last.x) < 1e-9 &&
      Math.abs(first.y - last.y) < 1e-9
    ) {
      pts.pop();
    }
  }
  return pts;
}

/** absolute (scene frame, rotation applied) closed loops of one element */
export function booleanSourceLoops(el: Element): Point[][] {
  let loops: Point[][];
  if (el.type === "ellipse") {
    loops = [ellipseLoop(el.x, el.y, el.width, el.height)];
  } else if (el.type === "diamond") {
    loops = [diamondLoop(el)];
  } else if (el.type === "polygon") {
    loops = el.rings.map((ring) =>
      ring.map((p) => ({ x: el.x + p.x, y: el.y + p.y })),
    );
  } else {
    loops = [
      roundedRectLoop(el.x, el.y, el.width, el.height, 0),
    ];
  }
  const angle = elementAngle(el);
  if (angle === 0) return loops;
  const center = elementCenter(el);
  return loops.map((loop) =>
    loop.map((p) => rotatePoint(p, center, angle)),
  );
}

/** closed Point[] loop -> GeoJSON ring (open, no duplicated end point) */
function toRing(loop: Point[]): Ring {
  return dropClosingPoint(loop).map((p) => [p.x, p.y]);
}

function sourceGeometry(el: Element): Polygon {
  return booleanSourceLoops(el).map(toRing);
}

/** first geometry is the union of everything below the topmost element */
function unionAll(geometries: Polygon[]): Polygon[] {
  return union(geometries[0], ...geometries.slice(1));
}

/**
 * Resolves the boolean op over the selected shapes (doc order: the LAST
 * element is the topmost one). `union`/`intersect` are order-independent;
 * `subtract` and `crop` use the topmost shape as the cutter/mask.
 * Throws with the offending type when the selection is not all closed shapes.
 *
 * Example: `combineSelected("subtract", [base, cutter])` → MultiPolygon.
 */
export function combineSelected(
  op: BooleanOp,
  elements: Element[],
): GeoMultiPolygon {
  if (!selectionIsBooleanSource(elements)) {
    const types = elements.map((el) => el.type).join(", ");
    throw new Error(
      `boolean op "${op}" needs >= 2 unlocked closed shapes ` +
        `(${BOOLEAN_SOURCE_TYPES.join("|")}), got [${types}]`,
    );
  }
  const geoms = elements.map(sourceGeometry);
  const below = geoms.slice(0, -1);
  const top = geoms[geoms.length - 1];
  if (op === "union") return unionAll(geoms);
  if (op === "intersect") return intersection(geoms[0], ...geoms.slice(1));
  if (op === "subtract") return difference(unionAll(below), top);
  return intersection(unionAll(below), top);
}

interface RingBounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function ringSetBounds(rings: GeoPolygon): RingBounds {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < x1) x1 = x;
      if (y < y1) y1 = y;
      if (x > x2) x2 = x;
      if (y > y2) y2 = y;
    }
  }
  return { x1, y1, x2, y2 };
}

/** drops the duplicated closing point (GeoJSON keeps it, the model does not) */
function openRing(ring: GeoRing, originX: number, originY: number): Point[] {
  const pts = ring.map(([x, y]) => ({ x: x - originX, y: y - originY }));
  return dropClosingPoint(pts);
}

/**
 * One `polygon` element per connected solid of the result, borrowing the
 * stroke/fill style of `source` (the topmost operand). Degenerate slivers
 * (area ≈ 0, e.g. two shapes touching along an edge) are dropped.
 *
 * Example: `polygonsToElements(combineSelected("union", [a, b]), b)`.
 */
export function polygonsToElements(
  result: GeoMultiPolygon,
  source: Element,
): PolygonElement[] {
  const elements: PolygonElement[] = [];
  for (const poly of result) {
    const b = ringSetBounds(poly);
    const width = b.x2 - b.x1;
    const height = b.y2 - b.y1;
    if (width <= 1e-6 || height <= 1e-6) continue;
    elements.push({
      id: newId(),
      type: "polygon",
      x: b.x1,
      y: b.y1,
      width,
      height,
      strokeColor: source.strokeColor,
      backgroundColor: source.backgroundColor,
      strokeWidth: source.strokeWidth,
      opacity: source.opacity,
      strokeOpacity: source.strokeOpacity,
      fillOpacity: source.fillOpacity,
      strokeStyle: source.strokeStyle,
      fillStyle: source.fillStyle,
      roughness: source.roughness,
      borderRadius: 0,
      rings: poly.map((ring) => openRing(ring, b.x1, b.y1)),
    });
  }
  return elements;
}

/** even-odd point test over a closed-loop set (polygon area, holes included) */
export function pointInLoops(p: Point, loops: Point[][]): boolean {
  let inside = false;
  for (const loop of loops) {
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const a = loop[i];
      const b = loop[j];
      if (
        a.y > p.y !== b.y > p.y &&
        p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
      ) {
        inside = !inside;
      }
    }
  }
  return inside;
}

interface EdgeHit {
  t: number;
}

/** parametric crossings of segment p0→p1 with one loop's edges */
function segmentEdgeCrossings(
  p0: Point,
  p1: Point,
  loop: Point[],
): EdgeHit[] {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const hits: EdgeHit[] = [];
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const ex = loop[i].x - loop[j].x;
    const ey = loop[i].y - loop[j].y;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const qx = loop[j].x - p0.x;
    const qy = loop[j].y - p0.y;
    const t = (qx * ey - qy * ex) / den;
    const u = (qx * dy - qy * dx) / den;
    if (t > 1e-9 && t < 1 - 1e-9 && u >= -1e-9 && u <= 1 + 1e-9) {
      hits.push({ t });
    }
  }
  return hits;
}

function pointAt(p0: Point, p1: Point, t: number): Point {
  return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
}

/**
 * Inside spans of a straight segment clipped by a loop set — the hachure
 * clip for boolean results (concave solids and holes yield several spans).
 *
 * Example: `clipSegmentInLoops(p0, p1, polygonLoops(el))`.
 */
export function clipSegmentInLoops(
  p0: Point,
  p1: Point,
  loops: Point[][],
): [Point, Point][] {
  const cuts = new Set<number>([0, 1]);
  for (const loop of loops) {
    for (const hit of segmentEdgeCrossings(p0, p1, loop)) {
      if (hit.t > 0 && hit.t < 1) cuts.add(hit.t);
    }
  }
  const ts = [...cuts].sort((a, b) => a - b);
  const spans: [Point, Point][] = [];
  for (let i = 0; i < ts.length - 1; i++) {
    const t0 = ts[i];
    const t1 = ts[i + 1];
    if (t1 - t0 < 1e-6) continue;
    const mid = pointAt(p0, p1, (t0 + t1) / 2);
    if (!pointInLoops(mid, loops)) continue;
    spans.push([pointAt(p0, p1, t0), pointAt(p0, p1, t1)]);
  }
  return spans;
}
