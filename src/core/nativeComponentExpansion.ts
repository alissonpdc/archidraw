import type { ArrowBinding, ArrowElement, ContextElement, Element, LineElement, Point } from "./types";
import { bindingPoint, isEdge, newId, unionBounds } from "./utils";
import { getLibraryItem } from "./library";

interface ComponentExpansionContext {
  clonedElements: Element[];
  clonedGraphics: Element[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

function resolveComponentAnchor(
  ctx: ComponentExpansionContext,
  binding: ArrowBinding,
): { newBinding: ArrowBinding; point: Point } {
  const { bounds, clonedGraphics } = ctx;
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const side = binding.side;
  const nx = binding.nx ?? 0.5;
  const ny = binding.ny ?? 0.5;

  const closedShapes = clonedGraphics.filter(
    (e) =>
      (e.type === "rectangle" ||
        e.type === "polygon" ||
        e.type === "ellipse" ||
        e.type === "diamond") &&
      e.width > 2 &&
      e.height > 2,
  );
  const candidates = closedShapes.length > 0 ? closedShapes : clonedGraphics;

  const effSide =
    side ??
    (ny <= 0.25 ? "top" : ny >= 0.75 ? "bottom" : nx <= 0.25 ? "left" : "right");

  let targetX: number;
  let targetY: number;

  if (effSide === "top") {
    targetX = bounds.minX + nx * w;
    targetY = bounds.minY;
  } else if (effSide === "bottom") {
    targetX = bounds.minX + nx * w;
    targetY = bounds.maxY;
  } else if (effSide === "left") {
    targetX = bounds.minX;
    targetY = bounds.minY + ny * h;
  } else {
    targetX = bounds.maxX;
    targetY = bounds.minY + ny * h;
  }

  let best = candidates[0];
  let bestScore = Infinity;

  for (const el of candidates) {
    let score: number;
    if (effSide === "top") {
      const topEdgeDist = Math.abs(el.y - bounds.minY);
      const spanDist = Math.max(0, el.x - targetX, targetX - (el.x + el.width));
      score = topEdgeDist * 2 + spanDist;
    } else if (effSide === "bottom") {
      const bottomEdgeDist = Math.abs(el.y + el.height - bounds.maxY);
      const spanDist = Math.max(0, el.x - targetX, targetX - (el.x + el.width));
      score = bottomEdgeDist * 2 + spanDist;
    } else if (effSide === "left") {
      const leftEdgeDist = Math.abs(el.x - bounds.minX);
      const spanDist = Math.max(0, el.y - targetY, targetY - (el.y + el.height));
      score = leftEdgeDist * 2 + spanDist;
    } else {
      const rightEdgeDist = Math.abs(el.x + el.width - bounds.maxX);
      const spanDist = Math.max(0, el.y - targetY, targetY - (el.y + el.height));
      score = rightEdgeDist * 2 + spanDist;
    }

    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  let anchorX: number;
  let anchorY: number;
  let tNx: number;
  let tNy: number;

  if (effSide === "top") {
    anchorX =
      best.width > 0
        ? Math.max(best.x, Math.min(targetX, best.x + best.width))
        : best.x;
    anchorY = best.y;
    tNx = best.width > 0 ? (anchorX - best.x) / best.width : 0.5;
    tNy = 0;
  } else if (effSide === "bottom") {
    anchorX =
      best.width > 0
        ? Math.max(best.x, Math.min(targetX, best.x + best.width))
        : best.x;
    anchorY = best.y + best.height;
    tNx = best.width > 0 ? (anchorX - best.x) / best.width : 0.5;
    tNy = 1;
  } else if (effSide === "left") {
    anchorX = best.x;
    anchorY =
      best.height > 0
        ? Math.max(best.y, Math.min(targetY, best.y + best.height))
        : best.y;
    tNx = 0;
    tNy = best.height > 0 ? (anchorY - best.y) / best.height : 0.5;
  } else {
    anchorX = best.x + best.width;
    anchorY =
      best.height > 0
        ? Math.max(best.y, Math.min(targetY, best.y + best.height))
        : best.y;
    tNx = 1;
    tNy = best.height > 0 ? (anchorY - best.y) / best.height : 0.5;
  }

  return {
    newBinding: {
      elementId: best.id,
      nx: tNx,
      ny: tNy,
      side: effSide,
    },
    point: { x: anchorX, y: anchorY },
  };
}

export function expandNativeComponents(elements: Element[]): Element[] {
  let hasNative = false;
  for (const el of elements) {
    if (
      el.type === "component" &&
      el.componentId &&
      (getLibraryItem(el.componentId)?.elements?.length ?? 0) > 0
    ) {
      hasNative = true;
      break;
    }
  }
  if (!hasNative) return elements;

  const componentContexts = new Map<string, ComponentExpansionContext>();
  const idMapAll = new Map<string, string[]>();
  const result: Element[] = [];

  for (const el of elements) {
    if (el.type !== "component" || !el.componentId) {
      result.push(el);
      continue;
    }
    const item = getLibraryItem(el.componentId);
    const templateElements = item?.elements;

    if (!templateElements || templateElements.length === 0) {
      result.push(el);
      continue;
    }

    const b = unionBounds(templateElements)!;
    const dx = el.x - b.x1;
    const dy = el.y - b.y1;
    const gid = el.groupId || newId();

    const clonedElements: Element[] = [];
    const templateIdMap = new Map<string, string>();

    for (const tEl of templateElements) {
      const nid = newId();
      templateIdMap.set(tEl.id, nid);
      let cloned: Element = {
        ...tEl,
        id: nid,
        groupId: gid,
        x: tEl.x + dx,
        y: tEl.y + dy,
      };

      if (
        el.label &&
        cloned.type === "text" &&
        (tEl as { text?: string }).text === item!.name
      ) {
        cloned = { ...cloned, text: el.label };
      }

      clonedElements.push(cloned);
    }

    // Remap internal bindings within the cloned group (drop dangling bindings to external templates)
    for (let j = 0; j < clonedElements.length; j++) {
      const c = clonedElements[j];
      if (isEdge(c)) {
        const startBinding =
          c.startBinding && templateIdMap.has(c.startBinding.elementId)
            ? { ...c.startBinding, elementId: templateIdMap.get(c.startBinding.elementId)! }
            : undefined;
        const endBinding =
          c.endBinding && templateIdMap.has(c.endBinding.elementId)
            ? { ...c.endBinding, elementId: templateIdMap.get(c.endBinding.elementId)! }
            : undefined;
        clonedElements[j] = { ...c, startBinding, endBinding };
      }
      result.push(clonedElements[j]);
    }

    const nonText = clonedElements.filter((e) => e.type !== "text");
    const clonedGraphics = nonText.length > 0 ? nonText : clonedElements;
    const minX = Math.min(...clonedGraphics.map((e) => e.x));
    const minY = Math.min(...clonedGraphics.map((e) => e.y));
    const maxX = Math.max(...clonedGraphics.map((e) => e.x + e.width));
    const maxY = Math.max(...clonedGraphics.map((e) => e.y + e.height));

    componentContexts.set(el.id, {
      clonedElements,
      clonedGraphics,
      bounds: { minX, minY, maxX, maxY },
    });
    idMapAll.set(el.id, clonedElements.map((c) => c.id));
  }

  if (componentContexts.size > 0) {
    const elMap = new Map<string, Element>();
    for (const el of result) {
      elMap.set(el.id, el);
    }

    for (let i = 0; i < result.length; i++) {
      const el = result[i];
      if (el.type === "context") {
        const childIds: string[] = [];
        for (const cid of (el as ContextElement).childIds ?? []) {
          if (idMapAll.has(cid)) {
            childIds.push(...idMapAll.get(cid)!);
          } else {
            childIds.push(cid);
          }
        }
        result[i] = { ...el, childIds };
      } else if (isEdge(el)) {
        let startBinding = el.startBinding;
        let endBinding = el.endBinding;
        let startPt: Point | undefined;
        let endPt: Point | undefined;
        let remapped = false;

        if (startBinding) {
          if (componentContexts.has(startBinding.elementId)) {
            const anchor = resolveComponentAnchor(
              componentContexts.get(startBinding.elementId)!,
              startBinding,
            );
            startBinding = anchor.newBinding;
            startPt = anchor.point;
            remapped = true;
          } else {
            const target = elMap.get(startBinding.elementId);
            if (target) {
              startPt = bindingPoint(target, startBinding);
            }
          }
        }

        if (endBinding) {
          if (componentContexts.has(endBinding.elementId)) {
            const anchor = resolveComponentAnchor(
              componentContexts.get(endBinding.elementId)!,
              endBinding,
            );
            endBinding = anchor.newBinding;
            endPt = anchor.point;
            remapped = true;
          } else {
            const target = elMap.get(endBinding.elementId);
            if (target) {
              endPt = bindingPoint(target, endBinding);
            }
          }
        }

        if (remapped) {
          let edge: LineElement | ArrowElement = {
            ...el,
            startBinding,
            endBinding,
          };

          if (startPt && endPt) {
            edge = {
              ...edge,
              x: startPt.x,
              y: startPt.y,
              width: endPt.x - startPt.x,
              height: endPt.y - startPt.y,
            };
          } else if (startPt) {
            const curEndX = edge.x + edge.width;
            const curEndY = edge.y + edge.height;
            edge = {
              ...edge,
              x: startPt.x,
              y: startPt.y,
              width: curEndX - startPt.x,
              height: curEndY - startPt.y,
            };
          } else if (endPt) {
            edge = {
              ...edge,
              width: endPt.x - edge.x,
              height: endPt.y - edge.y,
            };
          }

          result[i] = edge;
        }
      }
    }
  }

  return result;
}
