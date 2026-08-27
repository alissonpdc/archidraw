import type { Bounds, Camera, ComponentElement, Document, Element, Point } from "./types";
import { arrowPoints, elementBounds, measureText } from "./utils";
import { getLibraryItem } from "./library";
import { getComponentImage } from "./componentAssets";
import { resolveFont, resolveTextColor, lineHeight } from "./textStyle";

export interface RenderColors {
  selection: string;
  gridDot: string;
  gridLine: string;
  /** theme-appropriate stroke for elements using the default color */
  elementStroke: string;
}

export interface RenderState {
  doc: Document;
  camera: Camera;
  selectedIds: ReadonlySet<string>;
  /** in-progress creation draft (scene coords, already normalized) */
  draft: Element | null;
  marquee: { x1: number; y1: number; x2: number; y2: number } | null;
  colors?: RenderColors;
  gridMode?: "none" | "dots" | "lines";
  guides?: { orientation: "h" | "v"; pos: number }[] | null;
  /** element whose label is being edited (hidden to avoid double rendering) */
  hiddenLabelId?: string | null;
  /** free text element being edited (hidden to avoid double rendering) */
  hiddenTextId?: string | null;
}

/** default stroke colors that adapt to the active theme at render time */
const AUTO_STROKES = new Set(["#1e1e1e", "#e8e8e8"]);

const DEFAULT_COLORS: RenderColors = {
  selection: "#6965db",
  elementStroke: "#1e1e1e",
  gridDot: "rgba(0,0,0,0.14)",
  gridLine: "rgba(0,0,0,0.07)",
};

function visibleSceneRect(cam: Camera, w: number, h: number) {
  const vx1 = -cam.scrollX / cam.zoom;
  const vy1 = -cam.scrollY / cam.zoom;
  return { vx1, vy1, vx2: vx1 + w / cam.zoom, vy2: vy1 + h / cam.zoom };
}

function gridStep(cam: Camera): number {
  let step = 20;
  while (step * cam.zoom < 14) step *= 2;
  while (step * cam.zoom > 56) step /= 2;
  return step;
}

function drawGridDots(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  w: number,
  h: number,
  color: string,
) {
  const { vx1, vy1, vx2, vy2 } = visibleSceneRect(cam, w, h);
  const step = gridStep(cam);
  const r = Math.max(1, 1.3 / cam.zoom);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let x = Math.floor(vx1 / step) * step; x <= vx2; x += step) {
    for (let y = Math.floor(vy1 / step) * step; y <= vy2; y += step) {
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
  }
  ctx.fill();
  ctx.restore();
}

function drawGridLines(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  w: number,
  h: number,
  color: string,
) {
  const { vx1, vy1, vx2, vy2 } = visibleSceneRect(cam, w, h);
  const step = gridStep(cam);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1 / cam.zoom, 0.5);
  ctx.beginPath();
  for (let x = Math.floor(vx1 / step) * step; x <= vx2; x += step) {
    ctx.moveTo(x, vy1);
    ctx.lineTo(x, vy2);
  }
  for (let y = Math.floor(vy1 / step) * step; y <= vy2; y += step) {
    ctx.moveTo(vx1, y);
    ctx.lineTo(vx2, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  tip: Point,
  tail: Point,
  size: number,
) {
  const angle = Math.atan2(tip.y - tail.y, tip.x - tail.x);
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(
    tip.x - size * Math.cos(angle - Math.PI / 6),
    tip.y - size * Math.sin(angle - Math.PI / 6),
  );
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(
    tip.x - size * Math.cos(angle + Math.PI / 6),
    tip.y - size * Math.sin(angle + Math.PI / 6),
  );
  ctx.stroke();
}

/** resolves the element stroke, adapting default colors to the theme */
function resolveStroke(el: Element, colors: RenderColors): string {
  return AUTO_STROKES.has(el.strokeColor) ? colors.elementStroke : el.strokeColor;
}

/** deterministic pseudo-random in [-1, 1] from integer seed */
function jitter(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/**
 * one hand-drawn pass over a polyline: jittered endpoints + wobbly body.
 * `roughness` scales how sloppy it looks (0 = perfectly straight).
 */
function roughPolyline(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  roughness: number,
  seed: number,
) {
  if (points.length < 2) return;
  let s = seed;
  const jit = (max: number) => jitter(++s) * max;
  const o = roughness * 1.5;
  const last = points.length - 1;

  // cumulative arc length along the polyline
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++)
    cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const total = cum[last];

  // smooth low-frequency wave (smoothstep-interpolated noise anchors):
  // continuous wander along the whole path — no zig-zag, no overlap
  const amp = roughness * Math.min(4, Math.max(0.5, total * 0.012));
  const waveLen = Math.max(18, Math.min(70, total / 3));
  const anchorCount = Math.ceil(total / waveLen) + 2;
  const anchors: number[] = [];
  for (let i = 0; i < anchorCount; i++) anchors.push(jit(1));
  const noiseAt = (d: number) => {
    const f = Math.min(d / waveLen, anchorCount - 2);
    const i0 = Math.floor(f);
    const t = f - i0;
    const sm = t * t * (3 - 2 * t);
    return anchors[i0] * (1 - sm) + anchors[i0 + 1] * sm;
  };

  ctx.moveTo(points[0].x + jit(o), points[0].y + jit(o));
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = cum[i] - cum[i - 1];
    const nx = len > 0 ? -dy / len : 0;
    const ny = len > 0 ? dx / len : 0;
    // dense samplings (arcs) have short segments: damp the wave there so
    // curves stay cleaner than straight runs
    const damp = Math.min(1, Math.max(0.3, len / 10));
    const endJitter = i === last;
    const ex = b.x + (endJitter ? jit(o) : nx * amp * damp * noiseAt(cum[i]));
    const ey = b.y + (endJitter ? jit(o) : ny * amp * damp * noiseAt(cum[i]));
    if (len < 8 || roughness === 0) {
      ctx.lineTo(ex, ey);
      continue;
    }
    // control points ride the same wave, keeping the wobble continuous
    const c1d = cum[i - 1] + len * 0.3;
    const c2d = cum[i - 1] + len * 0.7;
    ctx.bezierCurveTo(
      a.x + dx * 0.3 + nx * amp * damp * noiseAt(c1d),
      a.y + dy * 0.3 + ny * amp * damp * noiseAt(c1d),
      a.x + dx * 0.7 + nx * amp * damp * noiseAt(c2d),
      a.y + dy * 0.7 + ny * amp * damp * noiseAt(c2d),
      ex,
      ey,
    );
  }
}

/**
 * strokes hand-drawn polylines: a single straight pass when clean,
 * two independent offset passes otherwise (sloppy sketch look).
 * endpoints don't meet exactly at corners — that's the point.
 */
function sketchStroke(
  ctx: CanvasRenderingContext2D,
  polylines: Point[][],
  roughness: number,
  seedBase: number,
) {
  const passes = roughness === 0 ? 1 : roughness === 3 ? 3 : 2;
  for (let p = 0; p < passes; p++) {
    for (const pts of polylines) {
      if (roughness === 0) {
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++)
          ctx.lineTo(pts[i].x, pts[i].y);
      } else {
        roughPolyline(ctx, pts, roughness, seedBase + p * 131 + pts.length);
      }
    }
  }
}

/** deterministic seed from a scene position */
function seedAt(p: Point): number {
  return Math.round((p.x * 7 + p.y * 13) % 1000);
}

/** corner radius in scene px for a rectangle/component (0–100% of the smaller side) */
function cornerRadius(el: Element): number {
  if ((el.type !== "rectangle" && el.type !== "component") || el.borderRadius <= 0)
    return 0;
  const max = Math.min(Math.abs(el.width), Math.abs(el.height)) / 2;
  return (Math.min(100, el.borderRadius) / 100) * max;
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

/**
 * closed perimeter of a rounded rectangle as a sampled polyline loop
 * (first point == last point), so hand-drawn strokes follow the corners.
 */
function roundedRectLoop(
  x: number,
  y: number,
  width: number,
  height: number,
  r: number,
): Point[] {
  const x1 = Math.min(x, x + width);
  const y1 = Math.min(y, y + height);
  const x2 = x1 + Math.abs(width);
  const y2 = y1 + Math.abs(height);
  if (r <= 0) {
    return [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
      { x: x1, y: y1 },
    ];
  }
  const pts: Point[] = [];
  const seg = Math.max(3, Math.round(r / 4));
  // [centerX, centerY, startAngle] per corner, clockwise from top-left arc
  const arcs: [number, number, number][] = [
    [x2 - r, y1 + r, -Math.PI / 2],
    [x2 - r, y2 - r, 0],
    [x1 + r, y2 - r, Math.PI / 2],
    [x1 + r, y1 + r, Math.PI],
  ];
  for (const [cx, cy, start] of arcs) {
    for (let i = 0; i <= seg; i++) {
      const a = start + (i / seg) * (Math.PI / 2);
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  }
  pts.push(pts[0]);
  return pts;
}

function applyDash(
  ctx: CanvasRenderingContext2D,
  el: Element,
  strokeWidth: number,
) {
  if (el.strokeStyle === "dashed") {
    ctx.setLineDash([strokeWidth * 5, strokeWidth * 4]);
  } else if (el.strokeStyle === "dotted") {
    ctx.setLineDash([strokeWidth * 0.01 + 0.01, strokeWidth * 2.6]);
    ctx.lineCap = "round";
  } else if (el.strokeStyle === "dashdot") {
    ctx.setLineDash([
      strokeWidth * 5,
      strokeWidth * 3,
      strokeWidth * 0.01 + 0.01,
      strokeWidth * 3,
    ]);
    ctx.lineCap = "round";
  }
}

/** fixed icon→label distance and font size (do NOT scale with resize) */
const ICON_LABEL_GAP = 2;
const COMPONENT_LABEL_FONT = 12;

/** icon geometry shared between canvas rendering and label placement */
export function componentIconLayout(el: ComponentElement) {
  const s = Math.min(Math.abs(el.width), Math.abs(el.height));
  const hasLabel = !!el.label && el.label.trim() !== "";
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const baseGap = el.captionGap ?? ICON_LABEL_GAP;
  const captionPos = el.captionPosition ?? "bottom";
  const offset =
    captionPos === "top" ? (el.captionOffsetTop ?? 0) :
    captionPos === "bottom" ? (el.captionOffsetBottom ?? 0) :
    captionPos === "left" ? (el.captionOffsetLeft ?? 0) :
    (el.captionOffsetRight ?? 0);
  const gap = baseGap + offset;
  const labelFont = el.fontSize ?? COMPONENT_LABEL_FONT;
  const labelH = labelFont * 1.25;

  // icon size is ALWAYS fixed proportion of element, never affected by fontSize
  const iconSizeFixed = hasLabel ? Math.max(s * 0.65, 8) : s;

  if (!hasLabel) {
    return {
      hasLabel,
      iconX: cx - iconSizeFixed / 2,
      iconY: cy - iconSizeFixed / 2,
      iconSize: iconSizeFixed,
      labelCx: cx,
      labelCy: cy,
      labelFont,
      captionPosition: captionPos,
    };
  }

  if (captionPos === "left" || captionPos === "right") {
    // horizontal layout: icon and label side by side, edge-to-edge
    const { width: tw } = measureText(el.label!, labelFont);
    const iconY = cy - iconSizeFixed / 2;
    const totalW = iconSizeFixed + gap + tw;
    let iconX: number;
    let labelCx: number;
    if (captionPos === "left") {
      // label on left, icon on right
      iconX = cx + totalW / 2 - iconSizeFixed;
      labelCx = cx - totalW / 2 + tw / 2;
    } else {
      // label on right, icon on left
      iconX = cx - totalW / 2;
      labelCx = cx + totalW / 2 - tw / 2;
    }
    return {
      hasLabel,
      iconX,
      iconY,
      iconSize: iconSizeFixed,
      labelCx,
      labelCy: cy,
      labelFont,
      captionPosition: captionPos,
    };
  }

  // vertical layout (top or bottom): icon takes fixed space, label gets remaining
  const totalContentH = iconSizeFixed + gap + labelH;
  const topOffset = cy - totalContentH / 2;
  if (captionPos === "top") {
    return {
      hasLabel,
      iconX: cx - iconSizeFixed / 2,
      iconY: topOffset + labelH + gap,
      iconSize: iconSizeFixed,
      labelCx: cx,
      labelCy: topOffset + labelH / 2,
      labelFont,
      captionPosition: captionPos,
    };
  }
  // bottom (default)
  return {
    hasLabel,
    iconX: cx - iconSizeFixed / 2,
    iconY: topOffset,
    iconSize: iconSizeFixed,
    labelCx: cx,
    labelCy: topOffset + iconSizeFixed + gap + labelH / 2,
    labelFont,
    captionPosition: captionPos,
  };
}

function drawComponentIcon(ctx: CanvasRenderingContext2D, el: ComponentElement) {
  const { iconX, iconY, iconSize } = componentIconLayout(el);

  // official bundled icon (AWS Architecture Icons) when available
  const img = getComponentImage(el.componentId);
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, iconX, iconY, iconSize, iconSize);
    return;
  }

  const paths = iconPaths(el.componentId);
  if (paths.length === 0) return;
  const scale = iconSize / 24;
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

function drawElement(
  ctx: CanvasRenderingContext2D,
  el: Element,
  colors: RenderColors,
) {
  ctx.save();
  ctx.globalAlpha = el.opacity;
  ctx.strokeStyle = resolveStroke(el, colors);
  ctx.fillStyle = el.backgroundColor;
  ctx.lineWidth = el.strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (el.type === "rectangle" || el.type === "component") {
    // fill always uses a clean closed shape so it never breaks
    if (el.backgroundColor !== "transparent") {
      ctx.beginPath();
      ctx.roundRect(el.x, el.y, el.width, el.height, cornerRadius(el));
      ctx.fill();
    }
    // strokeWidth 0 = borderless (library components)
    if (el.strokeWidth > 0) {
      ctx.beginPath();
      if (el.roughness === 0) {
        ctx.roundRect(el.x, el.y, el.width, el.height, cornerRadius(el));
      } else {
        sketchStroke(
          ctx,
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
          seedAt({ x: Math.min(el.x, el.x + el.width), y: Math.min(el.y, el.y + el.height) }),
        );
      }
      applyDash(ctx, el, el.strokeWidth);
      ctx.stroke();
    }

    if (el.type === "component") drawComponentIcon(ctx, el);
  } else if (el.type === "arrow") {
    const [a, b] = arrowPoints(el);
    const lineType = el.lineType ?? "straight";
    const endY = b.y === a.y ? b.y + 1 : b.y;
    const tip = { x: b.x, y: endY };

    ctx.beginPath();
    if (lineType === "straight") {
      sketchStroke(ctx, [[a, tip]], el.roughness, seedAt(a));
      applyDash(ctx, el, el.strokeWidth);
      ctx.stroke();
      drawArrowHead(ctx, tip, a, Math.max(12, el.strokeWidth * 4));
    } else if (lineType === "curved") {
      const cp = el.controlPoint ?? {
        x: (a.x + tip.x) / 2,
        y: (a.y + tip.y) / 2 - Math.abs(tip.x - a.x) * 0.3,
      };
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(cp.x, cp.y, tip.x, tip.y);
      applyDash(ctx, el, el.strokeWidth);
      ctx.stroke();
      drawArrowHead(ctx, tip, cp, Math.max(12, el.strokeWidth * 4));
    } else {
      // auto: L-shaped routing (horizontal then vertical)
      const mid = { x: tip.x, y: a.y };
      sketchStroke(ctx, [[a, mid, tip]], el.roughness, seedAt(a));
      applyDash(ctx, el, el.strokeWidth);
      ctx.stroke();
      drawArrowHead(ctx, tip, mid, Math.max(12, el.strokeWidth * 4));
    }
  } else if (el.type === "text") {
    ctx.fillStyle = resolveTextColor(el, colors);
    ctx.font = resolveFont(el);
    ctx.textBaseline = "top";
    const lh = lineHeight(el);
    const lines = el.text.split("\n");
    const align = el.textAlign ?? "left";
    ctx.textAlign = align;
    const underlineOn = !!el.underline;
    lines.forEach((line, i) => {
      let lx = el.x;
      if (align === "center") lx = el.x + el.width / 2;
      else if (align === "right") lx = el.x + el.width;
      ctx.fillText(line, lx, el.y + i * el.fontSize * lh);
      if (underlineOn && line.length > 0) {
        const lw = ctx.measureText(line).width;
        if (lw > 0) {
          let ux = el.x;
          if (align === "center") ux = el.x + (el.width - lw) / 2;
          else if (align === "right") ux = el.x + el.width - lw;
          ctx.strokeStyle = resolveTextColor(el, colors);
          ctx.lineWidth = Math.max(2, el.fontSize * 0.07);
          ctx.beginPath();
          ctx.moveTo(ux, el.y + (i + 1) * el.fontSize * lh + 2);
          ctx.lineTo(ux + lw, el.y + (i + 1) * el.fontSize * lh + 2);
          ctx.stroke();
        }
      }
    });
  }
  ctx.restore();
}

export function elementVisualBounds(ctx: CanvasRenderingContext2D, el: Element): Bounds {
  const eb = elementBounds(el);
  let x1 = eb.x1;
  let y1 = eb.y1;
  let x2 = eb.x2;
  let y2 = eb.y2;

  if ("label" in el && el.label) {
    const fontSize = el.fontSize ?? (el.type === "component" ? 12 : 14);
    ctx.font = resolveFont(el, fontSize);
    const tw = ctx.measureText(el.label).width;
    const th = fontSize * 1.25;
    if (el.type === "component") {
      const layout = componentIconLayout(el);
      x1 = Math.min(x1, layout.iconX);
      y1 = Math.min(y1, layout.iconY);
      x2 = Math.max(x2, layout.iconX + layout.iconSize);
      y2 = Math.max(y2, layout.iconY + layout.iconSize);
      const lx = layout.labelCx - tw / 2;
      const ly = layout.labelCy - th / 2;
      x1 = Math.min(x1, lx);
      y1 = Math.min(y1, ly);
      x2 = Math.max(x2, lx + tw);
      y2 = Math.max(y2, ly + th);
    } else {
      const textAlign = el.textAlign ?? "center";
      const textVAlign = el.textVAlign ?? "middle";
      const pad = el.textPadding ?? 8;
      let lx: number;
      let ly: number;
      if (textAlign === "left") lx = el.x + pad;
      else if (textAlign === "right") lx = el.x + el.width - pad - tw;
      else lx = el.x + (el.width - tw) / 2;
      if (textVAlign === "top") ly = el.y + pad;
      else if (textVAlign === "bottom") ly = el.y + el.height - pad - th;
      else ly = el.y + (el.height - th) / 2;
      x1 = Math.min(x1, lx);
      y1 = Math.min(y1, ly);
      x2 = Math.max(x2, lx + tw);
      y2 = Math.max(y2, ly + th);
    }
  }

  return { x1, y1, x2, y2 };
}

function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  el: Element,
  zoom: number,
  color: string,
) {
  // arrows: highlight the line itself instead of a misleading bbox rectangle
  if (el.type === "arrow") {
    const [a, b] = arrowPoints(el);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = el.strokeWidth + 4 / zoom;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const b = elementVisualBounds(ctx, el);
  const pad = 3 / zoom;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.75, 1 / zoom);
  ctx.setLineDash([3 / zoom, 4 / zoom]);
  ctx.strokeRect(
    b.x1 - pad,
    b.y1 - pad,
    b.x2 - b.x1 + pad * 2,
    b.y2 - b.y1 + pad * 2,
  );
  ctx.restore();
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  el: Element,
  colors: RenderColors,
  hiddenId?: string | null,
) {
  if (el.type === "text" || !el.label) return;
  if (hiddenId && el.id === hiddenId) return;
  ctx.save();
  ctx.fillStyle = resolveTextColor(el, colors);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const underlineOn = !!el.underline;
  if (el.type === "component") {
    const layout = componentIconLayout(el);
    ctx.font = resolveFont(el, layout.labelFont);
    ctx.fillText(el.label, layout.labelCx, layout.labelCy);
    if (underlineOn) {
      const lw = ctx.measureText(el.label).width;
      if (lw > 0) {
        ctx.strokeStyle = resolveTextColor(el, colors);
        ctx.lineWidth = Math.max(1.5, layout.labelFont * 0.07);
        ctx.beginPath();
        const uy = layout.labelCy + layout.labelFont * 0.55;
        ctx.moveTo(layout.labelCx - lw / 2, uy);
        ctx.lineTo(layout.labelCx + lw / 2, uy);
        ctx.stroke();
      }
    }
  } else {
    const textAlign = el.textAlign ?? "center";
    const textVAlign = el.textVAlign ?? "middle";
    ctx.textAlign = textAlign;
    let cx: number;
    let cy: number;
    if (el.type === "arrow") {
      cx = textAlign === "left" ? el.x : textAlign === "right" ? el.x + el.width : el.x + el.width / 2;
      cy = el.y + el.height / 2;
    } else {
      const pad = el.textPadding ?? 8;
      if (textAlign === "left") cx = el.x + pad;
      else if (textAlign === "right") cx = el.x + el.width - pad;
      else cx = el.x + el.width / 2;
      if (textVAlign === "top") cy = el.y + pad;
      else if (textVAlign === "bottom") cy = el.y + el.height - pad;
      else cy = el.y + el.height / 2;
    }
    const fontSize = el.fontSize ?? 14;
    ctx.font = resolveFont(el, fontSize);
    ctx.fillText(el.label, cx, cy);
    if (underlineOn) {
      const lw = ctx.measureText(el.label).width;
      if (lw > 0) {
        ctx.strokeStyle = resolveTextColor(el, colors);
        ctx.lineWidth = Math.max(1.5, fontSize * 0.07);
        ctx.beginPath();
        const uy = cy + fontSize * 0.55;
        let ux = cx;
        if (textAlign === "left") ux = cx;
        else if (textAlign === "right") ux = cx - lw;
        else ux = cx - lw / 2;
        ctx.moveTo(ux, uy);
        ctx.lineTo(ux + lw, uy);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

const HANDLE_SIZE = 7; // screen px

function drawHandles(
  ctx: CanvasRenderingContext2D,
  el: Element,
  zoom: number,
  color: string,
) {
  const b = elementVisualBounds(ctx, el);
  const cx = (b.x1 + b.x2) / 2;
  const cy = (b.y1 + b.y2) / 2;
  // arrows expose only their two endpoints (start = bbox nw, end = bbox se)
  const points =
    el.type === "arrow"
      ? [
          { x: b.x1, y: b.y1 },
          { x: b.x2, y: b.y2 },
        ]
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
  const s = HANDLE_SIZE / zoom;
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1 / zoom;
  for (const p of points) {
    ctx.beginPath();
    ctx.rect(p.x - s / 2, p.y - s / 2, s, s);
    ctx.fill();
    ctx.stroke();
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

  if (state.gridMode === "dots") {
    drawGridDots(ctx, cam, canvasWidth, canvasHeight, colors.gridDot);
  } else if (state.gridMode === "lines") {
    drawGridLines(ctx, cam, canvasWidth, canvasHeight, colors.gridLine);
  }

  // scene transform
  ctx.translate(cam.scrollX, cam.scrollY);
  ctx.scale(cam.zoom, cam.zoom);

  for (const el of state.doc.elements) {
    const isEditingThisLabel =
      !!state.hiddenLabelId && el.id === state.hiddenLabelId;
    drawElement(ctx, el, colors);
    drawLabel(ctx, el, colors, state.hiddenLabelId);
    if (state.selectedIds.has(el.id) && !isEditingThisLabel)
      drawSelectionBox(ctx, el, cam.zoom, colors.selection);
  }

  // resize handles for single selection of a shape/arrow
  if (!state.draft && state.selectedIds.size === 1) {
    const sel = state.doc.elements.find((el) => state.selectedIds.has(el.id));
    if (
      sel &&
      (sel.type === "rectangle" || sel.type === "arrow" || sel.type === "component") &&
      !(state.hiddenLabelId && sel.id === state.hiddenLabelId)
    ) {
      drawHandles(ctx, sel, cam.zoom, colors.selection);
    }
  }

  if (state.guides && state.camera) {
    drawGuides(ctx, state.guides, cam, canvasWidth, canvasHeight);
  }

  if (state.draft) {
    drawElement(ctx, state.draft, colors);
    drawLabel(ctx, state.draft, colors);
    drawSelectionBox(ctx, state.draft, cam.zoom, colors.selection);
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
