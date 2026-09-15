import { render, componentIconLayout } from "./renderer";
import type { ArrowHeadType, Document, Element, Point } from "./types";
import { arrowHeadSize, arrowHeadVectors, arrowPoints, cornerRadius, curvedArrowControl, diamondVertices, edgePathPoints, ensureContextZOrder, escapeXml, unionBounds } from "./utils";
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
const HACHURE_SPACING = 4.8;

/** vertical gap needed above/below a context to fit its external label */
function gapForLabel(fontSize: number): number {
  return fontSize + 8;
}

function truncatedHachureSvg(
  el: Document["elements"][number],
  clipId: string,
): string {
  const color =
    el.backgroundColor === "transparent"
      ? el.strokeColor
      : el.backgroundColor;
  let shape = "";
  if (el.type === "rectangle" || el.type === "component" || el.type === "context") {
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

export function downloadBlob(blob: Blob, filename: string) {
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

  // external context labels sit outside the element bounds — expand the
  // export region so top/bottom labels aren't clipped
  for (const el of doc.elements) {
    if (el.type !== "context" || !el.label) continue;
    const pad = gapForLabel(el.fontSize ?? 16);
    if (el.labelPosition === "top-left" || el.labelPosition === "top-right") {
      bounds.y1 = Math.min(bounds.y1, el.y - pad);
    } else {
      bounds.y2 = Math.max(bounds.y2, el.y + el.height + pad);
    }
  }

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

/** outline SVG tag for a closed shape (rect/diamond/ellipse/component/context) */
function shapeTag(el: Document["elements"][number], attrs: string): string {
  if (el.type === "rectangle" || el.type === "component" || el.type === "context") {
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
  if (el.type === "rectangle" || el.type === "component" || el.type === "context") {
    return roundedRectLoop(el.x, el.y, el.width, el.height, cornerRadius(el));
  }
  if (el.type === "diamond") return diamondLoop(el);
  return ellipseLoop(el.x, el.y, el.width, el.height);
}

/** waveScale used by the canvas for the same shape (rounded corners skip the
 *  heavy wave so arcs stay arcs) */
function shapeWaveScale(el: Element): number {
  return (el.type === "rectangle" || el.type === "component" || el.type === "context") &&
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
  color: string,
  opacity: string,
  headSeed: number,
  type: ArrowHeadType = "arrow",
): string {
  const size = arrowHeadSize(el) * 1.2;
  if (type === "none") return "";
  if (type === "circle") {
    const r = (size * 0.35).toFixed(2);
    return `<circle cx="${tip.x.toFixed(2)}" cy="${tip.y.toFixed(2)}" r="${r}" fill="${color}"${opacity}/>`;
  }
  const [p1, p2] = arrowHeadVectors(tip, tail, size);
  if (type === "arrow") {
    if (isSketch(el)) {
      // sketched chevron wings read shorter than the triangle's silhouette;
      // grow them with the roughness (canvas mirror) and trace each wing
      // separately so both loose tips scatter
      const r = el.roughness ?? 0;
      const ws = size * (1 + r * 0.04);
      const [w1, w2] = arrowHeadVectors(tip, tail, ws);
      const d =
        sketchPathD([[tip, w1]], r, headSeed, 1, true, false) +
        sketchPathD([[tip, w2]], r, headSeed + 16, 1, true, false);
      return `<path d="${d}" fill="none" ${stroke}${opacity}/>`;
    }
    return `<path d="${arrowHeadPoints(tip, tail, size)}" fill="none" ${stroke}${opacity}/>`;
  }
  if (type === "triangle") {
    const points = `${tip.x.toFixed(2)},${tip.y.toFixed(2)} ${p1.x.toFixed(2)},${p1.y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
    if (isSketch(el)) {
      // clamp only the tip corners so the wing tips scatter like the "arrow"
      // head (double-ending clamp pins every corner → clean triangle)
      const d =
        sketchPathD([[tip, p1]], el.roughness ?? 0, headSeed + 13, 1, true, false) +
        sketchPathD([[p1, p2]], el.roughness ?? 0, headSeed + 29, 1, false, false) +
        sketchPathD([[p2, tip]], el.roughness ?? 0, headSeed + 47, 1, false, true);
      return `<polygon points="${points}" fill="${color}"${opacity}/><path d="${d}" fill="none" ${stroke}${opacity}/>`;
    }
    return `<polygon points="${points}" fill="${color}"${opacity}/>`;
  }
  return "";
}

/**
 * SVG markup for a document (scene coordinates, auto-computed viewBox with
 * padding). Pure string builder — framework-free, shared by the SVG export
 * and the "Add to Library" feature.
 */
export function buildSvgString(doc: Document): string | null {
  const bounds = unionBounds(doc.elements);
  if (!bounds) return null;

  // external context labels sit outside the element bounds — expand the
  // viewBox so top/bottom labels aren't clipped
  for (const el of doc.elements) {
    if (el.type !== "context" || !el.label) continue;
    const fontSize = el.fontSize ?? 16;
    const pad = gapForLabel(fontSize);
    if (el.labelPosition === "top-left" || el.labelPosition === "top-right") {
      bounds.y1 = Math.min(bounds.y1, el.y - pad);
    } else {
      bounds.y2 = Math.max(bounds.y2, el.y + el.height + pad);
    }
  }

  const w = bounds.x2 - bounds.x1 + EXPORT_PADDING * 2;
  const h = bounds.y2 - bounds.y1 + EXPORT_PADDING * 2;

  const parts: string[] = [];
  for (const el of ensureContextZOrder(doc.elements)) {
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
      el.type === "component" ||
      el.type === "context";
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
} else if (el.type === "context" && el.label) {
        const pos = el.labelPosition ?? "top-left";
        const side = el.labelSide ?? "external";
        const isTop = pos === "top-left" || pos === "top-right";
        const isLeft = pos === "top-left" || pos === "bottom-left";
        const fontSize = el.fontSize ?? 16;
        const textColor = el.textColor || el.strokeColor;
        const lines = el.label.split("\n");
        const lh = lineHeight(el);
        const step = fontSize * lh;
        const blockCenter = ((lines.length - 1) * step) / 2;
        const blockH = (lines.length - 1) * step + fontSize;
        const base = el.textOffsetGlobal ?? 8;
        const distH = base + (isLeft ? (el.textOffsetLeft ?? 0) : (el.textOffsetRight ?? 0));
        const distV = base + (isTop ? (el.textOffsetTop ?? 0) : (el.textOffsetBottom ?? 0));
        const hOff = isLeft ? (el.textOffsetLeft ?? 0) : (el.textOffsetRight ?? 0);
        // mirrors the canvas "middle" baseline anchor for each line
        const mainAnchor =
          side === "internal"
            ? isTop
              ? el.y + distV + fontSize / 2
              : el.y + el.height - distV - blockH + fontSize / 2
            : isTop
              ? el.y - distV - blockCenter
              : el.y + el.height + distV + blockCenter;
        const anchorX =
          side === "internal"
            ? isLeft
              ? el.x + distH
              : el.x + el.width - distH
            : isLeft
              ? el.x + hOff
              : el.x + el.width - hOff;
        lines.forEach((line, i) => {
          const ty = mainAnchor + i * step + fontSize * 0.85;
          const ta = isLeft ? "start" : "end";
          parts.push(
            `<text x="${anchorX}" y="${ty}" text-anchor="${ta}" font-family="${escapeXml(fontFamilyOf(el))}" font-size="${fontSize}" ${el.bold ? `font-weight="bold"` : ""} ${el.italic ? `font-style="italic"` : ""} fill="${textColor}"${opacity}>${escapeXml(line)}</text>`
          );
        });
      }
    } else if (el.type === "line") {
      const [a, b] = arrowPoints(el);
      const lineType = el.lineType ?? "straight";
      const endY = b.y === a.y ? b.y + 1 : b.y;
      const tip = { x: b.x, y: endY };
      if (lineType === "curved") {
        const cp = curvedArrowControl(el, a, tip);
        parts.push(`<path d="M ${a.x} ${a.y} Q ${cp.x} ${cp.y} ${tip.x} ${tip.y}" fill="none" ${stroke}${dash}${opacity}/>`);
      } else if (isSketch(el) && el.strokeStyle === "solid") {
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
      const arrowEl = el as import("./types").ArrowElement;
      const startType = arrowEl.startArrowhead ?? "none";
      const endType = arrowEl.endArrowhead ?? "arrow";
      if (lineType === "curved") {
        const cp = curvedArrowControl(el, a, tip);
        parts.push(`<path d="M ${a.x} ${a.y} Q ${cp.x} ${cp.y} ${tip.x} ${tip.y}" fill="none" ${stroke}${dash}${opacity}/>`);
        parts.push(arrowHeadSvg(el, tip, cp, stroke, el.strokeColor, opacity, headSeed, endType));
        parts.push(arrowHeadSvg(el, a, cp, stroke, el.strokeColor, opacity, headSeed + 3, startType));
      } else if (isSketch(el) && el.strokeStyle === "solid") {
        const pts = lineType === "auto" ? edgePathPoints(el) : [a, tip];
        const headTail = lineType === "auto" && pts.length >= 2 ? pts[pts.length - 2] : a;
        const headNext = lineType === "auto" && pts.length >= 2 ? pts[1] : tip;
        parts.push(`<path d="${sketchPathD([pts], el.roughness ?? 0, seedOf(el.id), 1, false, true)}" fill="none" ${stroke}${dash}${opacity}/>`);
        parts.push(arrowHeadSvg(el, tip, headTail, stroke, el.strokeColor, opacity, headSeed, endType));
        parts.push(arrowHeadSvg(el, a, headNext, stroke, el.strokeColor, opacity, headSeed + 3, startType));
      } else if (lineType === "auto") {
        const pts = edgePathPoints(el);
        const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
        parts.push(`<path d="${d}" fill="none" ${stroke}${dash}${opacity}/>`);
        const prevPt = pts.length >= 2 ? pts[pts.length - 2] : a;
        const nextPt = pts.length >= 2 ? pts[1] : tip;
        parts.push(arrowHeadSvg(el, tip, prevPt, stroke, el.strokeColor, opacity, headSeed, endType));
        parts.push(arrowHeadSvg(el, a, nextPt, stroke, el.strokeColor, opacity, headSeed + 3, startType));
      } else {
        parts.push(`<line x1="${a.x}" y1="${a.y}" x2="${tip.x}" y2="${tip.y}" fill="none" ${stroke}${dash}${opacity}/>`);
        parts.push(arrowHeadSvg(el, tip, a, stroke, el.strokeColor, opacity, headSeed, endType));
        parts.push(arrowHeadSvg(el, a, tip, stroke, el.strokeColor, opacity, headSeed + 3, startType));
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

// ---- clipboard copy ------------------------------------------------------

export async function copySvgToClipboard(doc: Document): Promise<boolean> {
  const svg = buildSvgString(doc);
  if (!svg) return false;
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "image/svg+xml": new Blob([svg], { type: "image/svg+xml" }),
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function copyPngToClipboard(doc: Document): Promise<boolean> {
  const bounds = unionBounds(doc.elements);
  if (!bounds) return false;

  await waitForComponentImages(
    doc.elements
      .filter((el) => el.type === "component")
      .map((el) => (el as { componentId: string }).componentId),
  );
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

  return new Promise<boolean>((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        resolve(false);
        return;
      }
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        resolve(true);
      } catch {
        resolve(false);
      }
    }, "image/png");
  });
}
