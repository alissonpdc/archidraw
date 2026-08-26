import type { Element } from "./types";
import {
  arrowPoints,
  distanceToSegment,
  elementBounds,
  boundsContain,
} from "./utils";

const ARROW_HIT_TOLERANCE = 10;

export function hitTest(el: Element, p: { x: number; y: number }): boolean {
  const b = elementBounds(el);
  if (el.type === "arrow") {
    const [a, c] = arrowPoints(el);
    return (
      distanceToSegment(p, a, c) <=
      ARROW_HIT_TOLERANCE + el.strokeWidth / 2
    );
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
