import { render, componentIconLayout } from "./renderer";
import type { Bounds, Document, Element } from "./types";
import { arrowPoints, elementBounds } from "./utils";
import { getLibraryItem } from "./library";
import { componentAssetDataUri, waitForComponentImages } from "./componentAssets";

const EXPORT_PADDING = 20;
const PNG_SCALE = 2;

function contentBounds(elements: Element[]): Bounds | null {
  if (elements.length === 0) return null;
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const el of elements) {
    const b = elementBounds(el);
    x1 = Math.min(x1, b.x1);
    y1 = Math.min(y1, b.y1);
    x2 = Math.max(x2, b.x2);
    y2 = Math.max(y2, b.y2);
  }
  return { x1, y1, x2, y2 };
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
  const bounds = contentBounds(doc.elements);
  if (!bounds) return false;

  // official icons load asynchronously — make sure they're decoded
  await waitForComponentImages(
    doc.elements
      .filter((el) => el.type === "component")
      .map((el) => (el as { componentId: string }).componentId),
  );

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

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function arrowHeadPoints(tip: { x: number; y: number }, tail: { x: number; y: number }): string {
  const size = 12;
  const angle = Math.atan2(tip.y - tail.y, tip.x - tail.x);
  const p1 = {
    x: tip.x - size * Math.cos(angle - Math.PI / 6),
    y: tip.y - size * Math.sin(angle - Math.PI / 6),
  };
  const p2 = {
    x: tip.x - size * Math.cos(angle + Math.PI / 6),
    y: tip.y - size * Math.sin(angle + Math.PI / 6),
  };
  return `M ${tip.x} ${tip.y} L ${p1.x} ${p1.y} M ${tip.x} ${tip.y} L ${p2.x} ${p2.y}`;
}

export function exportSVG(doc: Document, filename: string): boolean {
  const bounds = contentBounds(doc.elements);
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
        : el.strokeStyle === "dashed"
          ? ` stroke-dasharray="${el.strokeWidth * 5} ${el.strokeWidth * 4}"`
          : el.strokeStyle === "dotted"
            ? ` stroke-dasharray="0.1 ${el.strokeWidth * 2.6}"`
            : el.strokeStyle === "dashdot"
              ? ` stroke-dasharray="${el.strokeWidth * 5} ${el.strokeWidth * 3} ${el.strokeWidth} ${el.strokeWidth * 3}"`
              : "";
    const opacity = el.opacity < 1 ? ` opacity="${el.opacity}"` : "";
    const fill = el.backgroundColor === "transparent" ? "none" : el.backgroundColor;
    if (el.type === "rectangle") {
      const r =
        el.borderRadius > 0
          ? Math.min(100, el.borderRadius) / 100 *
            (Math.min(Math.abs(el.width), Math.abs(el.height)) / 2)
          : 0;
      parts.push(
        `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${r}" fill="${fill}" ${stroke}${dash}${opacity}/>`
      );
    } else if (el.type === "component") {
      const r =
        el.borderRadius > 0
          ? Math.min(100, el.borderRadius) / 100 *
            (Math.min(Math.abs(el.width), Math.abs(el.height)) / 2)
          : 0;
      parts.push(
        `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${r}" fill="${fill}" ${stroke}${dash}${opacity}/>`
      );
      const layout = componentIconLayout(el);
      const dataUri = componentAssetDataUri(el.componentId);
      if (dataUri) {
        parts.push(
          `<image x="${layout.iconX}" y="${layout.iconY}" width="${layout.iconSize}" height="${layout.iconSize}" href="${dataUri}"${opacity}/>`
        );
      } else {
        // fallback: hand-drawn glyph paths (24x24 viewBox)
        const item = getLibraryItem(el.componentId);
        if (item && item.icon && item.icon.length > 0) {
          const scale = layout.iconSize / 24;
          parts.push(
            `<g transform="translate(${layout.iconX} ${layout.iconY}) scale(${scale})" fill="none" stroke="${el.strokeColor}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"${opacity}>${item.icon
              .map((d) => `<path d="${d}"/>`)
              .join("")}</g>`
          );
        }
      }
    } else if (el.type === "arrow") {
      const [a, b] = arrowPoints(el);
      const endY = b.y === a.y ? b.y + 1 : b.y;
      const tip = { x: b.x, y: endY };
      const lineType = el.lineType ?? "straight";
      if (lineType === "curved") {
        const cp = el.controlPoint ?? {
          x: (a.x + tip.x) / 2,
          y: (a.y + tip.y) / 2 - Math.abs(tip.x - a.x) * 0.3,
        };
        parts.push(`<path d="M ${a.x} ${a.y} Q ${cp.x} ${cp.y} ${tip.x} ${tip.y}" fill="none" ${stroke}${dash}${opacity}/>`);
        parts.push(`<path d="${arrowHeadPoints(tip, cp)}" fill="none" ${stroke}${opacity}/>`);
      } else if (lineType === "auto") {
        const mid = { x: tip.x, y: a.y };
        parts.push(`<path d="M ${a.x} ${a.y} L ${mid.x} ${mid.y} L ${tip.x} ${tip.y}" fill="none" ${stroke}${dash}${opacity}/>`);
        parts.push(`<path d="${arrowHeadPoints(tip, mid)}" fill="none" ${stroke}${opacity}/>`);
      } else {
        parts.push(`<line x1="${a.x}" y1="${a.y}" x2="${tip.x}" y2="${tip.y}" fill="none" ${stroke}${dash}${opacity}/>`);
        parts.push(`<path d="${arrowHeadPoints(tip, a)}" fill="none" ${stroke}${opacity}/>`);
      }
    } else if (el.type === "text") {
      const lines = el.text.split("\n");
      lines.forEach((line, i) => {
        parts.push(
          `<text x="${el.x}" y="${el.y + i * el.fontSize * 1.25 + el.fontSize * 0.85}" font-family="system-ui, sans-serif" font-size="${el.fontSize}" fill="${el.strokeColor}"${opacity}>${escapeXml(line)}</text>`
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
