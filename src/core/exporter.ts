import { render, componentIconLayout } from "./renderer";
import type { Document, Element, Point } from "./types";
import { arrowHeadSize, arrowHeadVectors, arrowPoints, cornerRadius, curvedArrowControl, diamondVertices, edgePathPoints, escapeXml, unionBounds } from "./utils";
import { getLibraryItem } from "./library";
import { componentAssetDataUri, waitForComponentImages, waitForImage } from "./componentAssets";
import { strokeDashArray } from "./strokeStyle";
import { fontFamilyOf, lineHeight, textBlockHeight } from "./textStyle";
import {
  closedLoopD,
  diamondLoop,
  ellipseLoop,
  roundedRectLoop,
  seedOf,
  sketchPathD,
} from "./roughPath";

const EXPORT_PADDING = 20;
const PNG_SCALE = 2;
const HACHURE_SPACING = 6;

function truncatedHachureSvg(
  el: Document["elements"][number],
  clipId: string,
): string {
  const color =
    el.backgroundColor === "transparent"
      ? el.strokeColor
      : el.backgroundColor;
  let shape = "";
  if (el.type === "rectangle" || el.type === "component") {
    const r = cornerRadius(el);
    shape = `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${r}"/>`;
  } else if (el.type === "diamond") {
    const v = diamondVertices(el);
    shape = `<polygon points="${v.map((p) => `${p.x},${p.y}`).join(" ")}"/>`;
  } else if (el.type === "ellipse") {
    const rx = Math.abs(el.width) / 2;
    const ry = Math.abs(el.height) / 2;
    shape = `<ellipse cx="${el.x + el.width / 2}" cy="${el.y + el.height / 2}" rx="${rx}" ry="${ry}"/>`;
  }
  const w = Math.abs(el.width);
  const h = Math.abs(el.height);
  const bx = Math.min(el.x, el.x + el.width);
  const by = Math.min(el.y, el.y + el.height);
  const span = Math.max(w, h) * 1.5;
  const cx = bx + w / 2;
  const cy = by + h / 2;
  const withCross = el.fillStyle === "cross-hachure";
  let lines = "";
  for (let d = -span; d <= span; d += HACHURE_SPACING) {
    lines += `<line x1="${cx + d - span}" y1="${cy - span}" x2="${cx + d + span}" y2="${cy + span}"/>`;
    if (withCross) {
      lines += `<line x1="${cx + d - span}" y1="${cy + span}" x2="${cx + d + span}" y2="${cy - span}"/>`;
    }
  }
  const alpha = el.fillOpacity < 1 ? ` opacity="${el.fillOpacity}"` : "";
  return `<clipPath id="${clipId}">${shape}</clipPath><g clip-path="url(#${clipId})" stroke="${color}" stroke-width="1.2" stroke-linecap="round"${alpha}>${lines}</g>`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "diagram"
  );
}

// ---- PNG ---------------------------------------------------------------

export async function exportPNG(doc: Document, filename: string): Promise<boolean> {
  const bounds = unionBounds(doc.elements);
  if (!bounds) return false;

  // official icons load asynchronously — make sure they're decoded
  await waitForComponentImages(
    doc.elements
      .filter((el) => el.type === "component")
      .map((el) => (el as { componentId: string }).componentId),
  );
  // imagens autocontidas (src embebido) também precisam estar decodificadas
  const embeddedSrcs: string[] = [];
  for (const el of doc.elements) {
    if (el.type === "component" && typeof el.src === "string" && el.src !== "") {
      embeddedSrcs.push(el.src);
    }
  }
  if (embeddedSrcs.length > 0) {
    await Promise.all(embeddedSrcs.map(waitForImage));
  }

  const w = bounds.x2 - bounds.x1 + EXPORT_PADDING * 2;
  const h = bounds.y2 - bounds.y1 + EXPORT_PADDING * 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * PNG_SCALE);
  canvas.height = Math.ceil(h * PNG_SCALE);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(PNG_SCALE, PNG_SCALE);

  render(
    ctx,
    {
      doc,
      camera: {
        scrollX: -bounds.x1 + EXPORT_PADDING,
        scrollY: -bounds.y1 + EXPORT_PADDING,
        zoom: 1,
      },
      selectedIds: new Set(),
      draft: null,
      marquee: null,
    },
    w,
    h,
  );

  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `${filename}.png`);
  }, "image/png");
  return true;
}

// ---- SVG ---------------------------------------------------------------

function arrowHeadPoints(tip: { x: number; y: number }, tail: { x: number; y: number }, size: number): string {
  const [p1, p2] = arrowHeadVectors(tip, tail, size);
  return `M ${tip.x} ${tip.y} L ${p1.x} ${p1.y} M ${tip.x} ${tip.y} L ${p2.x} ${p2.y}`;
}

/** outline SVG tag for a closed shape (rect/diamond/ellipse/component) */
function shapeTag(el: Document["elements"][number], attrs: string): string {
  if (el.type === "rectangle" || el.type === "component") {
    return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${cornerRadius(el)}" ${attrs}/>`;
  }
  if (el.type === "diamond") {
    const v = diamondVertices(el);
    return `<polygon points="${v.map((p) => `${p.x},${p.y}`).join(" ")}" ${attrs}/>`;
  }
  return `<ellipse cx="${el.x + el.width / 2}" cy="${el.y + el.height / 2}" rx="${Math.abs(el.width) / 2}" ry="${Math.abs(el.height) / 2}" ${attrs}/>`;
}

// ---- sketch (hand-drawn) SVG ---------------------------------------------
// Shapes/lines with roughness > 0 export through the same deterministic
// rough-path geometry the canvas uses (roughPath), so the saved/downloaded
// SVG keeps the sketch look instead of falling back to clean lines.

function isSketch(el: Element): boolean {
  return el.roughness !== undefined && el.roughness > 0;
}

/** closed perimeter polyline for a shape, matching the canvas sketch trace */
function shapeLoop(el: Element): Point[] {
  if (el.type === "rectangle" || el.type === "component") {
    return roundedRectLoop(el.x, el.y, el.width, el.height, cornerRadius(el));
  }
  if (el.type === "diamond") return diamondLoop(el);
  return ellipseLoop(el.x, el.y, el.width, el.height);
}

/** waveScale used by the canvas for the same shape (rounded corners skip the
 *  heavy wave so arcs stay arcs) */
function shapeWaveScale(el: Element): number {
  return (el.type === "rectangle" || el.type === "component") &&
    cornerRadius(el) > 0
    ? 0.3
    : 1;
}

/** exact closed-loop fill for a sketch shape (clean under the rough outline) */
function sketchShapeFill(el: Element, fill: string, opacity: string): string {
  return `<path d="${closedLoopD(shapeLoop(el), true)}" fill="${fill}"${opacity}/>`;
}

/** multi-pass hand-drawn outline for a sketch shape */
function sketchShapeStroke(el: Element, stroke: string, dash: string, opacity = ""): string {
  return `<path d="${sketchPathD([shapeLoop(el)], el.roughness ?? 0, seedOf(el.id), shapeWaveScale(el))}" fill="none" ${stroke}${dash}${opacity}/>`;
}

/** arrowhead wings as sketch strokes (clamped at the tip, like the canvas) */
function arrowHeadSvg(
  el: Element,
  tip: Point,
  tail: Point,
  stroke: string,
  opacity: string,
  headSeed: number,
): string {
  const size = arrowHeadSize(el) * 1.2;
  if (isSketch(el)) {
    const [p1, p2] = arrowHeadVectors(tip, tail, size);
    const d = sketchPathD(
      [
        [tip, p1],
        [tip, p2],
      ],
      el.roughness ?? 0,
      headSeed,
      1,
      true,
    );
    return `<path d="${d}" fill="none" ${stroke}${opacity}/>`;
  }
  return `<path d="${arrowHeadPoints(tip, tail, size)}" fill="none" ${stroke}${opacity}/>`;
}

/**
 * SVG markup for a document (scene coordinates, auto-computed viewBox with
 * padding). Pure string builder — framework-free, shared by the SVG export
 * and the "Add to Library" feature.
 */
export function buildSvgString(doc: Document): string | null {
  const bounds = unionBounds(doc.elements);
  if (!bounds) return null;

  const w = bounds.x2 - bounds.x1 + EXPORT_PADDING * 2;
  const h = bounds.y2 - bounds.y1 + EXPORT_PADDING * 2;

  const parts: string[] = [];
  for (const el of doc.elements) {
    const stroke =
      el.strokeWidth > 0
        ? `stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`
        : "none";
    const dash =
      el.strokeWidth === 0
        ? ""
        : (() => {
            const d = strokeDashArray(el.strokeStyle, el.strokeWidth);
            return d.length > 0 ? ` stroke-dasharray="${d.join(" ")}"` : "";
          })();
    const opacity = el.opacity < 1 ? ` opacity="${el.opacity}"` : "";
    const isShape =
      el.type === "rectangle" ||
      el.type === "diamond" ||
      el.type === "ellipse" ||
      el.type === "component";
    const isHatch =
      isShape && (el.fillStyle === "hachure" || el.fillStyle === "cross-hachure");
    const fill = el.backgroundColor === "transparent" ? "none" : el.backgroundColor;
    if (isShape) {
      if (isHatch) {
        const clipId = `hatch-${el.id}`;
        const outline = isSketch(el)
          ? sketchShapeStroke(el, stroke, dash)
          : shapeTag(el, `fill="none" ${stroke}${dash}`);
        parts.push(
          `<g${opacity}>${truncatedHachureSvg(el, clipId)}${outline}</g>`
        );
      } else if (isSketch(el)) {
        if (fill !== "none" && el.fillStyle !== "hachure" && el.fillStyle !== "cross-hachure") {
          parts.push(sketchShapeFill(el, fill, opacity));
        }
        if (el.strokeWidth > 0) {
          parts.push(sketchShapeStroke(el, stroke, dash, opacity));
        }
      } else {
        parts.push(shapeTag(el, `fill="${fill}" ${stroke}${dash}${opacity}`));
      }
      if (el.type === "component") {
        const layout = componentIconLayout(el);
        const dataUri = el.src ?? componentAssetDataUri(el.componentId);
        if (dataUri) {
          parts.push(
            `<image x="${layout.iconX}" y="${layout.iconY}" width="${layout.iconWidth}" height="${layout.iconHeight}" href="${escapeXml(dataUri)}"${opacity}/>`
          );
        } else {
          // fallback: hand-drawn glyph paths (24x24 viewBox)
          const item = getLibraryItem(el.componentId);
          if (item && item.icon && item.icon.length > 0) {
            const scale = layout.iconWidth / 24;
            parts.push(
              `<g transform="translate(${layout.iconX} ${layout.iconY}) scale(${scale})" fill="none" stroke="${el.strokeColor}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"${opacity}>${item.icon
                .map((d) => `<path d="${d}"/>`)
                .join("")}</g>`
            );
          }
        }
      }
    } else if (el.type === "line") {
      const [a, b] = arrowPoints(el);
      const lineType = el.lineType ?? "straight";
      const endY = b.y === a.y ? b.y + 1 : b.y;
      const tip = { x: b.x, y: endY };
      if (lineType === "curved") {
        const cp = curvedArrowControl(el, a, tip);
        parts.push(`<path d="M ${a.x} ${a.y} Q ${cp.x} ${cp.y} ${tip.x} ${tip.y}" fill="none" ${stroke}${dash}${opacity}/>`);
      } else if (isSketch(el)) {
        const pts = lineType === "auto" ? edgePathPoints(el) : [a, tip];
        parts.push(`<path d="${sketchPathD([pts], el.roughness ?? 0, seedOf(el.id))}" fill="none" ${stroke}${dash}${opacity}/>`);
      } else if (lineType === "auto") {
        const pts = edgePathPoints(el);
        const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
        parts.push(`<path d="${d}" fill="none" ${stroke}${dash}${opacity}/>`);
      } else {
        parts.push(`<line x1="${a.x}" y1="${a.y}" x2="${tip.x}" y2="${tip.y}" fill="none" ${stroke}${dash}${opacity}/>`);
      }
    } else if (el.type === "arrow") {
      const [a, b] = arrowPoints(el);
      const endY = b.y === a.y ? b.y + 1 : b.y;
      const tip = { x: b.x, y: endY };
      const lineType = el.lineType ?? "straight";
      const headSeed = seedOf(el.id) + 7;
      if (lineType === "curved") {
        const cp = curvedArrowControl(el, a, tip);
        parts.push(`<path d="M ${a.x} ${a.y} Q ${cp.x} ${cp.y} ${tip.x} ${tip.y}" fill="none" ${stroke}${dash}${opacity}/>`);
        parts.push(arrowHeadSvg(el, tip, cp, stroke, opacity, headSeed));
      } else if (isSketch(el)) {
        const pts = lineType === "auto" ? edgePathPoints(el) : [a, tip];
        const headTail = lineType === "auto" && pts.length >= 2 ? pts[pts.length - 2] : a;
        parts.push(`<path d="${sketchPathD([pts], el.roughness ?? 0, seedOf(el.id), 1, false, true)}" fill="none" ${stroke}${dash}${opacity}/>`);
        parts.push(arrowHeadSvg(el, tip, headTail, stroke, opacity, headSeed));
      } else if (lineType === "auto") {
        const pts = edgePathPoints(el);
        const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
        parts.push(`<path d="${d}" fill="none" ${stroke}${dash}${opacity}/>`);
        const prevPt = pts.length >= 2 ? pts[pts.length - 2] : a;
        parts.push(arrowHeadSvg(el, tip, prevPt, stroke, opacity, headSeed));
      } else {
        parts.push(`<line x1="${a.x}" y1="${a.y}" x2="${tip.x}" y2="${tip.y}" fill="none" ${stroke}${dash}${opacity}/>`);
        parts.push(arrowHeadSvg(el, tip, a, stroke, opacity, headSeed));
      }
    } else if (el.type === "text") {
      const lines = el.text.split("\n");
      const lh = lineHeight(el);
      const blockH = textBlockHeight(el.fontSize, lines.length, lh);
      const vOffset = Math.max(0, (el.height - blockH) / 2);
      lines.forEach((line, i) => {
        parts.push(
          `<text x="${el.x}" y="${el.y + vOffset + i * el.fontSize * lh + el.fontSize * 0.85}" font-family="${escapeXml(fontFamilyOf(el))}" font-size="${el.fontSize}" fill="${el.strokeColor}"${opacity}>${escapeXml(line)}</text>`
        );
      });
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${bounds.x1 - EXPORT_PADDING} ${bounds.y1 - EXPORT_PADDING} ${w} ${h}">
${parts.map((p) => `  ${p}`).join("\n")}
</svg>`;

  return svg;
}

export function exportSVG(doc: Document, filename: string): boolean {
  const svg = buildSvgString(doc);
  if (!svg) return false;

  downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${filename}.svg`);
  return true;
}
