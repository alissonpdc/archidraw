/**
 * Parser de arquivos `.excalidraw` (Excalidraw scene files).
 *
 * Converte elementos Excalidraw para o formato ArchiDraw.
 * Suporta: rectangle, ellipse, diamond, line, arrow, text, draw/freedraw.
 */

import type { Document, Element, ArrowBinding } from "./types";

export class ExcalidrawSceneParseError extends Error {}

interface ExcalidrawSceneElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  strokeColor?: string;
  backgroundColor?: string;
  fillStyle?: string;
  strokeWidth?: number;
  strokeStyle?: string;
  roughness?: number;
  opacity?: number;
  roundness?: { type: number; value?: number } | null;
  strokeSharpness?: string;
  points?: unknown[];
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: string;
  verticalAlign?: string;
  containerId?: string | null;
  boundElements?: unknown[];
  startBinding?: {
    elementId: string;
    fixedPoint?: number[];
    focus?: number;
  } | null;
  endBinding?: {
    elementId: string;
    fixedPoint?: number[];
    focus?: number;
  } | null;
  startArrowhead?: string | null;
  endArrowhead?: string | null;
  isDeleted?: boolean;
  originalText?: string;
}

interface ExcalidrawSceneFile {
  type: string;
  version?: number;
  source?: string;
  elements?: ExcalidrawSceneElement[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
}

function normalizePoints(points: unknown): { x: number; y: number }[] {
  if (!Array.isArray(points)) return [];
  const out: { x: number; y: number }[] = [];
  for (const p of points) {
    if (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
      out.push({ x: p[0] as number, y: p[1] as number });
    } else if (
      p &&
      typeof p === "object" &&
      Number.isFinite((p as { x?: unknown }).x) &&
      Number.isFinite((p as { y?: unknown }).y)
    ) {
      out.push({ x: (p as { x: number }).x, y: (p as { y: number }).y });
    }
  }
  return out;
}

function mapStrokeStyle(
  s: string | undefined,
): "solid" | "dashed" | "dotted" | "dashdot" {
  if (s === "dashed") return "dashed";
  if (s === "dotted") return "dotted";
  return "solid";
}

function mapRoughness(r: number | undefined): 0 | 1 | 2 | 3 {
  if (r === undefined || r === null) return 0;
  if (r <= 0) return 0;
  if (r <= 1) return 1;
  if (r <= 2) return 2;
  return 3;
}

function mapBinding(
  binding: ExcalidrawSceneElement["startBinding"],
): ArrowBinding | undefined {
  if (!binding || !binding.elementId) return undefined;
  const fp = binding.fixedPoint;
  if (fp && Array.isArray(fp) && fp.length >= 2) {
    return { elementId: binding.elementId, nx: fp[0], ny: fp[1] };
  }
  // fallback: use focus or default center
  const focus = typeof binding.focus === "number" ? binding.focus : 0;
  return { elementId: binding.elementId, nx: 0.5 + focus * 0.5, ny: 0.5 };
}

function convertElement(
  el: ExcalidrawSceneElement,
  boundTextIds: Set<string>,
): Element | null {
  if (el.isDeleted) return null;
  // skip text elements that are bound to containers (they become labels)
  if (el.type === "text" && el.containerId && boundTextIds.has(el.id)) {
    return null;
  }

  const base = {
    id: el.id,
    x: el.x,
    y: el.y,
    width: el.width ?? 0,
    height: el.height ?? 0,
    strokeColor: el.strokeColor ?? "#1e1e1e",
    backgroundColor: el.backgroundColor ?? "transparent",
    strokeWidth: el.strokeWidth ?? 2,
    opacity: typeof el.opacity === "number" ? el.opacity / 100 : 1,
    strokeOpacity: 1,
    fillOpacity: 1,
    strokeStyle: mapStrokeStyle(el.strokeStyle),
    roughness: mapRoughness(el.roughness),
    borderRadius: el.roundness
      ? Math.round(((el.roundness.value ?? 0.25) * 100))
      : 0,
  };

  switch (el.type) {
    case "rectangle":
      return { ...base, type: "rectangle" as const };
    case "ellipse":
      return { ...base, type: "ellipse" as const };
    case "diamond":
      return { ...base, type: "diamond" as const };
    case "line":
    case "draw":
    case "freedraw": {
      const pts = normalizePoints(el.points);
      if (pts.length < 2) return null;
      // convert points to signed width/height like ArchiDraw
      const lastPt = pts[pts.length - 1];
      return {
        ...base,
        type: "line" as const,
        width: lastPt.x,
        height: lastPt.y,
        lineType: "straight" as const,
        startBinding: mapBinding(el.startBinding),
        endBinding: mapBinding(el.endBinding),
      };
    }
    case "arrow": {
      const pts = normalizePoints(el.points);
      if (pts.length < 2) return null;
      const lastPt = pts[pts.length - 1];
      return {
        ...base,
        type: "arrow" as const,
        width: lastPt.x,
        height: lastPt.y,
        lineType: "straight" as const,
        startBinding: mapBinding(el.startBinding),
        endBinding: mapBinding(el.endBinding),
      };
    }
    case "text": {
      const text = el.text ?? el.originalText ?? "";
      return {
        ...base,
        type: "text" as const,
        text,
        fontSize: el.fontSize ?? 20,
      };
    }
    default:
      return null;
  }
}

/**
 * Converts bound text elements into labels on their parent containers.
 * Returns a map of textId -> labelText for bound texts.
 */
function extractBoundTexts(
  elements: ExcalidrawSceneElement[],
): Map<string, string> {
  const map = new Map<string, string>();
  const byId = new Map<string, ExcalidrawSceneElement>();
  for (const el of elements) {
    byId.set(el.id, el);
  }
  for (const el of elements) {
    if (
      el.type === "text" &&
      el.containerId &&
      byId.has(el.containerId)
    ) {
      map.set(el.id, el.text ?? el.originalText ?? "");
    }
  }
  return map;
}

export function parseExcalidrawScene(jsonText: string): Document {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new ExcalidrawSceneParseError("Invalid JSON in .excalidraw file");
  }

  if (typeof data !== "object" || data === null) {
    throw new ExcalidrawSceneParseError("Invalid .excalidraw file structure");
  }

  const file = data as ExcalidrawSceneFile;

  // Accept both {type:"excalidraw"} and raw element arrays
  const rawElements = Array.isArray(file.elements)
    ? file.elements
    : Array.isArray(file)
      ? (file as unknown as ExcalidrawSceneElement[])
      : null;

  if (!rawElements) {
    throw new ExcalidrawSceneParseError("No elements found in .excalidraw file");
  }

  const boundTexts = extractBoundTexts(rawElements);
  const boundTextIds = new Set(boundTexts.keys());

  const elements: Element[] = [];
  for (const raw of rawElements) {
    const converted = convertElement(raw, boundTextIds);
    if (converted) {
      // If this is a container with a bound text, set its label
      if (
        (converted.type === "rectangle" ||
          converted.type === "diamond" ||
          converted.type === "ellipse") &&
        Array.isArray(raw.boundElements)
      ) {
        for (const b of raw.boundElements) {
          if (
            b &&
            typeof b === "object" &&
            (b as { type?: string }).type === "text"
          ) {
            const textId = (b as { id: string }).id;
            const text = boundTexts.get(textId);
            if (text) {
              (converted as { label?: string }).label = text;
            }
          }
        }
      }
      elements.push(converted);
    }
  }

  return { schemaVersion: 1, elements };
}
