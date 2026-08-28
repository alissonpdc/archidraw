export type ElementType =
  | "rectangle"
  | "diamond"
  | "ellipse"
  | "line"
  | "arrow"
  | "text"
  | "component";

/** line pattern: continuous, dashed, dotted or dash-dot */
export type StrokeStyle = "solid" | "dashed" | "dotted" | "dashdot";

/** how "hand-drawn" the stroke looks: 0 = clean, 1 = draft, 2 = sketchy, 3 = chaos */
export type Roughness = 0 | 1 | 2 | 3;

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
  strokeStyle: StrokeStyle;
  /** 0 = clean, 1 = draft, 2 = sketchy, 3 = chaos */
  roughness: Roughness;
  /** corner rounding of rectangles, % of the smaller side (0–100) */
  borderRadius: number;

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
  /** padding from element borders when text is inside (rect/component) */
  textPadding?: number;
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
}

export type LineType = "straight" | "curved" | "auto";
export type AnchorSide = "top" | "right" | "bottom" | "left" | "center";

export interface ArrowBinding {
  elementId: string;
  anchor: AnchorSide;
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
  /** control point for curved lines (relative to element center, scene units) */
  controlPoint?: Point;
  startBinding?: ArrowBinding;
  endBinding?: ArrowBinding;
}

export interface TextElement extends BaseElement {
  type: "text";
  text: string;
  fontSize: number;
}

/** software component from the library (AWS services etc.) */
export interface ComponentElement extends BaseElement {
  type: "component";
  /** id in the component catalog (core/library.ts) */
  componentId: string;
  label?: string;
}

export type Element =
  | RectangleElement
  | DiamondElement
  | EllipseElement
  | LineElement
  | ArrowElement
  | TextElement
  | ComponentElement;

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
  | "text";

export interface Camera {
  /** scene -> screen offset */
  scrollX: number;
  scrollY: number;
  zoom: number;
}

export const DEFAULT_CAMERA: Camera = { scrollX: 0, scrollY: 0, zoom: 1 };

export const DEFAULT_STROKE = "#1e1e1e";
export const DEFAULT_BG = "transparent";
