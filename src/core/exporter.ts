import { render, componentIconLayout } from "./renderer";
import type { Document } from "./types";
import { arrowHeadSize, arrowHeadVectors, arrowPoints, cornerRadius, curvedArrowControl, diamondVertices, edgePathPoints, escapeXml, unionBounds } from "./utils";
import { getLibraryItem } from "./library";
import { componentAssetDataUri, waitForComponentImages, waitForImage } from "./componentAssets";
import { strokeDashArray } from "./strokeStyle";
import { fontFamilyOf, lineHeight, textBlockHeight } from "./textStyle";

const EXPORT_PADDING = 20;
const PNG_SCALE = 2;
const HACHURE_SPACING = 10;

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

export function exportSVG(doc: Document, filename: string): boolean {
  const bounds = unionBounds(doc.elements);
  if (!bounds) return false;

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
    const isHatch =
      (el.type === "rectangle" || el.type === "component") &&
      (el.fillStyle === "hachure" || el.fillStyle === "cross-hachure");
    const fill = el.backgroundColor === "transparent" ? "none" : el.backgroundColor;
    if (el.type === "rectangle") {
      const r = cornerRadius(el);
      if (isHatch) {
        const clipId = `hatch-${el.id}`;
        parts.push(
          `<g${opacity}>${truncatedHachureSvg(el, clipId)}<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${r}" fill="none" ${stroke}${dash}/></g>`
        );
      } else {
        parts.push(
          `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${r}" fill="${fill}" ${stroke}${dash}${opacity}/>`
        );
      }
    } else if (el.type === "component") {
      const r = cornerRadius(el);
      if (isHatch) {
        const clipId = `hatch-${el.id}`;
        parts.push(
          `<g${opacity}>${truncatedHachureSvg(el, clipId)}<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${r}" fill="none" ${stroke}${dash}/></g>`
        );
      } else {
        parts.push(
          `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${r}" fill="${fill}" ${stroke}${dash}${opacity}/>`
        );
      }
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
    } else if (el.type === "line") {
      const [a, b] = arrowPoints(el);
      const lineType = el.lineType ?? "straight";
      const endY = b.y === a.y ? b.y + 1 : b.y;
      const tip = { x: b.x, y: endY };
      if (lineType === "curved") {
        const cp = curvedArrowControl(el, a, tip);
        parts.push(`<path d="M ${a.x} ${a.y} Q ${cp.x} ${cp.y} ${tip.x} ${tip.y}" fill="none" ${stroke}${dash}${opacity}/>`);
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
      if (lineType === "curved") {
        const cp = curvedArrowControl(el, a, tip);
        parts.push(`<path d="M ${a.x} ${a.y} Q ${cp.x} ${cp.y} ${tip.x} ${tip.y}" fill="none" ${stroke}${dash}${opacity}/>`);
        parts.push(`<path d="${arrowHeadPoints(tip, cp, arrowHeadSize(el) * 1.2)}" fill="none" ${stroke}${opacity}/>`);
      } else if (lineType === "auto") {
        const pts = edgePathPoints(el);
        const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
        parts.push(`<path d="${d}" fill="none" ${stroke}${dash}${opacity}/>`);
        const prevPt = pts.length >= 2 ? pts[pts.length - 2] : a;
        parts.push(`<path d="${arrowHeadPoints(tip, prevPt, arrowHeadSize(el) * 1.2)}" fill="none" ${stroke}${opacity}/>`);
      } else {
        parts.push(`<line x1="${a.x}" y1="${a.y}" x2="${tip.x}" y2="${tip.y}" fill="none" ${stroke}${dash}${opacity}/>`);
        parts.push(`<path d="${arrowHeadPoints(tip, a, arrowHeadSize(el) * 1.2)}" fill="none" ${stroke}${opacity}/>`);
      }
    } else if (el.type === "text") {
      const lines = el.text.split("\n");
      const lh = lineHeight(el);
      const blockH = textBlockHeight(el.fontSize, lines.length, lh);
      const vOffset = Math.max(0, (el.height - blockH) / 2);
      lines.forEach((line, i) => {
        parts.push(
          `<text x="${el.x}" y="${el.y + vOffset + i * el.fontSize * lh + el.fontSize * 0.85}" font-family="${fontFamilyOf(el)}" font-size="${el.fontSize}" fill="${el.strokeColor}"${opacity}>${escapeXml(line)}</text>`
        );
      });
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${bounds.x1 - EXPORT_PADDING} ${bounds.y1 - EXPORT_PADDING} ${w} ${h}">
${parts.map((p) => `  ${p}`).join("\n")}
</svg>`;

  downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${filename}.svg`);
  return true;
}
