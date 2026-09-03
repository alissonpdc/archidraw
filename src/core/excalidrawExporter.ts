import type { Document, Element, ArrowBinding, BaseElement } from "./types";
import { arrowPoints } from "./utils";
import { toExcalidrawStrokeStyle } from "./excalidrawCommon";

interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: "solid" | "hachure" | "cross-hatch";
  strokeWidth: number;
  strokeStyle: "solid" | "dashed" | "dotted";
  roughness: number;
  opacity: number;
  roundness: { type: number } | null;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  boundElements: { id: string; type: string }[] | null;
  updated: number;
  groupIds: string[];
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: string;
  verticalAlign?: string;
  containerId?: string | null;
  originalText?: string;
  autoResize?: boolean;
  points?: number[][];
  startArrowhead?: string | null;
  endArrowhead?: string | null;
  startBinding?: { elementId: string; fixedPoint: number[] } | null;
  endBinding?: { elementId: string; fixedPoint: number[] } | null;
  lastCommittedPoint?: number[] | null;
  label?: { text: string } | null;
}

interface ExcalidrawFile {
  type: "excalidraw";
  version: 2;
  source: string;
  elements: ExcalidrawElement[];
  appState: {
    gridSize: number;
    viewBackgroundColor: string;
  };
  files: Record<string, never>;
}

let seedCounter = 1;
function nextSeed(): number {
  return seedCounter++;
}

function mapFillStyle(
  bg: string,
): "solid" | "hachure" | "cross-hatch" {
  if (bg && bg !== "transparent") return "solid";
  return "solid";
}

function borderRadiusToRoundness(
  el: Element,
): { type: number } | null {
  if (el.type !== "rectangle" && el.type !== "component") return null;
  if (el.borderRadius <= 0) return null;
  return { type: 3 };
}

function bindingToExcalidraw(
  binding: ArrowBinding | undefined,
): { elementId: string; fixedPoint: number[] } | null {
  if (!binding) return null;
  return {
    elementId: binding.elementId,
    fixedPoint: [binding.nx, binding.ny],
  };
}

function addBoundElement(
  el: ExcalidrawElement,
  boundId: string,
  boundType: string,
) {
  if (!el.boundElements) el.boundElements = [];
  el.boundElements.push({ id: boundId, type: boundType });
}

/** builds the bound text element for a labelled element (bound to container) */
function boundTextElement(
  container: BaseElement & { label?: string },
  textId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fontSizeDefault: number,
): ExcalidrawElement {
  return {
    id: textId,
    type: "text",
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: container.textColor || container.strokeColor,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 0,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    roundness: null,
    seed: nextSeed(),
    version: 1,
    versionNonce: nextSeed(),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    groupIds: container.groupId ? [container.groupId] : [],
    text: container.label,
    fontSize: container.fontSize || fontSizeDefault,
    fontFamily: 2,
    textAlign: "center",
    verticalAlign: "middle",
    containerId: container.id,
    originalText: container.label,
    autoResize: true,
  };
}

function elementToExcalidraw(
  el: Element,
): ExcalidrawElement | ExcalidrawElement[] {
  const base = {
    id: el.id,
    x: el.x,
    y: el.y,
    width: Math.abs(el.width),
    height: Math.abs(el.height),
    angle: 0,
    strokeColor: el.strokeColor,
    backgroundColor:
      el.backgroundColor === "transparent"
        ? "transparent"
        : el.backgroundColor,
    fillStyle: mapFillStyle(el.backgroundColor),
    strokeWidth: el.strokeWidth,
    strokeStyle: toExcalidrawStrokeStyle(el.strokeStyle),
    roughness: el.roughness,
    opacity: Math.round(el.opacity * 100),
    roundness: borderRadiusToRoundness(el),
    seed: nextSeed(),
    version: 1,
    versionNonce: nextSeed(),
    isDeleted: false,
    boundElements: null as { id: string; type: string }[] | null,
    updated: Date.now(),
    groupIds: el.groupId ? [el.groupId] : [],
  };

  switch (el.type) {
    case "rectangle": {
      const excalEl: ExcalidrawElement = {
        ...base,
        type: "rectangle",
      };
      if (el.label) {
        const textId = `${el.id}_label`;
        const textEl = boundTextElement(
          el,
          textId,
          el.x + 5,
          el.y + 5,
          Math.max(el.width - 10, 10),
          Math.max(el.height - 10, 10),
          20,
        );
        addBoundElement(excalEl, textId, "text");
        return [excalEl, textEl];
      }
      return excalEl;
    }
    case "diamond": {
      const excalEl: ExcalidrawElement = {
        ...base,
        type: "diamond",
      };
      if (el.label) {
        const textId = `${el.id}_label`;
        const textEl = boundTextElement(
          el,
          textId,
          el.x + 5,
          el.y + 5,
          Math.max(el.width - 10, 10),
          Math.max(el.height - 10, 10),
          20,
        );
        addBoundElement(excalEl, textId, "text");
        return [excalEl, textEl];
      }
      return excalEl;
    }
    case "ellipse": {
      const excalEl: ExcalidrawElement = {
        ...base,
        type: "ellipse",
      };
      if (el.label) {
        const textId = `${el.id}_label`;
        const textEl = boundTextElement(
          el,
          textId,
          el.x + 5,
          el.y + 5,
          Math.max(el.width - 10, 10),
          Math.max(el.height - 10, 10),
          20,
        );
        addBoundElement(excalEl, textId, "text");
        return [excalEl, textEl];
      }
      return excalEl;
    }
    case "component": {
      const excalEl: ExcalidrawElement = {
        ...base,
        type: "rectangle",
      };
      if (el.label) {
        const textId = `${el.id}_label`;
        const textEl = boundTextElement(
          el,
          textId,
          el.x + 5,
          el.y + 5,
          Math.max(el.width - 10, 10),
          Math.max(el.height - 10, 10),
          20,
        );
        addBoundElement(excalEl, textId, "text");
        return [excalEl, textEl];
      }
      return excalEl;
    }
    case "line": {
      const [a, b] = arrowPoints(el);
      const excalEl: ExcalidrawElement = {
        ...base,
        type: "line",
        points: [
          [0, 0],
          [b.x - a.x, b.y - a.y],
        ],
        lastCommittedPoint: null,
        startBinding: bindingToExcalidraw(el.startBinding),
        endBinding: bindingToExcalidraw(el.endBinding),
        startArrowhead: null,
        endArrowhead: null,
      };
      if (el.label) {
        const textId = `${el.id}_label`;
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        const textEl = boundTextElement(
          el,
          textId,
          midX - 20,
          midY - 10,
          40,
          20,
          16,
        );
        addBoundElement(excalEl, textId, "text");
        return [excalEl, textEl];
      }
      return excalEl;
    }
    case "arrow": {
      const [a, b] = arrowPoints(el);
      const excalEl: ExcalidrawElement = {
        ...base,
        type: "arrow",
        points: [
          [0, 0],
          [b.x - a.x, b.y - a.y],
        ],
        lastCommittedPoint: null,
        startBinding: bindingToExcalidraw(el.startBinding),
        endBinding: bindingToExcalidraw(el.endBinding),
        startArrowhead: null,
        endArrowhead: "arrow",
      };
      if (el.label) {
        const textId = `${el.id}_label`;
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2;
        const textEl = boundTextElement(
          el,
          textId,
          midX - 20,
          midY - 10,
          40,
          20,
          16,
        );
        addBoundElement(excalEl, textId, "text");
        return [excalEl, textEl];
      }
      return excalEl;
    }
    case "text": {
      return {
        ...base,
        type: "text",
        text: el.text,
        fontSize: el.fontSize,
        fontFamily: 2,
        textAlign: el.textAlign || "left",
        verticalAlign: "top",
        containerId: null,
        originalText: el.text,
        autoResize: true,
      };
    }
    default:
      return { ...base, type: "rectangle" };
  }
}

export function exportExcalidraw(doc: Document): string {
  const elements: ExcalidrawElement[] = [];
  for (const el of doc.elements) {
    const result = elementToExcalidraw(el);
    if (Array.isArray(result)) {
      elements.push(...result);
    } else {
      elements.push(result);
    }
  }

  const file: ExcalidrawFile = {
    type: "excalidraw",
    version: 2,
    source: "https://archidraw.app",
    elements,
    appState: {
      gridSize: 20,
      viewBackgroundColor: "",
    },
    files: {},
  };

  return JSON.stringify(file);
}
