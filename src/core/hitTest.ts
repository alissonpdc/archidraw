import type { Element } from "./types";
import {
  arrowPoints,
  curvedArrowControl,
  diamondVertices,
  distanceToPolyline,
  distanceToSegment,
  edgePathPoints,
  elementBounds,
  elementAngle,
  polygonLoops,
  rotatedBounds,
  toLocalPoint,
  boundsContain,
} from "./utils";

const ARROW_HIT_TOLERANCE = 10;

function pointInPolygon(p: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** bounding box of a quadratic Bézier curve a→tip via cp */
function quadraticBounds(a: { x: number; y: number }, cp: { x: number; y: number }, tip: { x: number; y: number }) {
  const xs = [a.x, cp.x, tip.x];
  const ys = [a.y, cp.y, tip.y];
  return {
    x1: Math.min(...xs), y1: Math.min(...ys),
    x2: Math.max(...xs), y2: Math.max(...ys),
  };
}

export function hitTest(el: Element, p: { x: number; y: number }): boolean {
  if (el.type === "arrow" || el.type === "line") {
    const pad = ARROW_HIT_TOLERANCE + el.strokeWidth / 2;
    const lineType = el.lineType ?? "straight";
    if (lineType === "straight") {
      const b = elementBounds(el);
      if (p.x < b.x1 - pad || p.x > b.x2 + pad || p.y < b.y1 - pad || p.y > b.y2 + pad) {
        return false;
      }
      const [a, c] = arrowPoints(el);
      return distanceToSegment(p, a, c) <= pad;
    }
    // curved: check distance to the actual Bézier curve
    if (lineType === "curved") {
      const [a, bb] = arrowPoints(el);
      const tip = { x: bb.x, y: bb.y === a.y ? bb.y + 1 : bb.y };
      const cp = curvedArrowControl(el, a, tip);
      // use the bounding box of the curve for a generous hit area
      const cb = quadraticBounds(a, cp, tip);
      return (
        p.x >= cb.x1 - pad && p.x <= cb.x2 + pad &&
        p.y >= cb.y1 - pad && p.y <= cb.y2 + pad
      );
    }
    // auto: check distance to the polyline
    const pts = edgePathPoints(el);
    return distanceToPolyline(p, pts) <= pad;
  }
  const rb = rotatedBounds(el);
  if (p.x < rb.x1 || p.x > rb.x2 || p.y < rb.y1 || p.y > rb.y2) return false;
  // rotated shapes are tested in their own unrotated frame
  const lp = elementAngle(el) === 0 ? p : toLocalPoint(el, p);
  const b = elementBounds(el);
  if (el.type === "diamond") {
    return pointInPolygon(lp, diamondVertices(el));
  }
  if (el.type === "ellipse") {
    const cx = (b.x1 + b.x2) / 2;
    const cy = (b.y1 + b.y2) / 2;
    const rx = (b.x2 - b.x1) / 2;
    const ry = (b.y2 - b.y1) / 2;
    if (rx === 0 || ry === 0) return false;
    const nx = (lp.x - cx) / rx;
    const ny = (lp.y - cy) / ry;
    return nx * nx + ny * ny <= 1;
  }
  if (el.type === "polygon") {
    // even-odd parity across the rings: holes punch the solid out again
    const loops = polygonLoops(el);
    const crossings = loops.filter((loop) => pointInPolygon(lp, loop)).length;
    return crossings % 2 === 1;
  }
  return lp.x >= b.x1 && lp.x <= b.x2 && lp.y >= b.y1 && lp.y <= b.y2;
}

export function elementsInBounds(
  elements: Element[],
  box: { x1: number; y1: number; x2: number; y2: number },
): string[] {
  return elements
    .filter((el) => boundsContain(box, rotatedBounds(el)))
    .map((el) => el.id);
}
