import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { editor, useEditorSelector } from "../hooks/useEditor";
import type { Element } from "../../core/types";
import {
  DEFAULT_FONT_FAMILY,
  SKETCH_FONT_FAMILY,
  fontFamilyOf,
} from "../../core/textStyle";
import { ColorRampPicker } from "./ColorRampPicker";

const EMPTY_ELEMENTS: Element[] = [];

const STROKE_WIDTHS = [1, 2, 4, 8] as const;
const FONT_SIZES = [
  { label: "S", value: 16 },
  { label: "M", value: 20 },
  { label: "L", value: 28 },
  { label: "XL", value: 36 },
];
const FONT_FAMILIES = [
  { label: "Sans", value: DEFAULT_FONT_FAMILY, glyph: "Aa" },
  { label: "Sketch", value: SKETCH_FONT_FAMILY, glyph: "Aa" },
  { label: "Serif", value: 'Georgia, "Times New Roman", serif', glyph: "Aa" },
  { label: "Consolas", value: 'Consolas, "SF Mono", monospace', glyph: "Aa" },
];
const CAPTION_POSITIONS = [
  { label: "Bottom", value: "bottom" as const },
  { label: "Top", value: "top" as const },
  { label: "Left", value: "left" as const },
  { label: "Right", value: "right" as const },
];
const LABEL_POSITIONS = [
  { label: "Top Left", value: "top-left" as const },
  { label: "Top Right", value: "top-right" as const },
  { label: "Bottom Left", value: "bottom-left" as const },
  { label: "Bottom Right", value: "bottom-right" as const },
];
const LABEL_SIDES = [
  { label: "Internal", value: "internal" as const },
  { label: "External", value: "external" as const },
];
const TEXT_VALIGNS = [
  { label: "Top", value: "top" as const },
  { label: "Middle", value: "middle" as const },
  { label: "Bottom", value: "bottom" as const },
];

type Patch = Partial<{
  strokeColor: string;
  backgroundColor: string;
  strokeWidth: number;
  opacity: number;
  strokeOpacity: number;
  fillOpacity: number;
  fontSize: number;
  strokeStyle: "solid" | "dashed" | "dotted" | "dashdot";
  fillStyle: "solid" | "hachure" | "cross-hachure";
  roughness: 0 | 1 | 2 | 3;
  borderRadius: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  textColor: string;
  lineSpacing: number;
  textAlign: "left" | "center" | "right";
  textVAlign: "top" | "middle" | "bottom";
  textOffsetGlobal: number;
  textOffsetTop: number;
  textOffsetBottom: number;
  textOffsetLeft: number;
  textOffsetRight: number;
  captionPosition: "top" | "bottom" | "left" | "right";
  labelPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  labelSide: "internal" | "external";
  captionGap: number;
  captionOffsetTop: number;
  captionOffsetBottom: number;
  captionOffsetLeft: number;
  captionOffsetRight: number;
  lineType: "straight" | "curved" | "auto";
  animated: boolean;
  startArrowhead: "none" | "circle" | "arrow" | "triangle";
  endArrowhead: "none" | "circle" | "arrow" | "triangle";
}>;

// ---- components ---------------------------------------------------------

interface TipState {
  text: string;
  x: number;
  y: number;
}

/** fixed-position tooltip rendered in a portal so panel overflow never clips it */
function PanelTooltip({ tip }: { tip: TipState | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!tip || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, tip.x - r.width / 2),
      window.innerWidth - r.width - 8,
    );
    setPos({ left, top: tip.y });
  }, [tip]);

  if (!tip) return null;
  return createPortal(
    <div
      ref={ref}
      className="panel-tooltip"
      style={{
        left: pos?.left ?? tip.x,
        top: pos?.top ?? tip.y,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {tip.text}
    </div>,
    document.body,
  );
}

function Group({
  title,
  vertical,
  children,
}: {
  title: string;
  vertical?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="panel-group">
      <div className="panel-subtitle">{title}</div>
      <div className={`panel-group-body${vertical ? " vertical" : ""}`}>{children}</div>
    </div>
  );
}

/** themed section (e.g. STROKE / FILL): big heading + accent left border
 *  that spans the related attribute fields */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel-section">
      <div className="panel-section-heading">{title}</div>
      <div className="panel-section-body">{children}</div>
    </div>
  );
}

function SpacingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  const isMixed = value === null;
  return (
    <div className="spacing-row">
      <span className="spacing-label">{label}</span>
      <button
        className="spacing-btn"
        aria-label={`Decrease ${label}`}
        disabled={isMixed}
        onClick={() => onChange(Math.max(0, (value ?? 0) - 1))}
      >
        −
      </button>
      <input
        className="spacing-input"
        type="number"
        min={0}
        max={50}
        placeholder={isMixed ? "-" : undefined}
        value={isMixed ? "" : value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) onChange(Math.max(0, Math.min(50, v)));
        }}
      />
      <button
        className="spacing-btn"
        aria-label={`Increase ${label}`}
        disabled={isMixed}
        onClick={() => onChange(Math.min(50, (value ?? 0) + 1))}
      >
        +
      </button>
    </div>
  );
}

/** compact slider with a % bubble that follows the thumb */
function MiniSlider({
  value,
  min,
  max,
  step,
  ariaLabel,
  suffix = "%",
  displayValue,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  ariaLabel: string;
  suffix?: string;
  displayValue?: number;
  onChange: (v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [thumbLeft, setThumbLeft] = useState<number>(0);

  const updatePosition = () => {
    const wrap = ref.current;
    if (!wrap) return;
    const input = wrap.querySelector("input");
    if (!input) return;
    const pct = (value - min) / (max - min);
    const trackWidth = input.offsetWidth;
    const thumbW = 14;
    const left = pct * (trackWidth - thumbW) + thumbW / 2;
    setThumbLeft(left);
  };

  useEffect(updatePosition, [value, min, max]);

  return (
    <div className="radius-slider-wrap" ref={ref}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        className="radius-slider"
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span
        className="radius-bubble"
        style={{ left: thumbLeft, transform: "translateX(-50%)" }}
      >
        {displayValue ?? value}
        {suffix}
      </span>
    </div>
  );
}

export function PropertiesPanel() {
  const selected = useEditorSelector(
    (s) => {
      if (s.selectedIds.size === 0) return EMPTY_ELEMENTS;
      return s.doc.elements.filter((el) => s.selectedIds.has(el.id));
    },
    (a, b) => {
      if (a === b) return true;
      if (a.length !== b.length) return false;
      return a.every((el, i) => el === b[i]);
    },
  );
  const [tip, setTip] = useState<TipState | null>(null);
  const [activeTab, setActiveTab] = useState<"style" | "text" | "layers">("style");
  const [maxTabHeight, setMaxTabHeight] = useState<number | null>(null);
  const maxTabHeightRef = useRef<number | null>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement>(null);

  const selKey = selected.map((el) => el.id).join(",");
  useLayoutEffect(() => {
    const heights = [styleRef, textRef, layersRef]
      .map((r) => r.current?.scrollHeight ?? 0)
      .filter((h) => h > 0);
    if (heights.length > 0) {
      const max = Math.max(...heights);
      if (max !== maxTabHeightRef.current) {
        maxTabHeightRef.current = max;
        setMaxTabHeight(max);
      }
    }
  }, [selKey, activeTab]);

  if (selected.length === 0) return null;

  const showTip = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest("[data-tip]");
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTip({
      text: el.getAttribute("data-tip") || "",
      x: r.left + r.width / 2,
      y: r.top,
    });
  };

  const apply = (patch: Patch) => {
    editor.commitHistory();
    editor.updateElements(
      selected.map((el) => el.id),
      patch,
    );
  };

  const hasText = selected.some((el) => el.type === "text");
  const hasShape = selected.some(
    (el) =>
      el.type === "rectangle" ||
      el.type === "diamond" ||
      el.type === "ellipse" ||
      el.type === "line" ||
      el.type === "arrow" ||
      el.type === "component" ||
      el.type === "context",
  );
  const hasFillable = selected.some(
    (el) =>
      el.type === "rectangle" ||
      el.type === "diamond" ||
      el.type === "ellipse" ||
      el.type === "component" ||
      el.type === "context",
  );
  const hasComponent = selected.some((el) => el.type === "component");
  /** elements that use the icon+caption label model (components — incl. imagens) */
  const hasCaption = hasComponent;
  const hasRectangle = selected.some((el) => el.type === "rectangle");
  const hasDiamond = selected.some((el) => el.type === "diamond");
  const hasEllipse = selected.some((el) => el.type === "ellipse");
  const hasArrow = selected.some((el) => el.type === "arrow");
  const hasContext = selected.some((el) => el.type === "context");
  const isOnlyText = selected.length > 0 && selected.every((el) => el.type === "text");

  // pure text has no Style tab; auto-switch away from it
  const effectiveTab = isOnlyText && activeTab === "style" ? "text" : activeTab;

  const allStroke = (v: number) => selected.every((el) => el.strokeWidth === v);
  const allStyle = (v: string) =>
    selected.every((el) => el.strokeStyle === v);
  const allFillStyle = (v: string) =>
    selected.every((el) => (el.fillStyle ?? "solid") === v);
  const allRoughness = (v: number) =>
    selected.every((el) => el.roughness === v);
  const allLineType = (v: string) =>
    selected.every((el) => ((el.type === "arrow" || el.type === "line") ? (el.lineType ?? "straight") : v) === v);
  const allAnimated = selected.every(
    (el) => el.type !== "arrow" || !!el.animated,
  );
  const allStartArrowhead = (v: string) =>
    selected.every(
      (el) =>
        el.type !== "arrow" ||
        ((el as any).startArrowhead ?? "none") === v,
    );
  const allEndArrowhead = (v: string) =>
    selected.every(
      (el) =>
        el.type !== "arrow" ||
        ((el as any).endArrowhead ?? "arrow") === v,
    );
  /** animation marches the dash pattern; solid strokes have no dashes to
   *  move, so the toggle is disabled unless an arrow is dashed, dotted or
   *  dash-dot (any path type: straight, curved or auto). Switching an
   *  animated arrow back to solid clears `animated`, so this stays true. */
  const hasAnimatableArrow = selected.some(
    (el) => el.type === "arrow" && (el.strokeStyle ?? "solid") !== "solid",
  );
  const animationDisabled = !hasAnimatableArrow;
  const allFont = (v: number) => {
    const textEls = selected.filter((el) => el.type === "text" || el.label);
    return (
      textEls.length > 0 &&
      textEls.every(
        (el) =>
          (el.fontSize ??
            (el.type === "component"
              ? 12
              : el.type === "context"
                ? 16
                : 20)) === v,
      )
    );
  };

  const strokeOpacityValue = (() => {
    const first = Math.round(selected[0].strokeOpacity * 100);
    return selected.every((el) => Math.round(el.strokeOpacity * 100) === first)
      ? first
      : null;
  })();
  const fillOpacityValue = (() => {
    const first = Math.round(selected[0].fillOpacity * 100);
    return selected.every((el) => Math.round(el.fillOpacity * 100) === first)
      ? first
      : null;
  })();
  const radiusValue = (() => {
    const rects = selected.filter(
      (el) => el.type === "rectangle" || el.type === "context",
    );
    if (rects.length === 0) return null;
    const first = rects[0].borderRadius;
    return rects.every((r) => r.borderRadius === first) ? first : null;
  })();
  const isCustomRadius =
    radiusValue !== null && radiusValue > 0 && radiusValue < 100;

  // text tab helpers
  const allBold = selected.every((el) => !!el.bold);
  const allItalic = selected.every((el) => !!el.italic);
  const allUnderline = selected.every((el) => !!el.underline);
  const allTextAlign = (v: string) =>
    selected.every((el) => (el.textAlign ?? "center") === v);
  const allTextVAlign = (v: string) =>
    selected.every((el) => (el.textVAlign ?? "middle") === v);
  const allCaptionPos = (v: string) =>
    selected.every((el) => (el.captionPosition ?? "bottom") === v);
  const allLabelPos = (v: string) =>
    selected.every((el) => ((el as any).labelPosition ?? "top-left") === v);
  const allLabelSide = (v: string) =>
    selected.every((el) => ((el as any).labelSide ?? "external") === v);

  const textColorValue = (() => {
    const first = selected[0].textColor ?? "";
    return selected.every((el) => (el.textColor ?? "") === first)
      ? first
      : null;
  })();

  const lineSpacingValue = (() => {
    const first = selected[0].lineSpacing ?? 1.25;
    return selected.every((el) => (el.lineSpacing ?? 1.25) === first)
      ? first
      : null;
  })();

  // unified offset helpers: return value if all selected agree, null otherwise
  const unifiedOffset = (key: string, fallback: number) => {
    const first = ((selected[0] as any)[key] ?? fallback) as number;
    return selected.every(
      (el) => ((el as any)[key] ?? fallback) === first,
    )
      ? first
      : null;
  };

  return (
    <div
      className="properties-panel"
      style={maxTabHeight ? { minHeight: maxTabHeight } : undefined}
      onMouseOver={showTip}
      onMouseLeave={() => setTip(null)}
      onScroll={() => setTip(null)}
    >
      <PanelTooltip tip={tip} />
      {/* Tab bar */}
      <div className="panel-tabs">
        {!isOnlyText && (
          <button
            className={`panel-tab ${activeTab === "style" ? "active" : ""}`}
            onClick={() => setActiveTab("style")}
          >
            Style
          </button>
        )}
        <button
          className={`panel-tab ${activeTab === "text" ? "active" : ""}`}
          onClick={() => setActiveTab("text")}
        >
          Text
        </button>
        <button
          className={`panel-tab ${activeTab === "layers" ? "active" : ""}`}
          onClick={() => setActiveTab("layers")}
        >
          Layers
        </button>
      </div>
      <div className="panel-divider" />

      <div ref={styleRef} className={`panel-tab-content${effectiveTab === "style" ? "" : " hidden"}`}>
        <Section title="Stroke">
          <Group title="Color">
            <ColorRampPicker
              current={selected[0].strokeColor}
              onPick={(strokeColor) => apply({ strokeColor })}
              label="Stroke color"
              kind="stroke"
              opacity={strokeOpacityValue}
              onOpacity={(v) => apply({ strokeOpacity: v / 100 })}
            />
          </Group>
          {hasShape && (
            <Group title="Type">
              {(["solid", "dashed", "dotted", "dashdot"] as const).map((s) => (
                <button
                  key={s}
                  className={`size-btn line-style-btn ${allStyle(s) ? "active" : ""}`}
                  aria-label={`Line ${s}`}
                  onClick={() => apply({ strokeStyle: s })}
                >
                  <svg width="20" height="10" viewBox="0 0 20 10">
                    <line
                      x1="1" y1="5" x2="19" y2="5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      {...(s === "solid"
                        ? {}
                        : s === "dashed"
                          ? { strokeDasharray: "4 3" }
                          : s === "dashdot"
                            ? { strokeDasharray: "5 2.5 0.5 2.5" }
                            : { strokeDasharray: "0.1 4" })}
                    />
                  </svg>
                </button>
              ))}
            </Group>
          )}
          {hasShape && (
            <Group title="Style">
              {(
                [
                  {
                    v: 0,
                    label: "Architect",
                    paths: ["M2 7 L18 7"],
                  },
                  {
                    v: 1,
                    label: "Draft",
                    paths: [
                      "M2.5 7 C6 5.8 12 8.4 17.5 6.8",
                      "M3 7.6 C7 8.6 13 6.2 17 8",
                    ],
                  },
                  {
                    v: 2,
                    label: "Sketchy",
                    paths: [
                      "M2 8 C6 4 12 10 18 6",
                      "M2.5 6.5 C7 9.5 12 4.5 17.5 8",
                      "M3 7 C8 6 11 8.5 16.5 6.8",
                    ],
                  },
                  {
                    v: 3,
                    label: "Chaos",
                    paths: [
                      "M2 9 C5 2 14 11 18 5",
                      "M2.5 5 C7 10.5 13 3.5 17.5 9",
                      "M3 7.5 C6 3.5 12 10.5 17 6.5",
                      "M2 6.5 C8 9.5 11 4.5 18 7.5",
                      "M3.5 8 C7 5.5 13 8 16.5 5.5",
                    ],
                  },
                ] as const
              ).map(({ v, label, paths }) => (
                <button
                  key={v}
                  className={`size-btn ${allRoughness(v) ? "active" : ""}`}
                  aria-label={`Roughness ${label}`}
                  data-tip={label}
                  onClick={() => apply({ roughness: v as 0 | 1 | 2 | 3 })}
                >
                  <svg width="20" height="14" viewBox="0 0 20 14">
                    {paths.map((d, i) => (
                      <path
                        key={i}
                        d={d}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        opacity={i === 0 ? 1 : 0.35}
                      />
                    ))}
                  </svg>
                </button>
              ))}
            </Group>
          )}
          <Group title="Thickness">
            {STROKE_WIDTHS.map((w) => (
              <button
                key={w}
                className={`size-btn ${allStroke(w) ? "active" : ""}`}
                aria-label={`Thickness ${w}`}
                onClick={() => apply({ strokeWidth: w })}
              >
                <span className="thickness-preview" style={{ height: w + 1 }} />
              </button>
            ))}
          </Group>
          {(hasArrow || selected.some((el) => el.type === "line")) && (
            <Group title="Path type">
              {([
                { v: "straight", label: "Straight", icon: "M2 12 L18 4" },
                { v: "curved", label: "Curved", icon: "M2 12 Q10 0 18 4" },
                { v: "auto", label: "Automatic", icon: "M2 12 L10 12 L18 4" },
              ] as const).map(({ v, label, icon }) => (
                <button
                  key={v}
                  className={`size-btn ${allLineType(v) ? "active" : ""}`}
                  aria-label={`Line ${label}`}
                  data-tip={label}
                  onClick={() => apply({ lineType: v })}
                >
                  <svg width="20" height="14" viewBox="0 0 20 14">
                    <path d={icon} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ))}
            </Group>
          )}
          {(hasRectangle || hasContext) && (
            <Group title="Roundness">
              <div className="v-stack">
                <div className="border-presets">
                  <button
                    className={`size-btn border-preset-btn tip-up ${
                      radiusValue === 0 ? "active" : ""
                    }`}
                    aria-label="Square borders"
                    data-tip="Square"
                    onClick={() => apply({ borderRadius: 0 })}
                  >
                    <span className="corner-preview square" />
                  </button>
                  <button
                    className={`size-btn border-preset-btn tip-up ${
                      radiusValue === 100 ? "active" : ""
                    }`}
                    aria-label="Rounded borders"
                    data-tip="Rounded"
                    onClick={() => apply({ borderRadius: 100 })}
                  >
                    <span className="corner-preview round" />
                  </button>
                  <button
                    className={`size-btn border-preset-btn tip-up ${isCustomRadius ? "active" : ""}`}
                    aria-label="Custom borders"
                    data-tip="Custom"
                    onClick={() =>
                      apply({ borderRadius: isCustomRadius ? (radiusValue ?? 50) : 25 })
                    }
                  >
                    <span className="corner-preview custom" />
                  </button>
                </div>
                {isCustomRadius && (
                  <MiniSlider
                    value={radiusValue ?? 25}
                    min={1}
                    max={99}
                    step={1}
                    ariaLabel="Custom rounding"
                    onChange={(v) => apply({ borderRadius: v })}
                  />
                )}
              </div>
            </Group>
          )}
          {hasArrow && (
            <Group title="Arrowheads">
<div className="arrowhead-grid">
                  <div className="arrowhead-row">
                  {(["none", "circle", "arrow", "triangle"] as const).map((t) => (
                    <button
                      key={`start-${t}`}
                      className={`size-btn arrowhead-btn ${allStartArrowhead(t) ? "active" : ""}`}
                      aria-label={`Start arrowhead ${t}`}
                      data-tip={t === "none" ? "None" : t === "circle" ? "Circle" : t === "arrow" ? "Arrow" : "Triangle"}
                      onClick={() => apply({ startArrowhead: t })}
                    >
                      <svg width="18" height="14" viewBox="0 0 18 14">
                        {t === "none" ? (
                          <line x1="2" y1="7" x2="16" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        ) : t === "circle" ? (
                          <>
                            <line x1="2" y1="7" x2="16" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <circle cx="4" cy="7" r="2.5" fill="currentColor" />
                          </>
                        ) : t === "arrow" ? (
                          <>
                            <line x1="6" y1="7" x2="16" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <path d="M6 3 L2 7 L6 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </>
                        ) : (
                          <>
                            <line x1="6" y1="7" x2="16" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <polygon points="6,3 2,7 6,11" fill="currentColor" />
                          </>
                        )}
                      </svg>
                    </button>
                  ))}
                </div>
                <div className="arrowhead-row">
                  {(["none", "circle", "arrow", "triangle"] as const).map((t) => (
                    <button
                      key={`end-${t}`}
                      className={`size-btn arrowhead-btn ${allEndArrowhead(t) ? "active" : ""}`}
                      aria-label={`End arrowhead ${t}`}
                      data-tip={t === "none" ? "None" : t === "circle" ? "Circle" : t === "arrow" ? "Arrow" : "Triangle"}
                      onClick={() => apply({ endArrowhead: t })}
                    >
                      <svg width="18" height="14" viewBox="0 0 18 14">
                        {t === "none" ? (
                          <line x1="2" y1="7" x2="16" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        ) : t === "circle" ? (
                          <>
                            <line x1="2" y1="7" x2="16" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <circle cx="15" cy="7" r="2.5" fill="currentColor" />
                          </>
                        ) : t === "arrow" ? (
                          <>
                            <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <path d="M12 3 L16 7 L12 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </>
                        ) : (
                          <>
                            <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <polygon points="12,3 16,7 12,11" fill="currentColor" />
                          </>
                        )}
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            </Group>
          )}
          {hasArrow && (
            <Group title="Animation">
              <button
                className={`size-btn text-btn ${allAnimated ? "active" : ""}`}
                aria-label="Animate arrow"
                data-tip={
                  animationDisabled
                    ? "Animation needs a dashed, dotted or dash-dot stroke"
                    : "Flowing dashes along the arrow"
                }
                disabled={animationDisabled}
                onClick={() => apply({ animated: !allAnimated })}
              >
                <svg width="20" height="14" viewBox="0 0 20 14">
                  <line
                    x1="2"
                    y1="7"
                    x2="14"
                    y2="7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="3 2"
                  />
                  <path
                    d="M14 4 L18 7 L14 10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </Group>
          )}
        </Section>

        <div style={{ height: 1, background: "var(--border)", margin: "var(--space-2) 0" }} />

        {hasFillable && (
          <Section title="Fill">
            <Group title="Color">
              <ColorRampPicker
                current={selected[0].backgroundColor}
                onPick={(backgroundColor) => apply({ backgroundColor })}
                label="Fill"
                kind="fill"
                opacity={fillOpacityValue}
                onOpacity={(v) => apply({ fillOpacity: v / 100 })}
              />
            </Group>
            <Group title="Type">
              {(
                [
                  {
                    v: "solid",
                    label: "Solid",
                    href: "M3 3 H19 V19 H3 Z",
                  },
                  {
                    v: "hachure",
                    label: "Hachure",
                    href: "M3 5 L17 19 M5 3 L19 17 M3 13 L9 19 M13 3 L19 9",
                  },
                  {
                    v: "cross-hachure",
                    label: "Cross hachure",
                    href: "M3 5 L17 19 M5 3 L19 17 M3 13 L9 19 M13 3 L19 9 M17 3 L3 17 M19 5 L5 19 M9 3 L3 9 M19 13 L13 19",
                  },
                ] as const
              ).map(({ v, label, href }) => (
                <button
                  key={v}
                  className={`size-btn line-style-btn ${allFillStyle(v) ? "active" : ""}`}
                  aria-label={`Fill ${label}`}
                  data-tip={label}
                  onClick={() => apply({ fillStyle: v })}
                >
                  <svg width="22" height="22" viewBox="0 0 22 22">
                    <rect
                      x="3" y="3" width="16" height="16" rx="2"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    {v === "solid" ? (
                      <rect
                        x="4" y="4" width="14" height="14" rx="1.5"
                        fill="currentColor"
                        fillOpacity="0.35"
                      />
                    ) : (
                      <path
                        d={href}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                    )}
                  </svg>
                </button>
              ))}
            </Group>
          </Section>
        )}

        </div>
      <div ref={textRef} className={`panel-tab-content${effectiveTab === "text" ? "" : " hidden"}`}>
        <Group title="Text color">
            <ColorRampPicker
              current={textColorValue ?? "\u0000"}
              onPick={(textColor) => apply({ textColor })}
              label="Text color"
              kind="text"
              allowAuto
              autoColor={selected[0].strokeColor}
            />
          </Group>

          <Group title="Size">
            {FONT_SIZES.map((f) => (
              <button
                key={f.value}
                className={`size-btn text-btn ${allFont(f.value) ? "active" : ""}`}
                aria-label={`Font ${f.label} (${f.value}px)`}
                onClick={() => apply({ fontSize: f.value })}
              >
                {f.label}
              </button>
            ))}
          </Group>

          <Group title="Family">
            {FONT_FAMILIES.map((f) => (
              <button
                key={f.value}
                className={`size-btn ${
                  selected.every((el) => fontFamilyOf(el) === f.value)
                    ? "active"
                    : ""
                }`}
                aria-label={`Font ${f.label}`}
                data-tip={f.label}
                onClick={() => apply({ fontFamily: f.value })}
              >
                <svg width="16" height="16" viewBox="0 0 20 20">
                  <text
                    x="10"
                    y="15"
                    textAnchor="middle"
                    fontSize="12"
                    fill="currentColor"
                    style={{ fontFamily: f.value }}
                  >
                    {f.glyph}
                  </text>
                </svg>
              </button>
            ))}
          </Group>

          <Group title="Style">
            <div className="text-style-row">
              <button
                className={`size-btn text-btn ${allBold ? "active" : ""}`}
                aria-label="Bold"
                data-tip="Bold"
                onClick={() => apply({ bold: !allBold })}
              >
                <b>B</b>
              </button>
              <button
                className={`size-btn text-btn ${allItalic ? "active" : ""}`}
                aria-label="Italic"
                data-tip="Italic"
                onClick={() => apply({ italic: !allItalic })}
              >
                <i>I</i>
              </button>
              <button
                className={`size-btn text-btn ${allUnderline ? "active" : ""}`}
                aria-label="Underline"
                data-tip="Underline"
                onClick={() => apply({ underline: !allUnderline })}
              >
                <u>U</u>
              </button>
            </div>
          </Group>

          {(hasText || hasRectangle || hasDiamond || hasEllipse || hasArrow) && (
            <Group title="Horizontal alignment">
              {(["left", "center", "right"] as const).map((a) => (
                <button
                  key={a}
                  className={`size-btn ${allTextAlign(a) ? "active" : ""}`}
                  aria-label={`Alignment ${a}`}
                  data-tip={a === "left" ? "Left" : a === "center" ? "Center" : "Right"}
                  onClick={() => apply({ textAlign: a })}
                >
                  <svg width="16" height="12" viewBox="0 0 16 12">
                    {a === "left" && (
                      <>
                        <line x1="0" y1="1" x2="16" y2="1" stroke="currentColor" strokeWidth="2" />
                        <line x1="0" y1="5" x2="12" y2="5" stroke="currentColor" strokeWidth="2" />
                        <line x1="0" y1="9" x2="14" y2="9" stroke="currentColor" strokeWidth="2" />
                      </>
                    )}
                    {a === "center" && (
                      <>
                        <line x1="0" y1="1" x2="16" y2="1" stroke="currentColor" strokeWidth="2" />
                        <line x1="2" y1="5" x2="14" y2="5" stroke="currentColor" strokeWidth="2" />
                        <line x1="1" y1="9" x2="15" y2="9" stroke="currentColor" strokeWidth="2" />
                      </>
                    )}
                    {a === "right" && (
                      <>
                        <line x1="0" y1="1" x2="16" y2="1" stroke="currentColor" strokeWidth="2" />
                        <line x1="4" y1="5" x2="16" y2="5" stroke="currentColor" strokeWidth="2" />
                        <line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="2" />
                      </>
                    )}
                  </svg>
                </button>
              ))}
            </Group>
          )}

          {hasRectangle && (
            <Group title="Vertical position">
              {TEXT_VALIGNS.map((va) => (
                <button
                  key={va.value}
                  className={`size-btn ${allTextVAlign(va.value) ? "active" : ""}`}
                  aria-label={`Vertical ${va.label}`}
                  data-tip={va.label}
                  onClick={() => apply({ textVAlign: va.value })}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    {va.value === "top" && <rect x="4" y="4" width="8" height="2" rx="1" fill="currentColor" />}
                    {va.value === "middle" && <rect x="4" y="7" width="8" height="2" rx="1" fill="currentColor" />}
                    {va.value === "bottom" && <rect x="4" y="10" width="8" height="2" rx="1" fill="currentColor" />}
                  </svg>
                </button>
              ))}
            </Group>
          )}

          {hasContext && (
            <>
              <Group title="Label side">
                {LABEL_SIDES.map((sd) => (
                  <button
                    key={sd.value}
                    className={`size-btn ${allLabelSide(sd.value) ? "active" : ""}`}
                    aria-label={`Label ${sd.label}`}
                    data-tip={sd.label}
                    onClick={() => apply({ labelSide: sd.value })}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16">
                      <rect
                        x="3"
                        y="3"
                        width="10"
                        height="10"
                        rx="1.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      />
                      {sd.value === "internal" ? (
                        <>
                          <rect
                            x="3.6"
                            y="3.6"
                            width="8.8"
                            height="8.8"
                            rx="1"
                            fill="currentColor"
                            opacity="0.14"
                          />
                          <rect
                            x="4"
                            y="4"
                            width="5"
                            height="1.7"
                            rx="0.85"
                            fill="currentColor"
                          />
                        </>
                      ) : (
                        <rect
                          x="4"
                          y="0.5"
                          width="5"
                          height="1.7"
                          rx="0.85"
                          fill="currentColor"
                        />
                      )}
                    </svg>
                  </button>
                ))}
              </Group>
              <Group title="Label position">
                {LABEL_POSITIONS.map((lp) => {
                  const inside = (selected[0] as any).labelSide === "internal";
                  const bars: Record<string, { x: number; y: number }> = {
                    "top-left": inside ? { x: 3.8, y: 3.9 } : { x: 3, y: 1.4 },
                    "top-right": inside ? { x: 7.2, y: 3.9 } : { x: 7, y: 1.4 },
                    "bottom-left": inside ? { x: 3.8, y: 10.5 } : { x: 3, y: 13.6 },
                    "bottom-right": inside ? { x: 7.2, y: 10.5 } : { x: 7, y: 13.6 },
                  };
                  const bar = bars[lp.value];
                  return (
                    <button
                      key={lp.value}
                      className={`size-btn ${allLabelPos(lp.value) ? "active" : ""}`}
                      aria-label={`Label ${lp.label}`}
                      data-tip={lp.label}
                      onClick={() => apply({ labelPosition: lp.value })}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16">
                        <rect
                          x="3"
                          y="3"
                          width="10"
                          height="10"
                          rx="1.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.2"
                        />
                        {inside && (
                          <rect
                            x="3.6"
                            y="3.6"
                            width="8.8"
                            height="8.8"
                            rx="1"
                            fill="currentColor"
                            opacity="0.12"
                          />
                        )}
                        <rect
                          x={bar.x}
                          y={bar.y}
                          width="5"
                          height="1.7"
                          rx="0.85"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                  );
                })}
              </Group>
            </>
          )}

          <Group title="Line spacing">
            <MiniSlider
              value={lineSpacingValue ?? 1.25}
              min={0.8}
              max={2.5}
              step={0.05}
              ariaLabel="Line spacing"
              suffix="%"
              displayValue={Math.round(((lineSpacingValue ?? 1.25) - 0.8) / 1.7 * 100)}
              onChange={(v) => apply({ lineSpacing: v })}
            />
          </Group>

          {hasCaption && (
            <Group title="Caption position">
              {CAPTION_POSITIONS.map((cp) => (
                <button
                  key={cp.value}
                  className={`size-btn ${allCaptionPos(cp.value) ? "active" : ""}`}
                  aria-label={`Caption ${cp.label}`}
                  data-tip={cp.label}
                  onClick={() => apply({ captionPosition: cp.value })}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <rect x="2" y="2" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    {cp.value === "bottom" && <rect x="4" y="10" width="8" height="2" rx="1" fill="currentColor" />}
                    {cp.value === "top" && <rect x="4" y="4" width="8" height="2" rx="1" fill="currentColor" />}
                    {cp.value === "left" && <rect x="2" y="7" width="6" height="2" rx="1" fill="currentColor" />}
                    {cp.value === "right" && <rect x="8" y="7" width="6" height="2" rx="1" fill="currentColor" />}
                  </svg>
                </button>
              ))}
            </Group>
          )}

          {(hasCaption || hasRectangle || hasDiamond || hasEllipse || hasContext) && (
            <Group title="Text offset (px)" vertical>
                <SpacingRow
                  label="Global"
                  value={unifiedOffset(hasCaption && !hasRectangle && !hasDiamond && !hasEllipse && !hasContext ? "captionGap" : "textOffsetGlobal", hasCaption && !hasRectangle && !hasDiamond && !hasEllipse && !hasContext ? 2 : 8)}
                  onChange={(v) => {
                    const patch: Record<string, number> = {};
                    if (hasCaption) patch.captionGap = v;
                    if (hasRectangle || hasDiamond || hasEllipse) patch.textOffsetGlobal = v;
                    if (hasContext) patch.textOffsetGlobal = v;
                    apply(patch);
                  }}
                />
                <SpacingRow
                  label="Left"
                  value={unifiedOffset(hasCaption && !hasRectangle && !hasDiamond && !hasEllipse && !hasContext ? "captionOffsetLeft" : "textOffsetLeft", 0)}
                  onChange={(v) => {
                    const patch: Record<string, number> = {};
                    if (hasCaption) patch.captionOffsetLeft = v;
                    if (hasRectangle || hasDiamond || hasEllipse) patch.textOffsetLeft = v;
                    if (hasContext) patch.textOffsetLeft = v;
                    apply(patch);
                  }}
                />
                <SpacingRow
                  label="Right"
                  value={unifiedOffset(hasCaption && !hasRectangle && !hasDiamond && !hasEllipse && !hasContext ? "captionOffsetRight" : "textOffsetRight", 0)}
                  onChange={(v) => {
                    const patch: Record<string, number> = {};
                    if (hasCaption) patch.captionOffsetRight = v;
                    if (hasRectangle || hasDiamond || hasEllipse) patch.textOffsetRight = v;
                    if (hasContext) patch.textOffsetRight = v;
                    apply(patch);
                  }}
                />
                <SpacingRow
                  label="Top"
                  value={unifiedOffset(hasCaption && !hasRectangle && !hasDiamond && !hasEllipse && !hasContext ? "captionOffsetTop" : "textOffsetTop", 0)}
                  onChange={(v) => {
                    const patch: Record<string, number> = {};
                    if (hasCaption) patch.captionOffsetTop = v;
                    if (hasRectangle || hasDiamond || hasEllipse) patch.textOffsetTop = v;
                    if (hasContext) patch.textOffsetTop = v;
                    apply(patch);
                  }}
                />
                <SpacingRow
                  label="Bottom"
                  value={unifiedOffset(hasCaption && !hasRectangle && !hasDiamond && !hasEllipse && !hasContext ? "captionOffsetBottom" : "textOffsetBottom", 0)}
                  onChange={(v) => {
                    const patch: Record<string, number> = {};
                    if (hasCaption) patch.captionOffsetBottom = v;
                    if (hasRectangle || hasDiamond || hasEllipse) patch.textOffsetBottom = v;
                    if (hasContext) patch.textOffsetBottom = v;
                    apply(patch);
                  }}
                />
              </Group>
          )}
      </div>
      <div ref={layersRef} className={`panel-tab-content${effectiveTab === "layers" ? "" : " hidden"}`}>
        <Group title="Order">
            <div className="layer-btns">
              <button
                className="size-btn"
                data-tip="Bring to front"
                aria-label="Bring to front"
                onClick={() => editor.bringToFront()}
              >
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <rect x="1" y="5" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                  <rect x="5" y="1" width="7" height="7" rx="1" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </button>
              <button
                className="size-btn"
                data-tip="Move forward"
                aria-label="Move forward"
                onClick={() => editor.bringForward()}
              >
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <rect x="1" y="6" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                  <rect x="5" y="2" width="6" height="6" rx="1" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 10 L10 8 L12 10" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </button>
              <button
                className="size-btn"
                data-tip="Move backward"
                aria-label="Move backward"
                onClick={() => editor.sendBackward()}
              >
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <rect x="5" y="1" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                  <rect x="1" y="6" width="6" height="6" rx="1" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 6 L10 8 L12 6" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </button>
              <button
                className="size-btn"
                data-tip="Send to back"
                aria-label="Send to back"
                onClick={() => editor.sendToBack()}
              >
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <rect x="5" y="1" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                  <rect x="1" y="5" width="7" height="7" rx="1" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </button>
            </div>
          </Group>

          <Group title="Group">
            <div className="layer-btns">
              <button
                className="size-btn"
                data-tip="Group"
                aria-label="Group"
                disabled={selected.length < 2}
                onClick={() => editor.groupSelected()}
              >
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <rect x="1.5" y="1.5" width="13" height="13" rx="1" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" opacity="0.6"/>
                  <rect x="4" y="4" width="5" height="5" rx="0.5" fill="currentColor" opacity="0.3"/>
                  <rect x="7" y="7" width="5" height="5" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.2"/>
                </svg>
              </button>
              <button
                className="size-btn"
                data-tip="Ungroup"
                aria-label="Ungroup"
                disabled={!selected.some((el) => el.groupId)}
                onClick={() => editor.ungroupSelected()}
              >
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" opacity="0.4"/>
                  <rect x="9" y="9" width="5.5" height="5.5" rx="1" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" opacity="0.4"/>
                  <rect x="4" y="4" width="5" height="5" rx="0.5" fill="currentColor" opacity="0.3"/>
                  <rect x="7" y="7" width="5" height="5" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.2"/>
                </svg>
              </button>
            </div>
          </Group>

          <Group title="Lock">
            <div className="layer-btns">
              <button
                className="size-btn"
                data-tip={selected.every((el) => el.locked) ? "Unlock" : "Lock"}
                aria-label={selected.every((el) => el.locked) ? "Unlock" : "Lock"}
                onClick={() => editor.toggleLockSelected()}
              >
                {selected.every((el) => el.locked) ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                )}
              </button>
            </div>
          </Group>

          <Group title="Align horizontal">
            <div className="layer-btns">
              <button className="size-btn" data-tip="Align left" aria-label="Align left"
                disabled={selected.length < 2}
                onClick={() => editor.alignSelected("left")}>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <line x1="2" y1="1" x2="2" y2="15" stroke="currentColor" strokeWidth="2"/>
                  <rect x="2" y="2" width="10" height="4" rx="1" fill="currentColor" opacity="0.3"/>
                  <rect x="2" y="9" width="7" height="4" rx="1" fill="currentColor" opacity="0.3"/>
                </svg>
              </button>
              <button className="size-btn" data-tip="Align center" aria-label="Align center"
                disabled={selected.length < 2}
                onClick={() => editor.alignSelected("center")}>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <line x1="8" y1="1" x2="8" y2="15" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2"/>
                  <rect x="2" y="2" width="12" height="4" rx="1" fill="currentColor" opacity="0.3"/>
                  <rect x="3" y="9" width="10" height="4" rx="1" fill="currentColor" opacity="0.3"/>
                </svg>
              </button>
              <button className="size-btn" data-tip="Align right" aria-label="Align right"
                disabled={selected.length < 2}
                onClick={() => editor.alignSelected("right")}>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <line x1="14" y1="1" x2="14" y2="15" stroke="currentColor" strokeWidth="2"/>
                  <rect x="4" y="2" width="10" height="4" rx="1" fill="currentColor" opacity="0.3"/>
                  <rect x="7" y="9" width="7" height="4" rx="1" fill="currentColor" opacity="0.3"/>
                </svg>
              </button>
            </div>
          </Group>

          <Group title="Align vertical">
            <div className="layer-btns">
              <button className="size-btn" data-tip="Align top" aria-label="Align top"
                disabled={selected.length < 2}
                onClick={() => editor.alignSelected("top")}>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <line x1="1" y1="2" x2="15" y2="2" stroke="currentColor" strokeWidth="2"/>
                  <rect x="2" y="2" width="4" height="10" rx="1" fill="currentColor" opacity="0.3"/>
                  <rect x="9" y="2" width="4" height="7" rx="1" fill="currentColor" opacity="0.3"/>
                </svg>
              </button>
              <button className="size-btn" data-tip="Align middle" aria-label="Align middle"
                disabled={selected.length < 2}
                onClick={() => editor.alignSelected("middle")}>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2"/>
                  <rect x="2" y="2" width="4" height="12" rx="1" fill="currentColor" opacity="0.3"/>
                  <rect x="9" y="3" width="4" height="10" rx="1" fill="currentColor" opacity="0.3"/>
                </svg>
              </button>
              <button className="size-btn" data-tip="Align bottom" aria-label="Align bottom"
                disabled={selected.length < 2}
                onClick={() => editor.alignSelected("bottom")}>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <line x1="1" y1="14" x2="15" y2="14" stroke="currentColor" strokeWidth="2"/>
                  <rect x="2" y="4" width="4" height="10" rx="1" fill="currentColor" opacity="0.3"/>
                  <rect x="9" y="7" width="4" height="7" rx="1" fill="currentColor" opacity="0.3"/>
                </svg>
              </button>
            </div>
          </Group>

          <Group title="Distribute">
            <div className="layer-btns">
              <button className="size-btn" data-tip="Distribute horizontally" aria-label="Distribute horizontally"
                disabled={selected.length < 3}
                onClick={() => editor.distributeSelected("horizontal")}>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <line x1="1" y1="1" x2="1" y2="15" stroke="currentColor" strokeWidth="2"/>
                  <line x1="15" y1="1" x2="15" y2="15" stroke="currentColor" strokeWidth="2"/>
                  <rect x="5" y="3" width="2" height="10" rx="0.5" fill="currentColor" opacity="0.5"/>
                  <rect x="9" y="3" width="2" height="10" rx="0.5" fill="currentColor" opacity="0.5"/>
                </svg>
              </button>
              <button className="size-btn" data-tip="Distribute vertically" aria-label="Distribute vertically"
                disabled={selected.length < 3}
                onClick={() => editor.distributeSelected("vertical")}>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <line x1="1" y1="1" x2="15" y2="1" stroke="currentColor" strokeWidth="2"/>
                  <line x1="1" y1="15" x2="15" y2="15" stroke="currentColor" strokeWidth="2"/>
                  <rect x="3" y="5" width="10" height="2" rx="0.5" fill="currentColor" opacity="0.5"/>
                  <rect x="3" y="9" width="10" height="2" rx="0.5" fill="currentColor" opacity="0.5"/>
                </svg>
              </button>
            </div>
          </Group>
      </div>
    </div>
  );
}
