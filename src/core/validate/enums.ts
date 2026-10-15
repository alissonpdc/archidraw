// Enums e tabelas de regras do modelo de elemento (Seções 3.2-3.5 dos /docs).
// Espelham os arrays do clipboardJson.ts, mas exportados p/ o validador detallado.
// Mantidos como `readonly string[]` (runtime) para checagem com includes().

export const ELEMENT_TYPES: readonly string[] = [
  "rectangle",
  "diamond",
  "ellipse",
  "line",
  "arrow",
  "text",
  "component",
  "context",
];

export const SHAPE_TYPES: readonly string[] = ["rectangle", "diamond", "ellipse"];
export const EDGE_TYPES: readonly string[] = ["line", "arrow"];

// Seção 3.4 — todos lowercase.
export const STROKE_STYLES = ["solid", "dashed", "dotted", "dashdot"] as const;
export const FILL_STYLES = ["solid", "hachure", "cross-hachure"] as const;
export const LINE_TYPES = ["straight", "curved", "auto"] as const;
export const ARROW_HEADS = ["none", "circle", "arrow", "triangle"] as const;
export const TEXT_ALIGNS = ["left", "center", "right"] as const;
export const TEXT_VALIGNS = ["top", "middle", "bottom"] as const;
export const CAPTION_POSITIONS = ["top", "bottom", "left", "right"] as const;
export const LABEL_POSITIONS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;
export const BINDING_SIDES = ["top", "bottom", "left", "right"] as const;
export const CONTEXT_LABEL_SIDES = ["internal", "external"] as const;

export type EnumName =
  | "StrokeStyle"
  | "FillStyle"
  | "LineType"
  | "ArrowHeadType"
  | "TextAlign"
  | "TextVAlign"
  | "CaptionPosition"
  | "LabelPosition"
  | "BindingSide"
  | "ContextLabelSide";

/** mapa enum-name -> valores aceitos (Seção 3.4) */
export const ENUMS: Record<EnumName, readonly string[]> = {
  StrokeStyle: STROKE_STYLES,
  FillStyle: FILL_STYLES,
  LineType: LINE_TYPES,
  ArrowHeadType: ARROW_HEADS,
  TextAlign: TEXT_ALIGNS,
  TextVAlign: TEXT_VALIGNS,
  CaptionPosition: CAPTION_POSITIONS,
  LabelPosition: LABEL_POSITIONS,
  BindingSide: BINDING_SIDES,
  ContextLabelSide: CONTEXT_LABEL_SIDES,
};

/** campos obrigatorios de Todo elemento (base) — Seção 3.2 */
export const BASE_FIELDS: readonly string[] = [
  "id",
  "type",
  "x",
  "y",
  "width",
  "height",
  "strokeColor",
  "backgroundColor",
  "strokeWidth",
  "opacity",
];

/** campos de estilo que o loader preenche mas o arquivo pode omitir — 3.2 */
export const OPTIONAL_STYLE_FIELDS: readonly string[] = [
  "strokeOpacity",
  "fillOpacity",
  "strokeStyle",
  "fillStyle",
  "roughness",
  "borderRadius",
  "angle",
];

export const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
