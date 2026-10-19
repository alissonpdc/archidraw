import type { ArrowBinding, ArrowElement, ArrowHeadType, Bounds, Camera, ComponentElement, ContextElement, Document, Element, LineElement, Point } from "./types";
import {
  arrowHeadVectors,
  arrowPoints,
  edgeTip,
  bindingPoint,
  cornerRadius,
  curvedArrowControl,
  diamondVertices,
  edgeLabelAnchor,
  edgePathPoints,
  edgePointAt,
  elementAngle,
  elementBounds,
  elementCenter,
  elementCorners,
  isRotatable,
  measureText,
  rotatedBounds,
  toScenePoint,
  translatedOrigin,
  unionBounds,
} from "./utils";
import { getLibraryItem } from "./library";
import { getComponentImage, getCachedImage } from "./componentAssets";
import { resolveFont, resolveTextColor, lineHeight, textBlockHeight, fontFamilyOf } from "./textStyle";
import { themeColor } from "./color";
import { strokeDashArray, strokeRoundCap } from "./strokeStyle";
import {
  diamondLoop,
  ellipseLoop,
  roundedRectLoop,
  seedOf,
  sketchStrokePath2D,
  sketchStrokeSegments,
} from "./roughPath";

export interface RenderColors {
  selection: string;
  gridDot: string;
  gridLine: string;
  gridLineMaster: string;
  elementStroke: string;
  canvasBg: string;
  muted: string;
}

export interface RenderState {
  doc: Document;
  camera: Camera;
  selectedIds: ReadonlySet<string>;
  draft: Element | null;
  marquee: { x1: number; y1: number; x2: number; y2: number } | null;
  colors?: RenderColors;
  gridMode?: "none" | "dots" | "lines";
  guides?: { orientation: "h" | "v"; pos: number }[] | null;
  bindingPreview?: { start: ArrowBinding | null; end: ArrowBinding | null } | null;
  hiddenLabelId?: string | null;
  hiddenTextId?: string | null;
  animationPhase?: number;
  highlightedIds?: ReadonlySet<string>;
  /** context element highlighted as a drop target while dragging elements in */
  highlightedContextId?: string | null;
}

const DEFAULT_COLORS: RenderColors = {
  selection: "#6965db",
  elementStroke: "#26292c",
  gridDot: "rgba(0,0,0,0.07)",
  gridLine: "rgba(0,0,0,0.05)",
  gridLineMaster: "rgba(0,0,0,0.07)",
  canvasBg: "#ffffff",
  muted: "#6b6b76",
};

const GRID_STEP = 20;

interface ElementGeometryCache {
  bounds?: Bounds;
  visualBounds?: Bounds;
  strokePath?: Path2D;
  fillPath?: Path2D;
  hachurePath?: Path2D;
  childSet?: Set<string>;
  textLayout?: {
    lines: string[];
    lineWidths: number[];
    maxWidth: number;
  };
}

const geometryCache = new WeakMap<Element, ElementGeometryCache>();

/**
 * pushes a rotation transform (about the element center) so every drawing
 * routine below can keep working in the element's own unrotated frame.
 * No-op when the element has no angle.
 */
function applyRotation(ctx: CanvasRenderingContext2D, el: Element) {
  const angle = elementAngle(el);
  if (angle === 0) return;
  const c = elementCenter(el);
  ctx.translate(c.x, c.y);
  ctx.rotate(angle);
  ctx.translate(-c.x, -c.y);
}

function getElementCache(el: Element): ElementGeometryCache {
  let cache = geometryCache.get(el);
  if (!cache) {
    cache = {};
    geometryCache.set(el, cache);
  }
  return cache;
}

function getContextChildSet(ctx: ContextElement): Set<string> {
  const cache = getElementCache(ctx);
  if (!cache.childSet) {
    cache.childSet = new Set(ctx.childIds);
  }
  return cache.childSet;
}

function getCachedBounds(el: Element): Bounds {
  const cache = getElementCache(el);
  if (!cache.bounds) {
    const root = translatedOrigin.get(el);
    if (root) {
      const rb = getCachedBounds(root);
      const dx = el.x - root.x;
      const dy = el.y - root.y;
      cache.bounds = {
        x1: rb.x1 + dx,
        y1: rb.y1 + dy,
        x2: rb.x2 + dx,
        y2: rb.y2 + dy,
      };
    } else {
      cache.bounds = computeVisualBounds(el);
    }
  }
  return cache.bounds;
}

function computeVisualBounds(el: Element): Bounds {
  if (el.type === "arrow" || el.type === "line") {
    const [a, b] = arrowPoints(el);
    const lineType = el.lineType ?? "straight";
    if (lineType === "curved") {
      const tip = { x: b.x, y: b.y === a.y ? b.y + 1 : b.y };
      const cp = curvedArrowControl(el, a, tip);
      return {
        x1: Math.min(a.x, tip.x, cp.x),
        y1: Math.min(a.y, tip.y, cp.y),
        x2: Math.max(a.x, tip.x, cp.x),
        y2: Math.max(a.y, tip.y, cp.y),
      };
    }
    if (lineType === "auto") {
      const pts = edgePathPoints(el);
      let minX = pts[0].x;
      let minY = pts[0].y;
      let maxX = minX;
      let maxY = minY;
      for (let i = 1; i < pts.length; i++) {
        if (pts[i].x < minX) minX = pts[i].x;
        if (pts[i].y < minY) minY = pts[i].y;
        if (pts[i].x > maxX) maxX = pts[i].x;
        if (pts[i].y > maxY) maxY = pts[i].y;
      }
      return { x1: minX, y1: minY, x2: maxX, y2: maxY };
    }
    return {
      x1: Math.min(a.x, b.x),
      y1: Math.min(a.y, b.y),
      x2: Math.max(a.x, b.x),
      y2: Math.max(a.y, b.y),
    };
  }
  return {
    x1: Math.min(el.x, el.x + el.width),
    y1: Math.min(el.y, el.y + el.height),
    x2: Math.max(el.x, el.x + el.width),
    y2: Math.max(el.y, el.y + el.height),
  };
}

interface GridPatternEntry {
  pattern: CanvasPattern;
  tilePx: number;
}

const dotPatternCache = new Map<string, GridPatternEntry>();
const linePatternCache = new Map<string, GridPatternEntry>();
const GRID_CELLS = 10;

function getGridDotPattern(
  ctx: CanvasRenderingContext2D,
  color: string,
  scale: number,
): GridPatternEntry {
  const tilePx = Math.max(GRID_CELLS, Math.round(GRID_CELLS * GRID_STEP * scale));
  const key = `${color}:${tilePx}`;
  let entry = dotPatternCache.get(key);
  if (!entry) {
    const tile = document.createElement("canvas");
    tile.width = tilePx;
    tile.height = tilePx;
    const tctx = tile.getContext("2d")!;
    tctx.fillStyle = color;
    const r = Math.max(0.8, 1.3 * scale);
    for (let ix = 0; ix <= GRID_CELLS; ix++) {
      const cx = (ix * tilePx) / GRID_CELLS;
      for (let iy = 0; iy <= GRID_CELLS; iy++) {
        const cy = (iy * tilePx) / GRID_CELLS;
        tctx.beginPath();
        tctx.arc(cx, cy, r, 0, Math.PI * 2);
        tctx.fill();
      }
    }
    entry = { pattern: ctx.createPattern(tile, "repeat")!, tilePx };
    dotPatternCache.set(key, entry);
  }
  return entry;
}

function getGridLinePattern(
  ctx: CanvasRenderingContext2D,
  colorMicro: string,
  colorMaster: string,
  scale: number,
): GridPatternEntry {
  const tilePx = Math.max(GRID_CELLS, Math.round(GRID_CELLS * GRID_STEP * scale));
  const key = `${colorMicro}:${colorMaster}:${tilePx}`;
  let entry = linePatternCache.get(key);
  if (!entry) {
    const tile = document.createElement("canvas");
    tile.width = tilePx;
    tile.height = tilePx;
    const tctx = tile.getContext("2d")!;
    tctx.strokeStyle = colorMicro;
    tctx.lineWidth = Math.max(0.5, 0.7 * scale);
    const dash = Math.max(1, 4 * scale);
    tctx.setLineDash([dash, dash]);
    tctx.beginPath();
    for (let i = 1; i < GRID_CELLS; i++) {
      if (i % 5 === 0) continue;
      const p = (i * tilePx) / GRID_CELLS;
      tctx.moveTo(p, 0);
      tctx.lineTo(p, tilePx);
      tctx.moveTo(0, p);
      tctx.lineTo(tilePx, p);
    }
    tctx.stroke();

    tctx.strokeStyle = colorMaster;
    tctx.lineWidth = Math.max(0.7, 0.9 * scale);
    tctx.setLineDash([]);
    tctx.beginPath();
    for (const i of [0, 5, 10]) {
      const p = (i * tilePx) / GRID_CELLS;
      tctx.moveTo(p, 0);
      tctx.lineTo(p, tilePx);
      tctx.moveTo(0, p);
      tctx.lineTo(tilePx, p);
    }
    tctx.stroke();
    entry = { pattern: ctx.createPattern(tile, "repeat")!, tilePx };
    linePatternCache.set(key, entry);
  }
  return entry;
}

function fillDeviceGrid(
  ctx: CanvasRenderingContext2D,
  entry: GridPatternEntry,
  cam: Camera,
  canvasWidth: number,
  canvasHeight: number,
) {
  const m = ctx.getTransform();
  const dpr = m.a / cam.zoom;
  const { pattern, tilePx } = entry;
  const ox = ((m.e % tilePx) + tilePx) % tilePx;
  const oy = ((m.f % tilePx) + tilePx) % tilePx;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, ox - tilePx, oy - tilePx);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, Math.ceil(canvasWidth * dpr) + tilePx, Math.ceil(canvasHeight * dpr) + tilePx);
  ctx.restore();
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  tip: Point,
  tail: Point,
  size: number,
  color: string,
  roughness: number,
  seed: number,
  type: ArrowHeadType = "arrow",
) {
  if (type === "none") return;
  // the head never inherits the shaft dash pattern — wings stay solid
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;

  if (type === "circle") {
    const r = size * 0.35;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    return;
  }

  const [p1, p2] = arrowHeadVectors(tip, tail, size);

  if (type === "arrow") {
    // optical fix: a sketched chevron's thin loose tips read shorter than the
    // filled triangle's silhouette, so grow the wings with the roughness
    const ws = size * (1 + roughness * 0.04);
    const [w1, w2] = arrowHeadVectors(tip, tail, ws);
    ctx.beginPath();
    sketchStroke(ctx, [[tip, w1]], roughness, seed, 1, true, false);
    sketchStroke(ctx, [[tip, w2]], roughness, seed + 16, 1, true, false);
    ctx.stroke();
  } else if (type === "triangle") {
    // filled triangle: single-color head matching the stroke — fill first
    // then sketch the outline for hand-drawn look
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.closePath();
    ctx.fill();
    // sketch outline over the fill: clamp only the tip corners (loose wing
    // tips scatter like the "arrow" head — double-clamping both ends pins
    // every corner and reads as a clean triangle)
    if (roughness > 0) {
      ctx.beginPath();
      sketchStroke(ctx, [[tip, p1]], roughness, seed + 13, 1, true, false);
      sketchStroke(ctx, [[p1, p2]], roughness, seed + 29, 1, false, false);
      sketchStroke(ctx, [[p2, tip]], roughness, seed + 47, 1, false, true);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.closePath();
      ctx.stroke();
    }
  }
}

/** resolves the element stroke; empty / legacy auto values → transparent */
function resolveStroke(el: Element, colors: RenderColors): string {
  return themeColor(el.strokeColor, colors.elementStroke, colors.canvasBg);
}

/** resolves the element fill; transparent / DEFAULT_BG sentinel → theme-aware grey */
function resolveFill(el: Element, colors: RenderColors): string {
  if (!el.backgroundColor || el.backgroundColor === "transparent") return "transparent";
  return themeColor(el.backgroundColor, colors.elementStroke, colors.canvasBg);
}

/**
 * strokes hand-drawn polylines: a single straight pass when clean,
 * independent offset passes otherwise (sloppy sketch look).
 * Geometry is shared with the SVG exporter via roughPath — replayed here.
 */
function sketchStroke(
  ctx: CanvasRenderingContext2D,
  polylines: Point[][],
  roughness: number,
  seedBase: number,
  waveScale = 1,
  clampStart = false,
  clampEnd = false,
) {
  for (const seg of sketchStrokeSegments(
    polylines,
    roughness,
    seedBase,
    waveScale,
    clampStart,
    clampEnd,
  )) {
    ctx.moveTo(seg.moveTo.x, seg.moveTo.y);
    for (const c of seg.curves) {
      if (c.kind === "quad" && c.ctrl) {
        ctx.quadraticCurveTo(c.ctrl.x, c.ctrl.y, c.to.x, c.to.y);
      } else {
        ctx.lineTo(c.to.x, c.to.y);
      }
    }
  }
}



// ---- library icon rendering (Path2D cache) ------------------------------

const iconPathCache = new Map<string, Path2D[]>();

function iconPaths(componentId: string): Path2D[] {
  let paths = iconPathCache.get(componentId);
  if (!paths) {
    const item = getLibraryItem(componentId);
    paths = (item?.icon ?? []).map((d) => new Path2D(d));
    iconPathCache.set(componentId, paths);
  }
  return paths;
}

// assets (ícones AWS, libs importadas e imagens raster) são desenhados pelo
// pipeline de imagens em componentAssets — nenhum cache duplicado aqui.

function applyDash(
  ctx: CanvasRenderingContext2D,
  el: Element,
  strokeWidth: number,
  phase: number = 0,
  animated: boolean = false,
) {
  const dash = strokeDashArray(el.strokeStyle, strokeWidth);
  if (dash.length === 0) return;
  if (animated) ctx.lineDashOffset = -phase;
  ctx.setLineDash(dash);
  if (strokeRoundCap(el.strokeStyle)) ctx.lineCap = "round";
}

/** fixed icon→label distance and font size (do NOT scale with resize) */
const ICON_LABEL_GAP = 2;
const COMPONENT_LABEL_FONT = 12;

/** label inset inside a shape: global text offset + the per-side offset of
 *  the side the text is aligned to (same model as caption gap/offset) */
export function textOffsets(el: Element): { padX: number; padY: number } {
  const g = el.textOffsetGlobal ?? 8;
  const align = el.textAlign ?? "center";
  const vAlign = el.textVAlign ?? "middle";
  return {
    padX:
      g +
      (align === "left"
        ? el.textOffsetLeft ?? 0
        : align === "right"
          ? el.textOffsetRight ?? 0
          : 0),
    padY:
      g +
      (vAlign === "top"
        ? el.textOffsetTop ?? 0
        : vAlign === "bottom"
          ? el.textOffsetBottom ?? 0
          : 0),
  };
}

/**
 * shared caption-positioning for elements whose label lives OUTSIDE the icon
 * (library components) or image rect (pasted png): the label block center is
 * placed on the requested caption side even when there is NO text yet — so
 * the edit caret starts exactly where the caption will render (instead of the
 * element center, which shifted the text on the first keystroke).
 */
function captionLayout(
  el: Element & { label?: string },
  box: { x: number; y: number; width: number; height: number },
  labelFont: number,
) {
  const captionPos = el.captionPosition ?? "bottom";
  const baseGap = el.captionGap ?? ICON_LABEL_GAP;
  const offset =
    captionPos === "top" ? (el.captionOffsetTop ?? 0) :
    captionPos === "bottom" ? (el.captionOffsetBottom ?? 0) :
    captionPos === "left" ? (el.captionOffsetLeft ?? 0) :
    (el.captionOffsetRight ?? 0);
  const gap = baseGap + offset;
  const labelH = labelFont * 1.25;
  const lines = el.label ? el.label.split("\n") : [];
  const hasLabel = lines.length > 0 && lines.some((l) => l.trim() !== "");
  const lh = lineHeight(el);
  const step = labelFont * lh;
  const n = Math.max(lines.length, 1);
  const tw = hasLabel
    ? measureText(el.label!, labelFont, fontFamilyOf(el), el.bold, el.italic).width
    : 0;
  const vShift = hasLabel ? ((n - 1) * step) / 2 : 0;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // single-line block sits fully outside the box: block center starts at the
  // box edge + gap on the label side (multi-line adds vShift around it)
  let labelCx = cx;
  let labelCy = cy;
  if (captionPos === "top") {
    labelCy = box.y - gap - vShift - labelH / 2;
  } else if (captionPos === "bottom") {
    labelCy = box.y + box.height + gap + vShift + labelH / 2;
  } else if (captionPos === "left") {
    labelCx = box.x - gap - tw / 2;
  } else {
    labelCx = box.x + box.width + gap + tw / 2;
  }
  return { hasLabel, labelCx, labelCy };
}

// ---- raster asset cache (HTMLImageElement from data URLs) ----------------
// usado por imagens autocontidas (src embebido no elemento) quando o item de
// lib já foi removido; assets registrados (AWS/libs) vêm de componentAssets.

/**
 * icon/caption geometry shared between canvas rendering, label placement and
 * SVG export. Componentes de lib (AWS/importados) desenham o ícone no menor
 * lado, centralizado; imagens raster importadas (item de lib com `fill`)
 * preenchem o bounds inteiro do elemento — o mesmo modelo de legenda.
 */
export function componentIconLayout(el: ComponentElement) {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  // o elemento carrega seu próprio fill (imagens autocontidas); fallback para
  // o item de lib quando o flag ainda estiver lá
  const fill = el.fill === true || getLibraryItem(el.componentId)?.fill === true;
  const iconWidth = fill
    ? Math.abs(el.width)
    : Math.min(Math.abs(el.width), Math.abs(el.height));
  const iconHeight = fill ? Math.abs(el.height) : iconWidth;
  const iconX = fill ? Math.min(el.x, el.x + el.width) : cx - iconWidth / 2;
  const iconY = fill ? Math.min(el.y, el.y + el.height) : cy - iconHeight / 2;
  const labelFont = el.fontSize ?? COMPONENT_LABEL_FONT;
  const a = captionLayout(
    el,
    { x: iconX, y: iconY, width: iconWidth, height: iconHeight },
    labelFont,
  );
  return {
    hasLabel: a.hasLabel,
    iconX,
    iconY,
    iconWidth,
    iconHeight,
    labelCx: a.labelCx,
    labelCy: a.labelCy,
    labelFont,
    captionPosition: el.captionPosition ?? "bottom",
  };
}

function drawComponentIcon(ctx: CanvasRenderingContext2D, el: ComponentElement) {
  const { iconX, iconY, iconWidth, iconHeight } = componentIconLayout(el);

  // official bundled icon (AWS Architecture Icons) when available — includes
  // libs importadas (.excalidrawlib) e imagens raster registradas como asset.
  // Imagens autocontidas (src no elemento) independent do registro: renderizam
  // mesmo se o item de lib tiver sido removido
  const img = getComponentImage(el.componentId) ??
    (el.src ? getCachedImage(el.src) : null);
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, iconX, iconY, iconWidth, iconHeight);
    return;
  }
  if (el.src) {
    // placeholder enquanto o raster embebido ainda carrega
    ctx.save();
    ctx.fillStyle = "#e0e0e0";
    ctx.fillRect(iconX, iconY, iconWidth, iconHeight);
    ctx.restore();
    return;
  }

  const paths = iconPaths(el.componentId);
  if (paths.length === 0) return;
  const scale = iconWidth / 24;
  ctx.save();
  ctx.translate(iconX, iconY);
  ctx.scale(scale, scale);
  ctx.lineWidth = ctx.lineWidth / scale;
  for (const p of paths) {
    ctx.beginPath();
    ctx.stroke(p);
  }
  ctx.restore();
}

const HACHURE_SPACING = 4.8;

function clipHachureLine(el: Element, p0: Point, p1: Point): [Point, Point] | null {
  const b = elementBounds(el);
  const w = b.x2 - b.x1;
  const h = b.y2 - b.y1;
  const cx = b.x1 + w / 2;
  const cy = b.y1 + h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;

  let t0 = 0;
  let t1 = 1;

  if (el.type === "ellipse") {
    const u0 = (p0.x - cx) / rx;
    const v0 = (p0.y - cy) / ry;
    const du = dx / rx;
    const dv = dy / ry;
    const A = du * du + dv * dv;
    const B = u0 * du + v0 * dv;
    const C = u0 * u0 + v0 * v0 - 1;
    const disc = B * B - A * C;
    if (disc <= 0) return null;
    const sq = Math.sqrt(disc);
    t0 = Math.max(0, (-B - sq) / A);
    t1 = Math.min(1, (-B + sq) / A);
  } else if (el.type === "diamond") {
    const u0 = (p0.x - cx) / rx;
    const v0 = (p0.y - cy) / ry;
    const du = dx / rx;
    const dv = dy / ry;
    const signs = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const;
    for (const [sx, sy] of signs) {
      const a = sx * du + sy * dv;
      const rhs = 1 - (sx * u0 + sy * v0);
      if (a > 0) t1 = Math.min(t1, rhs / a);
      else if (a < 0) t0 = Math.max(t0, rhs / a);
      else if (rhs < 0) return null;
    }
  } else {
    t0 = Math.max(t0, (b.x1 - p0.x) / dx);
    t1 = Math.min(t1, (b.x2 - p0.x) / dx);
    const ty0 = (b.y1 - p0.y) / dy;
    const ty1 = (b.y2 - p0.y) / dy;
    t0 = Math.max(t0, Math.min(ty0, ty1));
    t1 = Math.min(t1, Math.max(ty0, ty1));
  }

  if (t1 - t0 <= 1e-3) return null;
  return [
    { x: p0.x + t0 * dx, y: p0.y + t0 * dy },
    { x: p0.x + t1 * dx, y: p0.y + t1 * dy },
  ];
}

function buildHachurePath(el: Element, withCross: boolean): Path2D {
  const b = elementBounds(el);
  const w = b.x2 - b.x1;
  const h = b.y2 - b.y1;
  const halfSpan = (w + h) / 2 + HACHURE_SPACING;
  const cx = b.x1 + w / 2;
  const cy = b.y1 + h / 2;
  const rawLines: [Point, Point][] = [];
  for (let d = -halfSpan; d <= halfSpan; d += HACHURE_SPACING) {
    rawLines.push([
      { x: cx + d - halfSpan, y: cy - halfSpan },
      { x: cx + d + halfSpan, y: cy + halfSpan },
    ]);
    if (withCross) {
      rawLines.push([
        { x: cx + d - halfSpan, y: cy + halfSpan },
        { x: cx + d + halfSpan, y: cy - halfSpan },
      ]);
    }
  }
  const lines: [Point, Point][] = [];
  for (const [p0, p1] of rawLines) {
    const clipped = clipHachureLine(el, p0, p1);
    if (clipped) lines.push(clipped);
  }
  const path = new Path2D();
  if (el.roughness === 0) {
    for (const l of lines) {
      path.moveTo(l[0].x, l[0].y);
      path.lineTo(l[1].x, l[1].y);
    }
  } else {
    const seedBase = seedOf(el.id) + 7;
    for (let j = 0; j < lines.length; j++) {
      const seg = sketchStrokeSegments(
        [lines[j]],
        el.roughness,
        seedBase + j * 17,
        0.5,
        true,
        true,
      )[0];
      path.moveTo(seg.moveTo.x, seg.moveTo.y);
      for (const c of seg.curves) {
        path.quadraticCurveTo(c.ctrl!.x, c.ctrl!.y, c.to.x, c.to.y);
      }
    }
  }
  return path;
}

function drawHachureFill(
  ctx: CanvasRenderingContext2D,
  el: Element,
  colors: RenderColors,
  withCross: boolean,
) {
  const hatchColor =
    el.backgroundColor && el.backgroundColor !== "transparent"
      ? resolveFill(el, colors)
      : resolveStroke(el, colors);
  ctx.save();
  ctx.strokeStyle = hatchColor;
  ctx.lineCap = "butt";
  ctx.globalAlpha *= el.fillOpacity;
  ctx.lineWidth = 1.2;
  const cache = getElementCache(el);
  if (!cache.hachurePath) {
    cache.hachurePath = buildHachurePath(el, withCross);
  }
  ctx.stroke(cache.hachurePath);
  ctx.restore();
}

function drawElement(
  ctx: CanvasRenderingContext2D,
  el: Element,
  colors: RenderColors,
  animationPhase: number = 0,
) {
  const root = translatedOrigin.get(el);
  if (root) {
    ctx.save();
    ctx.translate(el.x - root.x, el.y - root.y);
    drawElement(ctx, root, colors, animationPhase);
    ctx.restore();
    return;
  }
  const cache = getElementCache(el);
  ctx.save();
  applyRotation(ctx, el);
  ctx.strokeStyle = resolveStroke(el, colors);
  ctx.fillStyle = resolveFill(el, colors);
  ctx.lineWidth = el.strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (el.type === "rectangle" || el.type === "component") {
    if (el.fillStyle !== "hachure" && el.fillStyle !== "cross-hachure") {
      if (el.fillOpacity > 0) {
        ctx.save();
        ctx.globalAlpha *= el.fillOpacity;
        if (!cache.fillPath) {
          const p = new Path2D();
          p.roundRect(el.x, el.y, el.width, el.height, cornerRadius(el));
          cache.fillPath = p;
        }
        ctx.fill(cache.fillPath);
        ctx.restore();
      }
    } else {
      drawHachureFill(ctx, el, colors, el.fillStyle === "cross-hachure");
    }
    if (el.strokeWidth > 0) {
      ctx.save();
      ctx.globalAlpha *= el.strokeOpacity;
      if (!cache.strokePath) {
        if (el.roughness === 0) {
          const p = new Path2D();
          p.roundRect(el.x, el.y, el.width, el.height, cornerRadius(el));
          cache.strokePath = p;
        } else {
          cache.strokePath = sketchStrokePath2D(
            [
              roundedRectLoop(
                el.x,
                el.y,
                el.width,
                el.height,
                cornerRadius(el),
              ),
            ],
            el.roughness,
            seedOf(el.id),
            cornerRadius(el) > 0 ? 0.30 : 1,
          );
        }
      }
      applyDash(ctx, el, el.strokeWidth);
      ctx.stroke(cache.strokePath);
      ctx.restore();
    }

    if (el.type === "component") drawComponentIcon(ctx, el);
  } else if (el.type === "context") {
    if (el.fillOpacity > 0) {
      ctx.save();
      ctx.globalAlpha *= el.fillOpacity;
      if (!cache.fillPath) {
        const p = new Path2D();
        p.roundRect(el.x, el.y, el.width, el.height, cornerRadius(el));
        cache.fillPath = p;
      }
      ctx.fill(cache.fillPath);
      ctx.restore();
    }
    if (el.strokeWidth > 0) {
      ctx.save();
      ctx.globalAlpha *= el.strokeOpacity;
      if (!cache.strokePath) {
        if (el.roughness === 0) {
          const p = new Path2D();
          p.roundRect(el.x, el.y, el.width, el.height, cornerRadius(el));
          cache.strokePath = p;
        } else {
          cache.strokePath = sketchStrokePath2D(
            [
              roundedRectLoop(
                el.x,
                el.y,
                el.width,
                el.height,
                cornerRadius(el),
              ),
            ],
            el.roughness,
            seedOf(el.id),
            cornerRadius(el) > 0 ? 0.30 : 1,
          );
        }
      }
      applyDash(ctx, el, el.strokeWidth);
      ctx.stroke(cache.strokePath);
      ctx.restore();
    }
  } else if (el.type === "diamond") {
    const v = diamondVertices(el);
    if (el.fillStyle !== "hachure" && el.fillStyle !== "cross-hachure") {
      if (el.fillOpacity > 0) {
        ctx.save();
        ctx.globalAlpha *= el.fillOpacity;
        if (!cache.fillPath) {
          const p = new Path2D();
          p.moveTo(v[0].x, v[0].y);
          for (let i = 1; i < v.length; i++) p.lineTo(v[i].x, v[i].y);
          p.closePath();
          cache.fillPath = p;
        }
        ctx.fill(cache.fillPath);
        ctx.restore();
      }
    } else {
      drawHachureFill(ctx, el, colors, el.fillStyle === "cross-hachure");
    }
    ctx.save();
    ctx.globalAlpha *= el.strokeOpacity;
    if (!cache.strokePath) {
      if (el.roughness === 0) {
        const p = new Path2D();
        p.moveTo(v[0].x, v[0].y);
        for (let i = 1; i < v.length; i++) p.lineTo(v[i].x, v[i].y);
        p.closePath();
        cache.strokePath = p;
      } else {
        cache.strokePath = sketchStrokePath2D([diamondLoop(el)], el.roughness, seedOf(el.id));
      }
    }
    applyDash(ctx, el, el.strokeWidth);
    ctx.stroke(cache.strokePath);
    ctx.restore();
  } else if (el.type === "ellipse") {
    const rx = Math.abs(el.width) / 2;
    const ry = Math.abs(el.height) / 2;
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    if (el.fillStyle !== "hachure" && el.fillStyle !== "cross-hachure") {
      if (el.fillOpacity > 0) {
        ctx.save();
        ctx.globalAlpha *= el.fillOpacity;
        if (!cache.fillPath) {
          const p = new Path2D();
          p.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          cache.fillPath = p;
        }
        ctx.fill(cache.fillPath);
        ctx.restore();
      }
    } else {
      drawHachureFill(ctx, el, colors, el.fillStyle === "cross-hachure");
    }
    ctx.save();
    ctx.globalAlpha *= el.strokeOpacity;
    if (!cache.strokePath) {
      if (el.roughness === 0) {
        const p = new Path2D();
        p.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        cache.strokePath = p;
      } else {
        cache.strokePath = sketchStrokePath2D(
          [ellipseLoop(el.x, el.y, el.width, el.height)],
          el.roughness,
          seedOf(el.id),
        );
      }
    }
    applyDash(ctx, el, el.strokeWidth);
    ctx.stroke(cache.strokePath);
    ctx.restore();
  } else if (el.type === "line") {
    const a = arrowPoints(el)[0];
    const tip = edgeTip(el);
    const lineType = el.lineType ?? "straight";

    ctx.save();
    ctx.globalAlpha *= el.strokeOpacity;
    if (!cache.strokePath) {
      if (lineType === "straight") {
        if (el.strokeStyle === "solid" && el.roughness > 0) {
          cache.strokePath = sketchStrokePath2D([[a, tip]], el.roughness, seedOf(el.id));
        } else {
          const p = new Path2D();
          p.moveTo(a.x, a.y);
          p.lineTo(tip.x, tip.y);
          cache.strokePath = p;
        }
      } else if (lineType === "curved") {
        const cp = curvedArrowControl(el, a, tip);
        const p = new Path2D();
        p.moveTo(a.x, a.y);
        p.quadraticCurveTo(cp.x, cp.y, tip.x, tip.y);
        cache.strokePath = p;
      } else {
        const pts = edgePathPoints(el);
        if (el.strokeStyle === "solid" && el.roughness > 0) {
          cache.strokePath = sketchStrokePath2D([pts], el.roughness, seedOf(el.id));
        } else {
          const p = new Path2D();
          p.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) p.lineTo(pts[i].x, pts[i].y);
          cache.strokePath = p;
        }
      }
    }
    applyDash(ctx, el, el.strokeWidth);
    ctx.stroke(cache.strokePath);
    ctx.restore();
  } else if (el.type === "arrow") {
    const a = arrowPoints(el)[0];
    const tip = edgeTip(el);
    const lineType = el.lineType ?? "straight";
    const headSize = Math.max(12, el.strokeWidth * 4) * 1.2;
    const headSeed = seedOf(el.id) + 7;
    const headColor = resolveStroke(el, colors);
    const startType = el.startArrowhead ?? "none";
    const endType = el.endArrowhead ?? "arrow";

    ctx.save();
    ctx.globalAlpha *= el.strokeOpacity;
    if (!cache.strokePath) {
      if (lineType === "straight") {
        if (el.strokeStyle === "solid" && el.roughness > 0) {
          cache.strokePath = sketchStrokePath2D([[a, tip]], el.roughness, seedOf(el.id), 1, false, true);
        } else {
          const p = new Path2D();
          p.moveTo(a.x, a.y);
          p.lineTo(tip.x, tip.y);
          cache.strokePath = p;
        }
      } else if (lineType === "curved") {
        const cp = curvedArrowControl(el, a, tip);
        const p = new Path2D();
        p.moveTo(a.x, a.y);
        p.quadraticCurveTo(cp.x, cp.y, tip.x, tip.y);
        cache.strokePath = p;
      } else {
        const pts = edgePathPoints(el);
        if (el.strokeStyle === "solid" && el.roughness > 0) {
          cache.strokePath = sketchStrokePath2D([pts], el.roughness, seedOf(el.id), 1, false, true);
        } else {
          const p = new Path2D();
          p.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) p.lineTo(pts[i].x, pts[i].y);
          cache.strokePath = p;
        }
      }
    }
    applyDash(ctx, el, el.strokeWidth, animationPhase, !!el.animated);
    ctx.stroke(cache.strokePath);
    if (lineType === "straight") {
      drawArrowHead(ctx, tip, a, headSize, headColor, el.roughness, headSeed, endType);
      drawArrowHead(ctx, a, tip, headSize, headColor, el.roughness, headSeed + 3, startType);
    } else if (lineType === "curved") {
      const cp = curvedArrowControl(el, a, tip);
      drawArrowHead(ctx, tip, cp, headSize, headColor, el.roughness, headSeed, endType);
      drawArrowHead(ctx, a, cp, headSize, headColor, el.roughness, headSeed + 3, startType);
    } else {
      const pts = edgePathPoints(el);
      const prevPt = pts.length >= 2 ? pts[pts.length - 2] : a;
      drawArrowHead(ctx, tip, prevPt, headSize, headColor, el.roughness, headSeed, endType);
      const nextPt = pts.length >= 2 ? pts[1] : tip;
      drawArrowHead(ctx, a, nextPt, headSize, headColor, el.roughness, headSeed + 3, startType);
    }
    ctx.restore();
  } else if (el.type === "text") {
    ctx.save();
    ctx.globalAlpha *= el.opacity;
    ctx.fillStyle = resolveTextColor(el, colors);
    ctx.font = resolveFont(el);
    ctx.textBaseline = "top";
    const lh = lineHeight(el);
    if (!cache.textLayout) {
      const lines = el.text.split("\n");
      const lineWidths = lines.map((l) => ctx.measureText(l).width);
      const maxWidth = Math.max(...lineWidths, 1);
      cache.textLayout = { lines, lineWidths, maxWidth };
    }
    const { lines, lineWidths } = cache.textLayout;
    const align = el.textAlign ?? "left";
    ctx.textAlign = align;
    const n = lines.length;
    const textBlockH = textBlockHeight(el.fontSize, n, lh);
    const vOffset = Math.max(0, (el.height - textBlockH) / 2);
    const underlineOn = !!el.underline;
    lines.forEach((line, i) => {
      let lx = el.x;
      if (align === "center") lx = el.x + el.width / 2;
      else if (align === "right") lx = el.x + el.width;
      const lineY = el.y + vOffset + i * el.fontSize * lh;
      ctx.fillText(line, lx, lineY);
      if (underlineOn && line.length > 0) {
        const lw = lineWidths[i];
        if (lw > 0) {
          let ux = el.x;
          if (align === "center") ux = el.x + (el.width - lw) / 2;
          else if (align === "right") ux = el.x + el.width - lw;
          ctx.strokeStyle = resolveTextColor(el, colors);
          ctx.lineWidth = Math.max(2, el.fontSize * 0.07);
          ctx.beginPath();
          ctx.moveTo(ux, lineY + el.fontSize);
          ctx.lineTo(ux + lw, lineY + el.fontSize);
          ctx.stroke();
        }
      }
    });
    ctx.restore();
  }
  ctx.restore();
}

/** screen px radius of the details badge */
export const BADGE_RADIUS_PX = 7;
/** diagonal inset (screen px) of the badge from the element corner */
const BADGE_INSET_PX = 12;
/** screen px tolerance around the badge for hover/right-click hit */
export const BADGE_HIT_PAD_PX = 4;
/** screen px gap between edge labels and the badge placed below them */
const BADGE_BELOW_GAP_PX = 4;

/** vertical half-height of the edge label text block (scene units) */
function edgeLabelHalfHeight(el: LineElement | ArrowElement): number {
  const fontSize = el.fontSize ?? 20;
  const lines = (el.label ?? "").split("\n");
  const n = Math.max(1, lines.length);
  const step = fontSize * lineHeight(el);
  const v = el.textVAlign ?? "middle";
  if (v === "top") return (n - 1) * step + fontSize / 2;
  if (v === "bottom") return fontSize / 2;
  return ((n - 1) * step) / 2 + fontSize / 2;
}

/**
 * scene position of the details badge ("i") for an element that has details.
 * shapes/text/components: bottom-right corner, offset diagonally inward so it
 * clears the `se` resize handle. lines/arrows: over the path — centered on it
 * when there is no label, or right below the label text when there is one
 * (follows the label handle, which moves the text along the stroke via labelT).
 * Returns null when the element has no details.
 */
export function detailsBadgeAnchor(el: Element, zoom: number): Point | null {
  if (!el.details || el.details.trim() === "") return null;
  if (el.type === "line" || el.type === "arrow") {
    if (el.label) {
      const anchor = edgeLabelAnchor(el)!;
      const below =
        edgeLabelHalfHeight(el) +
        BADGE_BELOW_GAP_PX / zoom +
        BADGE_RADIUS_PX / zoom;
      return { x: anchor.x, y: anchor.y + below };
    }
    return edgePointAt(el, 0.5);
  }
  const b = elementBounds(el);
  const inset = BADGE_INSET_PX / zoom;
  return toScenePoint(el, { x: b.x2 - inset, y: b.y2 - inset });
}

/** information icon (circle with a dotted "i") in the given color */
function drawInfoIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, 1.4 * (r / 7));
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  // dot of the "i"
  ctx.beginPath();
  ctx.arc(x, y - r * 0.3, r * 0.13, 0, Math.PI * 2);
  ctx.fill();
  // stem of the "i"
  const stemW = r * 0.2;
  ctx.beginPath();
  ctx.roundRect(x - stemW / 2, y - r * 0.05, stemW, r * 0.52, stemW / 2);
  ctx.fill();
  ctx.restore();
}

/** discrete "i" indicator over elements that carry additional information */
function drawDetailsBadge(
  ctx: CanvasRenderingContext2D,
  el: Element,
  zoom: number,
  colors: RenderColors,
) {
  const a = detailsBadgeAnchor(el, zoom);
  if (!a) return;
  const r = BADGE_RADIUS_PX / zoom;
  ctx.save();
  ctx.globalAlpha = 1;
  // plate in the live canvas background keeps the icon readable over any fill
  ctx.fillStyle = colors.canvasBg || DEFAULT_COLORS.canvasBg;
  ctx.beginPath();
  ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
  ctx.fill();
  drawInfoIcon(ctx, a.x, a.y, r, colors.muted || DEFAULT_COLORS.muted);
  ctx.restore();
}

function drawLockBadge(
  ctx: CanvasRenderingContext2D,
  el: Element,
  zoom: number,
  colors: RenderColors,
  cam: Camera,
) {
  if (!el.locked) return;
  const b = elementBounds(el);
  const corner = toScenePoint(el, {
    x: b.x1 + BADGE_INSET_PX / zoom,
    y: b.y1 + BADGE_INSET_PX / zoom,
  });
  const screenX = corner.x * cam.zoom + cam.scrollX;
  const screenY = corner.y * cam.zoom + cam.scrollY;
  const r = BADGE_RADIUS_PX;
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.canvasBg || DEFAULT_COLORS.canvasBg;
  ctx.beginPath();
  ctx.arc(screenX, screenY, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = colors.muted || DEFAULT_COLORS.muted;
  ctx.lineWidth = Math.max(1, 1.4 * (r / 7));
  const sw = ctx.lineWidth;
  const bw = r * 0.7;
  const bh = r * 0.55;
  ctx.beginPath();
  ctx.arc(screenX, screenY - bh * 0.15, bw, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(screenX - bw, screenY - bh * 0.15, bw * 2, bh * 1.3, sw * 0.4);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function elementVisualBounds(ctx: CanvasRenderingContext2D, el: Element): Bounds {
  const root = translatedOrigin.get(el);
  if (root) {
    const vb = elementVisualBounds(ctx, root);
    const dx = el.x - root.x;
    const dy = el.y - root.y;
    return { x1: vb.x1 + dx, y1: vb.y1 + dy, x2: vb.x2 + dx, y2: vb.y2 + dy };
  }
  const cache = getElementCache(el);
  if (cache.visualBounds) return cache.visualBounds;

  const eb = elementBounds(el);
  let x1 = eb.x1;
  let y1 = eb.y1;
  let x2 = eb.x2;
  let y2 = eb.y2;

  // component labels live OUTSIDE the element and do NOT expand the
  // selection, so the selection box/handles/group bounds must cover only the
  // icon/pixels — not the caption text. Only free-form shapes clip text.
  if ("label" in el && el.label && el.type !== "component") {
    const fontSize = el.fontSize ?? 20;
    ctx.font = resolveFont(el, fontSize);
    const lines = el.label.split("\n");
    const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const lh = lineHeight(el);
    const th =
      lines.length === 1
        ? fontSize * 1.25
        : (lines.length - 1) * fontSize * lh + fontSize;
    const textAlign = el.textAlign ?? "center";
    const textVAlign = el.textVAlign ?? "middle";
    const { padX: pad, padY } = textOffsets(el);
    let lx: number;
    let ly: number;
    if (textAlign === "left") lx = el.x + pad;
    else if (textAlign === "right") lx = el.x + el.width - pad - tw;
    else lx = el.x + (el.width - tw) / 2;
    if (textVAlign === "top") ly = el.y + padY;
    else if (textVAlign === "bottom") ly = el.y + el.height - padY - th;
    else ly = el.y + (el.height - th) / 2;
    // clip the text rect to the element bounds: text fully contained must NOT expand them
    const tx1 = Math.min(Math.max(lx, x1), x2);
    const ty1 = Math.min(Math.max(ly, y1), y2);
    const tx2 = Math.max(tx1, Math.min(lx + tw, x2));
    const ty2 = Math.max(ty1, Math.min(ly + th, y2));
    x1 = Math.min(x1, tx1);
    y1 = Math.min(y1, ty1);
    x2 = Math.max(x2, tx2);
    y2 = Math.max(y2, ty2);
  }

  // component: the icon may be smaller than the element bounds (shrinks when
  // a label is present, or element is non-square); raster images (fill) cover
  // the full bounds. Selection box must wrap only the visible icon/pixels.
  if (el.type === "component") {
    const layout = componentIconLayout(el);
    x1 = layout.iconX;
    y1 = layout.iconY;
    x2 = layout.iconX + layout.iconWidth;
    y2 = layout.iconY + layout.iconHeight;
  }

  const vb = { x1, y1, x2, y2 };
  cache.visualBounds = vb;
  return vb;
}

function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  el: Element,
  zoom: number,
  color: string,
) {
  // arrows/lines: highlight the line itself instead of a misleading bbox rectangle
  if (el.type === "arrow" || el.type === "line") {
    const lineType = el.lineType ?? "straight";
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = el.strokeWidth + 4 / zoom;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (lineType === "curved") {
      const [a, b] = arrowPoints(el);
      const tip = { x: b.x, y: b.y === a.y ? b.y + 1 : b.y };
      const cp = curvedArrowControl(el, a, tip);
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(cp.x, cp.y, tip.x, tip.y);
    } else {
      const pts = edgePathPoints(el);
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
    }
    ctx.stroke();
    ctx.restore();
    return;
  }
  const b = elementVisualBounds(ctx, el);
  const pad = 3 / zoom;
  const padded: Bounds = {
    x1: b.x1 - pad,
    y1: b.y1 - pad,
    x2: b.x2 + pad,
    y2: b.y2 + pad,
  };
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.75, 1 / zoom);
  ctx.setLineDash([3 / zoom, 4 / zoom]);
  if (elementAngle(el) === 0) {
    ctx.strokeRect(
      padded.x1,
      padded.y1,
      padded.x2 - padded.x1,
      padded.y2 - padded.y1,
    );
  } else {
    // rotated: outline follows the rotated box, not the axis-aligned one
    const corners = elementCorners(el, padded);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

const RESIZABLE_TYPES = new Set<string>([
  "rectangle",
  "diamond",
  "ellipse",
  "line",
  "arrow",
  "component",
  "text",
  "context",
]);

function drawGroupHandles(
  ctx: CanvasRenderingContext2D,
  b: Bounds,
  zoom: number,
  color: string,
) {
  const s = HANDLE_SIZE / zoom;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.75, 1 / zoom);
  ctx.setLineDash([3 / zoom, 4 / zoom]);
  ctx.strokeRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
  ctx.setLineDash([]);
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 1 / zoom;
  const centers = [
    { x: b.x1, y: b.y1 },
    { x: (b.x1 + b.x2) / 2, y: b.y1 },
    { x: b.x2, y: b.y1 },
    { x: b.x2, y: (b.y1 + b.y2) / 2 },
    { x: b.x2, y: b.y2 },
    { x: (b.x1 + b.x2) / 2, y: b.y2 },
    { x: b.x1, y: b.y2 },
    { x: b.x1, y: (b.y1 + b.y2) / 2 },
  ];
  for (const p of centers) {
    ctx.beginPath();
    ctx.rect(p.x - s / 2, p.y - s / 2, s, s);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawLabel(ctx: CanvasRenderingContext2D, el: Element, colors: RenderColors) {
  if (el.type === "text" || !el.label) return;
  const root = translatedOrigin.get(el);
  if (root) {
    ctx.save();
    ctx.translate(el.x - root.x, el.y - root.y);
    drawLabel(ctx, root, colors);
    ctx.restore();
    return;
  }
  const cache = getElementCache(el);
  ctx.save();
  applyRotation(ctx, el);
  ctx.globalAlpha *= el.opacity;
  ctx.fillStyle = resolveTextColor(el, colors);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const underlineOn = !!el.underline;
  if (el.type === "component") {
    const layout = componentIconLayout(el);
    ctx.font = resolveFont(el, layout.labelFont);
    const fs = layout.labelFont;
    const lh = lineHeight(el);
    if (!cache.textLayout) {
      const lines = el.label.split("\n");
      const lineWidths = lines.map((l) => ctx.measureText(l).width);
      const maxWidth = Math.max(...lineWidths, 1);
      cache.textLayout = { lines, lineWidths, maxWidth };
    }
    const { lines, lineWidths } = cache.textLayout;
    const step = fs * lh;
    const vShift = ((lines.length - 1) * step) / 2;
    ctx.fillText(lines[0], layout.labelCx, layout.labelCy - vShift);
    for (let i = 1; i < lines.length; i++) {
      ctx.fillText(lines[i], layout.labelCx, layout.labelCy + i * step - vShift);
    }
    if (underlineOn) {
      let maxLw = 0;
      let bestY = layout.labelCy;
      lines.forEach((_line, i) => {
        const lw = lineWidths[i];
        if (lw > maxLw) {
          maxLw = lw;
          bestY = layout.labelCy + i * step - vShift;
        }
      });
      if (maxLw > 0) {
        ctx.strokeStyle = resolveTextColor(el, colors);
        ctx.lineWidth = Math.max(1.5, fs * 0.07);
        ctx.beginPath();
        const uy = bestY + fs * 0.55;
        ctx.moveTo(layout.labelCx - maxLw / 2, uy);
        ctx.lineTo(layout.labelCx + maxLw / 2, uy);
        ctx.stroke();
      }
    }
  } else if (el.type === "context") {
    const ctxEl = el as ContextElement;
    const pos = ctxEl.labelPosition ?? "top-left";
    const side = ctxEl.labelSide ?? "external";
    const isTop = pos === "top-left" || pos === "top-right";
    const isLeft = pos === "top-left" || pos === "bottom-left";
    const fontSize = ctxEl.fontSize ?? 16;
    ctx.font = resolveFont(ctxEl, fontSize);
    const lh = lineHeight(ctxEl);
    if (!cache.textLayout) {
      const lines = el.label.split("\n");
      cache.textLayout = { lines, lineWidths: [], maxWidth: 0 };
    }
    const { lines } = cache.textLayout;
    const step = fontSize * lh;
    const base = ctxEl.textOffsetGlobal ?? 8;
    const distH = base + (isLeft ? (ctxEl.textOffsetLeft ?? 0) : (ctxEl.textOffsetRight ?? 0));
    const distV = base + (isTop ? (ctxEl.textOffsetTop ?? 0) : (ctxEl.textOffsetBottom ?? 0));
    const hOff = isLeft ? (ctxEl.textOffsetLeft ?? 0) : (ctxEl.textOffsetRight ?? 0);
    const blockCenter = ((lines.length - 1) * step) / 2;
    const blockH = (lines.length - 1) * step + fontSize;
    let cx: number;
    let cy: number;
    if (side === "internal") {
      // inside the bounds, anchored to the corner with a small inset
      ctx.textAlign = isLeft ? "left" : "right";
      cx = isLeft ? el.x + distH : el.x + el.width - distH;
      cy = isTop
        ? el.y + distV + fontSize / 2
        : el.y + el.height - distV - blockH + fontSize / 2;
    } else {
      // external: flush with the border horizontally, clear of it vertically
      ctx.textAlign = isLeft ? "left" : "right";
      cx = isLeft ? el.x + hOff : el.x + el.width - hOff;
      cy = isTop
        ? el.y - distV - blockCenter
        : el.y + el.height + distV + blockCenter;
    }
    const drawCtxLine = (line: string, i: number) => {
      ctx.fillText(line, cx, cy + i * step);
    };
    lines.forEach(drawCtxLine);
  } else {
    const textAlign = el.textAlign ?? "center";
    const textVAlign = el.textVAlign ?? "middle";
    ctx.textAlign = textAlign;
    let cx: number;
    let cy: number;
    if (el.type === "line" || el.type === "arrow") {
      const anchor = edgeLabelAnchor(el)!;
      cx = anchor.x;
      cy = anchor.y;
    } else {
      const { padX: pad, padY } = textOffsets(el);
      if (textAlign === "left") cx = el.x + pad;
      else if (textAlign === "right") cx = el.x + el.width - pad;
      else cx = el.x + el.width / 2;
      if (textVAlign === "top") cy = el.y + padY;
      else if (textVAlign === "bottom") cy = el.y + el.height - padY;
      else cy = el.y + el.height / 2;
    }
    const fontSize = el.fontSize ?? 20;
    ctx.font = resolveFont(el, fontSize);
    const lh = lineHeight(el);
    if (!cache.textLayout) {
      const lines = el.label.split("\n");
      const lineWidths = lines.map((l) => ctx.measureText(l).width);
      const maxWidth = Math.max(...lineWidths, 1);
      cache.textLayout = { lines, lineWidths, maxWidth };
    }
    const { lines, lineWidths, maxWidth } = cache.textLayout;
    const step = fontSize * lh;
    if (el.type === "line" || el.type === "arrow") {
      const pad = Math.max(2, fontSize * 0.3);
      const tw = maxWidth;
      const bh = textBlockHeight(fontSize, lines.length, lh);
      const blockCy =
        textVAlign === "top"
          ? cy + ((lines.length - 1) * step) / 2
          : textVAlign === "bottom"
            ? cy - ((lines.length - 1) * step) / 2
            : cy;
      const bx =
        textAlign === "left" ? cx : textAlign === "right" ? cx - tw : cx - tw / 2;
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = colors.canvasBg || DEFAULT_COLORS.canvasBg;
      ctx.fillRect(bx - pad, blockCy - bh / 2 - pad, tw + pad * 2, bh + pad * 2);
      ctx.restore();
    }
    const drawLine = (line: string, i: number) => {
      let ly: number;
      if (textVAlign === "top") ly = cy + i * step;
      else if (textVAlign === "bottom") ly = cy + (i - (lines.length - 1)) * step;
      else ly = cy + i * step - ((lines.length - 1) * step) / 2;
      ctx.fillText(line, cx, ly);
      if (underlineOn) {
        const lw = lineWidths[i];
        if (lw > 0) {
          ctx.strokeStyle = resolveTextColor(el, colors);
          ctx.lineWidth = Math.max(1.5, fontSize * 0.07);
          ctx.beginPath();
          const uy = ly + fontSize * 0.55;
          let ux = cx;
          if (textAlign === "left") ux = cx;
          else if (textAlign === "right") ux = cx - lw;
          else ux = cx - lw / 2;
          ctx.moveTo(ux, uy);
          ctx.lineTo(ux + lw, uy);
          ctx.stroke();
        }
      }
    };
    lines.forEach(drawLine);
  }
  ctx.restore();
}

const HANDLE_SIZE = 7; // screen px

/** screen px between the top edge and the rotate grip */
export const ROTATE_HANDLE_GAP_PX = 18;

function drawHandles(
  ctx: CanvasRenderingContext2D,
  el: Element,
  zoom: number,
  color: string,
) {
  const b = elementVisualBounds(ctx, el);
  const cx = (b.x1 + b.x2) / 2;
  const cy = (b.y1 + b.y2) / 2;
  // arrows/lines expose only their two endpoints; width/height are signed,
  // so the endpoints are (x,y) and (x+width,y+height), not fixed bbox corners
  const localPoints: Point[] =
    el.type === "arrow" || el.type === "line"
      ? arrowPoints(el)
      : [
          { x: b.x1, y: b.y1 },
          { x: cx, y: b.y1 },
          { x: b.x2, y: b.y1 },
          { x: b.x2, y: cy },
          { x: b.x2, y: b.y2 },
          { x: cx, y: b.y2 },
          { x: b.x1, y: b.y2 },
          { x: b.x1, y: cy },
        ];
  // the element's rotation pivot is its own box center, so the visual-box
  // handles are rotated around that same center
  const points = localPoints.map((p) => toScenePoint(el, p));
  const s = HANDLE_SIZE / zoom;
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1 / zoom;

  // rotate grip: connector from the top-center handle up to a circle
  if (isRotatable(el)) {
    const topCenter = toScenePoint(el, { x: cx, y: b.y1 });
    const grip = toScenePoint(el, {
      x: cx,
      y: b.y1 - ROTATE_HANDLE_GAP_PX / zoom,
    });
    ctx.beginPath();
    ctx.moveTo(topCenter.x, topCenter.y);
    ctx.lineTo(grip.x, grip.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(grip.x, grip.y, s / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  for (const p of points) {
    ctx.beginPath();
    ctx.rect(p.x - s / 2, p.y - s / 2, s, s);
    ctx.fill();
    ctx.stroke();
  }
  // circular handle for dragging the label along a line/arrow stroke
  if (el.type === "line" || el.type === "arrow") {
    const anchor = edgeLabelAnchor(el);
    if (anchor && el.label) {
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, s / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // control point handle for curved mode
    const lineType = el.lineType ?? "straight";
    if (lineType === "curved") {
      const [a, b] = arrowPoints(el);
      const tip = { x: b.x, y: b.y === a.y ? b.y + 1 : b.y };
      const cp = curvedArrowControl(el, a, tip);
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, s / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // thin line from midpoint of chord to control point
      const mx = (a.x + tip.x) / 2;
      const my = (a.y + tip.y) / 2;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(cp.x, cp.y);
      ctx.stroke();
    }

  }
  ctx.restore();
}

function drawGuides(
  ctx: CanvasRenderingContext2D,
  guides: { orientation: "h" | "v"; pos: number }[],
  cam: Camera,
  w: number,
  h: number,
) {
  if (guides.length === 0) return;
  const vx1 = -cam.scrollX / cam.zoom;
  const vy1 = -cam.scrollY / cam.zoom;
  const vx2 = vx1 + w / cam.zoom;
  const vy2 = vy1 + h / cam.zoom;

  ctx.save();
  ctx.strokeStyle = "#e03131";
  ctx.lineWidth = 1 / cam.zoom;
  ctx.beginPath();
  for (const g of guides) {
    if (g.orientation === "v") {
      ctx.moveTo(g.pos, vy1);
      ctx.lineTo(g.pos, vy2);
    } else {
      ctx.moveTo(vx1, g.pos);
      ctx.lineTo(vx2, g.pos);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** halo around a shape offered/accepted as a binding target */
function drawBindingHighlight(
  ctx: CanvasRenderingContext2D,
  el: Element,
  zoom: number,
  color: string,
) {
  const b = elementBounds(el);
  const pad = 4 / zoom;
  ctx.save();
  applyRotation(ctx, el);
  ctx.globalAlpha = 1;
  ctx.fillStyle = color + "1a";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5 / zoom;
  ctx.beginPath();
  ctx.rect(
    b.x1 - pad,
    b.y1 - pad,
    b.x2 - b.x1 + pad * 2,
    b.y2 - b.y1 + pad * 2,
  );
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** draws the highlight of each binding target plus a dot on the outline */
function drawBindingPreview(
  ctx: CanvasRenderingContext2D,
  preview: { start: ArrowBinding | null; end: ArrowBinding | null },
  doc: Document,
  zoom: number,
  color: string,
) {
  const byId = new Map(doc.elements.map((el) => [el.id, el] as const));
  for (const binding of [preview.start, preview.end]) {
    if (!binding) continue;
    const target = byId.get(binding.elementId);
    if (!target) continue;
    drawBindingHighlight(ctx, target, zoom, color);
    const ap = bindingPoint(target, binding);
    const r = 5 / zoom;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.arc(ap.x, ap.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

/** draws a focus ring around a context being hovered as a drop target */
function drawContextHighlight(
  ctx: CanvasRenderingContext2D,
  el: ContextElement,
  zoom: number,
  color: string,
) {
  const b = elementBounds(el);
  const w = b.x2 - b.x1;
  const h = b.y2 - b.y1;
  const r = cornerRadius(el);
  ctx.save();
  applyRotation(ctx, el);

  // emphasize the existing background
  ctx.fillStyle = color + "22";
  ctx.beginPath();
  ctx.roundRect(b.x1, b.y1, w, h, r);
  ctx.fill();

  // re-trace the context's own outline (same geometry, no new ring) so the
  // existing border itself is highlighted, thickened in the selection color
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2.5, el.strokeWidth * 2.5) / zoom;
  ctx.beginPath();
  ctx.roundRect(b.x1, b.y1, w, h, r);
  ctx.stroke();

  ctx.restore();
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  canvasWidth: number,
  canvasHeight: number,
) {
  const { camera: cam } = state;
  const colors = state.colors ?? DEFAULT_COLORS;
  ctx.save();
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // scene transform (applied first so grid + elements share the same space)
  ctx.translate(cam.scrollX, cam.scrollY);
  ctx.scale(cam.zoom, cam.zoom);

  // grid in scene coordinates – scales naturally with zoom
  if (state.gridMode === "dots" || state.gridMode === "lines") {
    const scale = ctx.getTransform().a;
    const entry =
      state.gridMode === "dots"
        ? getGridDotPattern(ctx, colors.gridDot, scale)
        : getGridLinePattern(ctx, colors.gridLine, colors.gridLineMaster, scale);
    fillDeviceGrid(ctx, entry, cam, canvasWidth, canvasHeight);
  }

  const cullPadding = 80 / Math.min(cam.zoom, 1);
  const viewX1 = -cam.scrollX / cam.zoom - cullPadding;
  const viewY1 = -cam.scrollY / cam.zoom - cullPadding;
  const viewX2 = (-cam.scrollX + canvasWidth) / cam.zoom + cullPadding;
  const viewY2 = (-cam.scrollY + canvasHeight) / cam.zoom + cullPadding;

  const visibleElements: Element[] = [];
  let hasContext = false;
  for (const el of state.doc.elements) {
    const cb = elementAngle(el) === 0 ? getCachedBounds(el) : rotatedBounds(el);
    if (cb.x2 < viewX1 || cb.x1 > viewX2 || cb.y2 < viewY1 || cb.y1 > viewY2) {
      continue;
    }
    if (el.type === "context") hasContext = true;
    visibleElements.push(el);
  }

  if (hasContext) {
    visibleElements.sort((a, b) => {
      if (a.type === "context" && b.type !== "context") {
        const ctxEl = a as ContextElement;
        if (getContextChildSet(ctxEl).has(b.id)) return -1;
        if (state.selectedIds?.has(b.id) && !state.selectedIds?.has(a.id)) return -1;
      } else if (b.type === "context" && a.type !== "context") {
        const ctxEl = b as ContextElement;
        if (getContextChildSet(ctxEl).has(a.id)) return 1;
        if (state.selectedIds?.has(a.id) && !state.selectedIds?.has(b.id)) return 1;
      }
      return 0;
    });
  }

  for (const el of visibleElements) {
    const isEditingThisLabel =
      !!state.hiddenLabelId && el.id === state.hiddenLabelId;
    const dim =
      Boolean(state.highlightedIds && state.highlightedIds.size > 0 && !state.highlightedIds.has(el.id));
    if (dim) {
      ctx.save();
      ctx.globalAlpha = 0.15;
    }
    drawElement(ctx, el, colors, state.animationPhase ?? 0);
    if (
      state.highlightedContextId &&
      el.id === state.highlightedContextId &&
      el.type === "context"
    ) {
      drawContextHighlight(ctx, el as ContextElement, cam.zoom, colors.selection);
    }
    drawLabel(ctx, el, colors);
    if (dim) {
      ctx.restore();
    }
    drawDetailsBadge(ctx, el, cam.zoom, colors);
    drawLockBadge(ctx, el, cam.zoom, colors, cam);
    if (
      state.selectedIds.size === 1 &&
      state.selectedIds.has(el.id) &&
      !isEditingThisLabel
    )
      drawSelectionBox(ctx, el, cam.zoom, colors.selection);
  }

  // resize handles for single selection of a shape/arrow/text
  if (!state.draft && state.selectedIds.size === 1) {
    const sel = state.doc.elements.find((el) => state.selectedIds.has(el.id));
    if (
      sel &&
      !sel.locked &&
      (sel.type === "rectangle" ||
        sel.type === "diamond" ||
        sel.type === "ellipse" ||
        sel.type === "line" ||
        sel.type === "arrow" ||
        sel.type === "component" ||
        sel.type === "text" ||
        sel.type === "context") &&
      !(state.hiddenLabelId && sel.id === state.hiddenLabelId) &&
      !(state.hiddenTextId && sel.id === state.hiddenTextId)
    ) {
      drawHandles(ctx, sel, cam.zoom, colors.selection);
    }
  }

  // resize handles spanning the whole multi-selection
  if (!state.draft && state.selectedIds.size > 1) {
    const members = state.doc.elements
      .filter((el) => state.selectedIds.has(el.id))
      .filter((el) => !el.locked && RESIZABLE_TYPES.has(el.type));
    if (members.length > 0) {
      const gb = unionBounds(members);
      if (gb) drawGroupHandles(ctx, gb, cam.zoom, colors.selection);
    }
  }

  if (state.guides && state.camera) {
    drawGuides(ctx, state.guides, cam, canvasWidth, canvasHeight);
  }

  if (state.draft) {
    drawElement(ctx, state.draft, colors, state.animationPhase ?? 0);
    drawLabel(ctx, state.draft, colors);
    drawSelectionBox(ctx, state.draft, cam.zoom, colors.selection);
  }

  if (state.bindingPreview) {
    drawBindingPreview(
      ctx,
      state.bindingPreview,
      state.doc,
      cam.zoom,
      colors.selection,
    );
  }

  if (state.marquee) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.selection + "14";
    ctx.strokeStyle = colors.selection;
    ctx.lineWidth = 1 / cam.zoom;
    const { x1, y1, x2, y2 } = state.marquee;
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    ctx.fillRect(x, y, Math.abs(x2 - x1), Math.abs(y2 - y1));
    ctx.strokeRect(x, y, Math.abs(x2 - x1), Math.abs(y2 - y1));
    ctx.restore();
  }

  ctx.restore();
}
