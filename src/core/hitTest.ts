import type { Element } from "./types";
import {
  arrowPoints,
  diamondVertices,
  distanceToSegment,
  elementBounds,
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

export function hitTest(el: Element, p: { x: number; y: number }): boolean {
  const b = elementBounds(el);
  if (el.type === "arrow" || el.type === "line") {
    const [a, c] = arrowPoints(el);
    return (
      distanceToSegment(p, a, c) <=
      ARROW_HIT_TOLERANCE + el.strokeWidth / 2
    );
  }
  if (el.type === "diamond") {
    return pointInPolygon(p, diamondVertices(el));
  }
  if (el.type === "ellipse") {
    const cx = (b.x1 + b.x2) / 2;
    const cy = (b.y1 + b.y2) / 2;
    const rx = (b.x2 - b.x1) / 2;
    const ry = (b.y2 - b.y1) / 2;
    if (rx === 0 || ry === 0) return false;
    const nx = (p.x - cx) / rx;
    const ny = (p.y - cy) / ry;
    return nx * nx + ny * ny <= 1;
  }
  return p.x >= b.x1 && p.x <= b.x2 && p.y >= b.y1 && p.y <= b.y2;
}

export function elementsInBounds(
  elements: Element[],
  box: { x1: number; y1: number; x2: number; y2: number },
): string[] {
  return elements
    .filter((el) => boundsContain(box, elementBounds(el)))
    .map((el) => el.id);
}
