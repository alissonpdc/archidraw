export type ElementType =
  | "rectangle"
  | "diamond"
  | "ellipse"
  | "line"
  | "arrow"
  | "text"
  | "component"
  | "context";

/** line pattern: continuous, dashed, dotted or dash-dot */
export type StrokeStyle = "solid" | "dashed" | "dotted" | "dashdot";

/** fill pattern: solid color block, 45° hachure lines, or cross-hatched lines */
export type FillStyle = "solid" | "hachure" | "cross-hachure";

/** how "hand-drawn" the stroke looks: 0 = clean, 1 = draft, 2 = sketchy, 3 = chaos */
export type Roughness = 0 | 1 | 2 | 3;

/** arrowhead style: none, circle, current arrow (>), filled triangle */
export type ArrowHeadType = "none" | "circle" | "arrow" | "triangle";

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type TextAlign = "left" | "center" | "right";
export type TextVAlign = "top" | "middle" | "bottom";
export type CaptionPosition = "top" | "bottom" | "left" | "right";
export type LabelPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  backgroundColor: string;
  strokeWidth: number;
  opacity: number;
  strokeOpacity: number;
  fillOpacity: number;
  strokeStyle: StrokeStyle;
  fillStyle: FillStyle;
  /** 0 = clean, 1 = draft, 2 = sketchy, 3 = chaos */
  roughness: Roughness;
  /** corner rounding of rectangles, % of the smaller side (0–100) */
  borderRadius: number;

  /** id of the logical group this element belongs to, if any (no container element) */
  groupId?: string;

  /** when true the element cannot be moved, resized, deleted or edited */
  locked?: boolean;

  /** complementar technical details (payload, latency, notes...) hidden by
   *  default and shown on demand via hover on the badge / context menu */
  details?: string;

  // --- text styling (labels & text elements) ---
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** overrides strokeColor when rendering text; "" → use strokeColor */
  textColor?: string;
  lineSpacing?: number;
  /** font size for labels; TextElement uses its own required fontSize */
  fontSize?: number;
  textAlign?: TextAlign;
  /** vertical alignment inside the element: top / middle / bottom */
  textVAlign?: TextVAlign;
  /** global offset of the text inside the element (px), added to the per-side offset */
  textOffsetGlobal?: number;
  /** extra text offset when the text is aligned to a specific side (px) */
  textOffsetTop?: number;
  textOffsetBottom?: number;
  textOffsetLeft?: number;
  textOffsetRight?: number;
  /** component caption position relative to the icon */
  captionPosition?: CaptionPosition;
  /** gap between icon and caption (px) */
  captionGap?: number;
  /** extra offset added to captionGap when text is on a specific side (px) */
  captionOffsetTop?: number;
  captionOffsetBottom?: number;
  captionOffsetLeft?: number;
  captionOffsetRight?: number;
}

export interface RectangleElement extends BaseElement {
  type: "rectangle";
  label?: string;
}

export interface DiamondElement extends BaseElement {
  type: "diamond";
  label?: string;
}

export interface EllipseElement extends BaseElement {
  type: "ellipse";
  label?: string;
}

/** x,y = start; x+width,y+height = end (same convention as arrow).
 *  width/height are SIGNED: they encode the drawn direction, so the
 *  start point stays anchored regardless of the drag quadrant. */
export interface LineElement extends BaseElement {
  type: "line";
  label?: string;
  /** label position along the stroke: 0 = start, 1 = end (default 0.5 = center) */
  labelT?: number;
  lineType?: LineType;
  /** control point for curved lines (scene units, absolute coordinates) */
  controlPoint?: Point;
  /** intermediate vertices for auto-routed lines (scene units, absolute coordinates) */
  bendPoints?: Point[];
  startBinding?: ArrowBinding;
  endBinding?: ArrowBinding;
}

export type LineType = "straight" | "curved" | "auto";

export interface ArrowBinding {
  elementId: string;
  /** bound point normalized within the element bounds (0..1); positions on
   *  the unit-square border map to the element outline, so the endpoint
   *  stays glued to the outline as the shape moves/resizes */
  nx: number;
  ny: number;
  side?: "top" | "bottom" | "left" | "right";
}

/** x,y = start; x+width,y+height = end (axis-aligned box used as bounds).
 *  width/height are SIGNED (see LineElement) so the arrowhead follows the
 *  drawn direction; use elementBounds() for the normalized bbox. */
export interface ArrowElement extends BaseElement {
  type: "arrow";
  label?: string;
  /** label position along the stroke: 0 = start, 1 = end (default 0.5 = center) */
  labelT?: number;
  lineType?: LineType;
  /** control point for curved lines (scene units, absolute coordinates) */
  controlPoint?: Point;
  /** intermediate vertices for auto-routed arrows (scene units, absolute coordinates) */
  bendPoints?: Point[];
  startBinding?: ArrowBinding;
  endBinding?: ArrowBinding;
  /** when true, the arrow stroke renders with a flowing dash pattern */
  animated?: boolean;
  /** arrowhead style at the start of the arrow (default "none") */
  startArrowhead?: ArrowHeadType;
  /** arrowhead style at the end of the arrow (default "arrow") */
  endArrowhead?: ArrowHeadType;
}

export interface TextElement extends BaseElement {
  type: "text";
  text: string;
  fontSize: number;
}

/** software component from the library (AWS services, imported libs, images) */
export interface ComponentElement extends BaseElement {
  type: "component";
  /** id in the component catalog (core/library.ts) */
  componentId: string;
  label?: string;
  /** self-contained raster asset (imagens importadas/coladas): o elemento
   *  mantém o src embedado e renderiza mesmo se o item de lib for removido */
  src?: string;
  /** raster asset preenche o bounds inteiro (não ícone quadrado centralizado) */
  fill?: boolean;
}

/** container element (Bounded Context / DDD) — groups elements visually and logically */
export interface ContextElement extends BaseElement {
  type: "context";
  label?: string;
  /** which corner of the context the label anchors to */
  labelPosition?: LabelPosition;
  /** whether the label renders outside the bounds (default) or inside it */
  labelSide?: "internal" | "external";
  /** ids of elements contained within this context */
  childIds?: string[];
}

export type Element =
  | RectangleElement
  | DiamondElement
  | EllipseElement
  | LineElement
  | ArrowElement
  | TextElement
  | ComponentElement
  | ContextElement;

export interface Document {
  schemaVersion: 1;
  elements: Element[];
}

export type Tool =
  | "selection"
  | "hand"
  | "rectangle"
  | "diamond"
  | "ellipse"
  | "line"
  | "arrow"
  | "text"
  | "bounded-context";

export interface Camera {
  /** scene -> screen offset */
  scrollX: number;
  scrollY: number;
  zoom: number;
}

export const DEFAULT_CAMERA: Camera = { scrollX: 0, scrollY: 0, zoom: 1 };

export const DEFAULT_STROKE = "#3d4248";
export const DEFAULT_BG = "#dfe0e2";

/** neutral "boundary" stroke used by context containers: light gray on light
 *  themes, its dark inverse on dark themes (resolved by themeColor) */
export const CONTEXT_STROKE = "#c4c7ca";
export const CONTEXT_STROKE_DARK = "#3b3835";
