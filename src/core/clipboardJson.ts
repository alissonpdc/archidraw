import type {
  ArrowBinding,
  Element,
  FillStyle,
  Point,
  Roughness,
  StrokeStyle,
} from "./types";
import { DEFAULT_BG, DEFAULT_STROKE } from "./types";
import { clamp, newId } from "./utils";

export const CLIPBOARD_ELEMENTS_KIND = "archidraw/elements";
const CLIPBOARD_SCHEMA_VERSION = 1;
const DEFAULT_TEXT_FONT_SIZE = 20;
const DEFAULT_SIZE = 100;

const ELEMENT_TYPES: readonly string[] = [
  "rectangle",
  "diamond",
  "ellipse",
  "polygon",
  "line",
  "arrow",
  "text",
  "component",
  "context",
];
const STROKE_STYLES: readonly string[] = ["solid", "dashed", "dotted", "dashdot"];
const FILL_STYLES: readonly string[] = ["solid", "hachure", "cross-hachure"];
const LINE_TYPES: readonly string[] = ["straight", "curved", "auto"];
const ARROW_HEADS: readonly string[] = ["none", "circle", "arrow", "triangle"];
const TEXT_ALIGNS: readonly string[] = ["left", "center", "right"];
const TEXT_VALIGNS: readonly string[] = ["top", "middle", "bottom"];
const CAPTION_POSITIONS: readonly string[] = ["top", "bottom", "left", "right"];
const LABEL_POSITIONS: readonly string[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];
const CONTEXT_LABEL_SIDES: readonly string[] = ["internal", "external"];
const BINDING_SIDES: readonly string[] = ["top", "bottom", "left", "right"];

type Raw = Record<string, unknown>;

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const num = (v: unknown, def: number) => (isNum(v) ? v : def);

const oneOf = <T extends string>(v: unknown, allowed: readonly string[], def: T): T =>
  typeof v === "string" && allowed.includes(v) ? (v as T) : def;

function keepString(el: Raw, rec: Raw, key: string) {
  if (typeof rec[key] === "string") el[key] = rec[key];
}

function keepBoolean(el: Raw, rec: Raw, key: string) {
  if (typeof rec[key] === "boolean") el[key] = rec[key];
}

function keepNumber(el: Raw, rec: Raw, key: string) {
  if (isNum(rec[key])) el[key] = rec[key];
}

function keepOneOf(el: Raw, rec: Raw, key: string, allowed: readonly string[]) {
  if (typeof rec[key] === "string" && allowed.includes(rec[key])) {
    el[key] = rec[key];
  }
}

function normalizePoint(v: unknown): Point | undefined {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return undefined;
  const pt = v as Raw;
  if (!isNum(pt.x) || !isNum(pt.y)) return undefined;
  return { x: pt.x, y: pt.y };
}

function normalizePoints(v: unknown): Point[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: Point[] = [];
  for (const item of v) {
    const pt = normalizePoint(item);
    if (!pt) return undefined;
    out.push(pt);
  }
  return out;
}

function normalizeStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") return undefined;
    out.push(item);
  }
  return out;
}

function normalizeBinding(v: unknown): ArrowBinding | undefined {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return undefined;
  const b = v as Raw;
  if (typeof b.elementId !== "string") return undefined;
  const out: ArrowBinding = { elementId: b.elementId, nx: num(b.nx, 0.5), ny: num(b.ny, 0.5) };
  if (typeof b.side === "string" && BINDING_SIDES.includes(b.side)) {
    out.side = b.side as ArrowBinding["side"];
  }
  return out;
}

function normalizeRing(v: unknown): Point[] | undefined {
  const pts = normalizePoints(v);
  if (!pts || pts.length < 3) return undefined;
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (first.x === last.x && first.y === last.y) pts.pop();
  return pts;
}

/** rings of a boolean result: array of rings, each ≥3 points (outer first) */
function normalizeRings(v: unknown): Point[][] | undefined {
  if (!Array.isArray(v) || v.length === 0) return undefined;
  const rings: Point[][] = [];
  for (const item of v) {
    const ring = normalizeRing(item);
    if (!ring) return undefined;
    rings.push(ring);
  }
  return rings;
}

function keepEdgeFields(el: Raw, rec: Raw) {
  keepString(el, rec, "label");
  keepNumber(el, rec, "labelT");
  keepOneOf(el, rec, "lineType", LINE_TYPES);
  const controlPoint = normalizePoint(rec.controlPoint);
  if (controlPoint) el.controlPoint = controlPoint;
  const bendPoints = normalizePoints(rec.bendPoints);
  if (bendPoints) el.bendPoints = bendPoints;
  const startBinding = normalizeBinding(rec.startBinding);
  if (startBinding) el.startBinding = startBinding;
  const endBinding = normalizeBinding(rec.endBinding);
  if (endBinding) el.endBinding = endBinding;
  if (el.type === "arrow") {
    keepBoolean(el, rec, "animated");
    keepOneOf(el, rec, "startArrowhead", ARROW_HEADS);
    keepOneOf(el, rec, "endArrowhead", ARROW_HEADS);
  }
}

export function normalizeElement(raw: unknown): Element | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const rec = raw as Raw;
  if (typeof rec.type !== "string" || !ELEMENT_TYPES.includes(rec.type)) {
    return null;
  }
  const type = rec.type;
  const el: Raw = {
    id: typeof rec.id === "string" ? rec.id : newId(),
    type,
    x: num(rec.x, 0),
    y: num(rec.y, 0),
    width: num(rec.width, DEFAULT_SIZE),
    height: num(rec.height, DEFAULT_SIZE),
    strokeColor: typeof rec.strokeColor === "string" ? rec.strokeColor : DEFAULT_STROKE,
    backgroundColor: typeof rec.backgroundColor === "string" ? rec.backgroundColor : DEFAULT_BG,
    strokeWidth: num(rec.strokeWidth, 1),
    opacity: num(rec.opacity, 1),
    strokeOpacity: num(rec.strokeOpacity, 1),
    fillOpacity: num(rec.fillOpacity, 1),
    strokeStyle: oneOf<StrokeStyle>(rec.strokeStyle, STROKE_STYLES, "solid"),
    fillStyle: oneOf<FillStyle>(rec.fillStyle, FILL_STYLES, "solid"),
    roughness: Math.round(clamp(num(rec.roughness, 0), 0, 3)) as Roughness,
    borderRadius: num(rec.borderRadius, 0),
    angle: num(rec.angle, 0),
  };
  keepString(el, rec, "groupId");
  keepBoolean(el, rec, "locked");
  keepString(el, rec, "details");
  keepString(el, rec, "fontFamily");
  keepBoolean(el, rec, "bold");
  keepBoolean(el, rec, "italic");
  keepBoolean(el, rec, "underline");
  keepString(el, rec, "textColor");
  keepNumber(el, rec, "lineSpacing");
  keepNumber(el, rec, "fontSize");
  keepOneOf(el, rec, "textAlign", TEXT_ALIGNS);
  keepOneOf(el, rec, "textVAlign", TEXT_VALIGNS);
  keepNumber(el, rec, "textOffsetGlobal");
  keepNumber(el, rec, "textOffsetTop");
  keepNumber(el, rec, "textOffsetBottom");
  keepNumber(el, rec, "textOffsetLeft");
  keepNumber(el, rec, "textOffsetRight");
  keepOneOf(el, rec, "captionPosition", CAPTION_POSITIONS);
  keepNumber(el, rec, "captionGap");
  keepNumber(el, rec, "captionOffsetTop");
  keepNumber(el, rec, "captionOffsetBottom");
  keepNumber(el, rec, "captionOffsetLeft");
  keepNumber(el, rec, "captionOffsetRight");

  if (type === "rectangle" || type === "diamond" || type === "ellipse") {
    keepString(el, rec, "label");
  } else if (type === "polygon") {
    const rings = normalizeRings(rec.rings);
    if (!rings) return null;
    el.rings = rings;
    keepString(el, rec, "label");
  } else if (type === "line" || type === "arrow") {
    keepEdgeFields(el, rec);
  } else if (type === "text") {
    el.text = typeof rec.text === "string" ? rec.text : "";
    el.fontSize = num(rec.fontSize, DEFAULT_TEXT_FONT_SIZE);
  } else if (type === "component") {
    el.componentId = typeof rec.componentId === "string" ? rec.componentId : "";
    keepString(el, rec, "label");
    keepString(el, rec, "src");
    keepBoolean(el, rec, "fill");
  } else if (type === "context") {
    keepString(el, rec, "label");
    keepOneOf(el, rec, "labelPosition", LABEL_POSITIONS);
    keepOneOf(el, rec, "labelSide", CONTEXT_LABEL_SIDES);
    const childIds = normalizeStringArray(rec.childIds);
    if (childIds) el.childIds = childIds;
  }
  return el as unknown as Element;
}

function extractRawElements(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (typeof data === "object" && data !== null) {
    const rec = data as Raw;
    if (Array.isArray(rec.elements)) return rec.elements;
    return [data];
  }
  return null;
}

export function serializeElementsClipboard(elements: Element[]): string {
  return JSON.stringify(
    {
      schemaVersion: CLIPBOARD_SCHEMA_VERSION,
      type: CLIPBOARD_ELEMENTS_KIND,
      elements,
    },
    null,
    2,
  );
}

export function parseElementsClipboard(text: string): Element[] | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  const raw = extractRawElements(data);
  if (!raw || raw.length === 0) return null;
  const elements: Element[] = [];
  for (const item of raw) {
    const el = normalizeElement(item);
    if (!el) return null;
    elements.push(el);
  }
  return elements;
}

export function parseLibraryClipboard(text: string): Element[] | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return null;
  }
  const rec = data as Raw;
  const lists = Array.isArray(rec.libraryItems)
    ? rec.libraryItems
    : Array.isArray(rec.library)
      ? rec.library
      : null;
  if (!lists) return null;
  const elements: Element[] = [];
  for (const item of lists) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
    const raw = (item as Raw).archidrawElements;
    if (!Array.isArray(raw)) continue;
    for (const candidate of raw) {
      const el = normalizeElement(candidate);
      if (el) elements.push(el);
    }
  }
  return elements.length > 0 ? elements : null;
}
