/**
 * Exporta a biblioteca Custom (itens salvos pelo usuário) no formato
 * `.archidrawlib`, compatível com o parser de `.excalidrawlib`.
 *
 * Cada item vira um libraryItem com seus elementos nativos serializados
 * em formato Excalidraw-compatível (mesma estrutura do v2).
 */

import type { Element } from "./types";
import { getCustomLibrary } from "./customLibrary";
import { downloadBlob } from "./exporter";

interface ExcalidrawLibItem {
  name: string;
  elements: ExcalidrawElement[];
}

interface ExcalidrawLibFile {
  type: "archidrawlib";
  version: 2;
  libraryItems: ExcalidrawLibItem[];
}

interface ExcalidrawElement {
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  strokeStyle: string;
  opacity: number;
  roundness: null;
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  points?: { x: number; y: number }[];
  startArrowhead?: string | null;
  endArrowhead?: string | null;
  closed?: boolean;
}

/** converte opacity de ArchiDraw (0–1) para Excalidraw (0–100) */
function toExcalidrawOpacity(opacity: number): number {
  return Math.round(Math.min(1, Math.max(0, opacity)) * 100);
}

function toExcalidrawStrokeStyle(
  style: string | undefined,
): "solid" | "dashed" | "dotted" {
  if (style === "dashed") return "dashed";
  if (style === "dotted") return "dotted";
  return "solid";
}

function toExcalidrawFillStyle(
  style: string | undefined,
): "hachure" | "solid" | "cross-hatch" {
  if (style === "hachure") return "hachure";
  if (style === "cross-hachure") return "cross-hatch";
  return "solid";
}

/** converte um elemento ArchiDraw nativo para formato Excalidraw */
function elementToExcalidraw(el: Element): ExcalidrawElement | null {
  if (el.type === "component") return null;

  const base: ExcalidrawElement = {
    type: el.type,
    x: el.x,
    y: el.y,
    width: el.width,
    height: el.height,
    strokeColor: el.strokeColor,
    backgroundColor: el.backgroundColor,
    fillStyle: toExcalidrawFillStyle(el.fillStyle),
    strokeWidth: el.strokeWidth,
    strokeStyle: toExcalidrawStrokeStyle(el.strokeStyle),
    opacity: toExcalidrawOpacity(el.opacity),
    roundness: null,
  };

  if (el.type === "text") {
    base.text = el.text;
    base.fontSize = el.fontSize;
  }

  if (el.type === "line" || el.type === "arrow") {
    const pts: { x: number; y: number }[] = [{ x: 0, y: 0 }];
    if (el.bendPoints && el.bendPoints.length > 0) {
      for (const bp of el.bendPoints) {
        pts.push({ x: bp.x - el.x, y: bp.y - el.y });
      }
    }
    pts.push({ x: el.width, y: el.height });
    base.points = pts;
    if (el.type === "arrow") {
      base.startArrowhead = "arrow";
      base.endArrowhead = "arrow";
    }
  }

  return base;
}

/** serializa os itens custom como JSON `.archidrawlib` v2 */
export function exportCustomLibraryAsJson(): string | null {
  const items = getCustomLibrary();
  if (items.length === 0) return null;

  const libraryItems: ExcalidrawLibItem[] = items
    .map((it) => {
      const elements = it.elements
        .map(elementToExcalidraw)
        .filter((e): e is ExcalidrawElement => e !== null);
      return { name: it.name, elements };
    })
    .filter((it) => it.elements.length > 0);

  if (libraryItems.length === 0) return null;

  const file: ExcalidrawLibFile = {
    type: "archidrawlib",
    version: 2,
    libraryItems,
  };
  return JSON.stringify(file, null, 2);
}

/** exporta a biblioteca Custom como download de arquivo .archidrawlib */
export function downloadCustomLibrary(): boolean {
  const json = exportCustomLibraryAsJson();
  if (!json) return false;
  downloadBlob(
    new Blob([json], { type: "application/json" }),
    "custom-library.archidrawlib",
  );
  return true;
}
