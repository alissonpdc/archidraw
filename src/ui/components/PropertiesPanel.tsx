import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { editor, useEditor } from "../hooks/useEditor";

/** 9 basic colors shared by stroke and fill */
const BASE_COLORS: { name: string; color: string }[] = [
  { name: "Grey", color: "#868e96" },
  { name: "Red", color: "#e03131" },
  { name: "Orange", color: "#f08c00" },
  { name: "Yellow", color: "#f5c518" },
  { name: "Green", color: "#2f9e44" },
  { name: "Cyan", color: "#0c8599" },
  { name: "Blue", color: "#1971c2" },
  { name: "Purple", color: "#6741d9" },
  { name: "Pink", color: "#d6336c" },
];

const STROKE_WIDTHS = [1, 2, 4, 8] as const;
const FONT_SIZES = [16, 20, 28, 36];
const FONT_FAMILIES = [
  { label: "Sans", value: '"Segoe UI", system-ui, sans-serif', iconPath: "M4 5h12M4 10h10M4 15h7" },
  { label: "Sketch", value: '"Architects Daughter", cursive', iconPath: "M3 17L13 7l4-4M5 15l-2 4 4-2M11 9l4 4" },
  { label: "Serif", value: 'Georgia, "Times New Roman", serif', iconPath: "M4 5h1v10H4zM7 5h6v2H7zM7 13h6v2H7zM13 5h1v10h-1z" },
  { label: "Consolas", value: 'Consolas, "SF Mono", monospace', iconPath: "M3 5l5 5-5 5M9 15h8" },
];
const CAPTION_POSITIONS = [
  { label: "Bottom", value: "bottom" as const },
  { label: "Top", value: "top" as const },
  { label: "Left", value: "left" as const },
  { label: "Right", value: "right" as const },
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
  fontSize: number;
  strokeStyle: "solid" | "dashed" | "dotted" | "dashdot";
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
  textPadding: number;
  captionPosition: "top" | "bottom" | "left" | "right";
  captionGap: number;
  captionOffsetTop: number;
  captionOffsetBottom: number;
  captionOffsetLeft: number;
  captionOffsetRight: number;
  lineType: "straight" | "curved" | "auto";
}>;

// ---- color helpers -----------------------------------------------------

function hexToHsl(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    Math.round(
      255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))),
    );
  return (
    "#" +
    [f(0), f(8), f(4)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

/** 5 shades of the color (light → dark), with original color in the middle */
function shadesOf(hex: string): string[] {
  const [h, s] = hexToHsl(hex);
  const sat = Math.max(s, 8);
  return [
    hslToHex(h, sat * 0.55, 92),
    hslToHex(h, sat * 0.75, 78),
    hex,
    hslToHex(h, sat, 42),
    hslToHex(h, sat, 26),
  ];
}

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

const PALETTE_COLS = 5;
const SWATCH_STEP = 28; // 24px swatch + 4px gap

function PaletteGrid({
  current,
  onPick,
  label,
}: {
  current: string;
  onPick: (color: string) => void;
  label: string;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [popPos, setPopPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (expanded === null) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!wrapRef.current?.contains(t) && !t.closest(".color-popover--portal")) setExpanded(null);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [expanded]);

  const expandedShades =
    expanded !== null && expanded > 0
      ? shadesOf(BASE_COLORS[expanded - 1].color)
      : null;

  const handleSwatchClick = (i: number, e: React.MouseEvent<HTMLButtonElement>) => {
    if (expanded === i + 1) {
      setExpanded(null);
      setPopPos(null);
    } else {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const popoverW = PALETTE_COLS * SWATCH_STEP + 8;
      let x = rect.left;
      if (x + popoverW > window.innerWidth - 8) x = window.innerWidth - popoverW - 8;
      if (x < 8) x = 8;
      setPopPos({ x, y: rect.bottom + 6 });
      setExpanded(i + 1);
    }
  };

  return (
    <div className="palette-wrap" ref={wrapRef}>
      <div className="swatch-row swatch-row-5">
        <button
          className={`swatch transparent-checker ${
            current === "transparent" ? "active" : ""
          }`}
          aria-label={`${label} Transparent`}
          data-tip="Transparent"
          onClick={() => {
            setExpanded(null);
            setPopPos(null);
            onPick("transparent");
          }}
        />
        {BASE_COLORS.map((entry, i) => (
          <button
            key={entry.name}
            className={`swatch ${
              current === entry.color ||
              (expandedShades?.includes(current) && expanded === i + 1)
                ? "active"
                : ""
            }`}
            style={{ background: entry.color }}
            aria-label={`${label} ${entry.name}`}
            data-tip={entry.name}
            onClick={(e) => handleSwatchClick(i, e)}
          />
        ))}
      </div>
      {expandedShades && popPos && createPortal(
        <div
          className="color-popover color-popover--portal"
          style={{ left: popPos.x, top: popPos.y }}
          role="menu"
          aria-label={`${label} shades`}
        >
          <div className="swatch-shade-row">
            {expandedShades.map((shade, i) => (
              <button
                key={shade}
                className={`swatch ${current === shade ? "active" : ""}`}
                style={{ background: shade }}
                aria-label={`${label} shade ${i + 1}`}
                data-tip={shade.toUpperCase()}
                onClick={() => {
                  onPick(shade);
                  setExpanded(null);
                  setPopPos(null);
                }}
              />
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function SpacingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="spacing-row">
      <span className="spacing-label">{label}</span>
      <button
        className="spacing-btn"
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        −
      </button>
      <input
        className="spacing-input"
        type="number"
        min={0}
        max={50}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) onChange(Math.max(0, Math.min(50, v)));
        }}
      />
      <button
        className="spacing-btn"
        aria-label={`Increase ${label}`}
        onClick={() => onChange(Math.min(50, value + 1))}
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
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="radius-slider-wrap">
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
        style={{ left: `calc(${pct}% + ${(0.5 - pct / 100) * 12}px)` }}
      >
        {displayValue ?? value}
        {suffix}
      </span>
    </div>
  );
}

export function PropertiesPanel() {
  const snap = useEditor();
  const [tip, setTip] = useState<TipState | null>(null);
  const [activeTab, setActiveTab] = useState<"style" | "text" | "layers">("style");
  const [maxTabHeight, setMaxTabHeight] = useState<number | null>(null);
  const maxTabHeightRef = useRef<number | null>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement>(null);
  const selected = snap.doc.elements.filter((el) =>
    snap.selectedIds.has(el.id),
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  });

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
      el.type === "rectangle" || el.type === "arrow" || el.type === "component",
  );
  const hasComponent = selected.some((el) => el.type === "component");
  const hasRectangle = selected.some((el) => el.type === "rectangle");
  const hasArrow = selected.some((el) => el.type === "arrow");
  const isOnlyText = selected.length > 0 && selected.every((el) => el.type === "text");

  // auto-switch away from Style tab when only text is selected
  const effectiveTab = isOnlyText && activeTab === "style" ? "text" : activeTab;

  const allStroke = (v: number) => selected.every((el) => el.strokeWidth === v);
  const allStyle = (v: string) =>
    selected.every((el) => el.strokeStyle === v);
  const allRoughness = (v: number) =>
    selected.every((el) => el.roughness === v);
  const allLineType = (v: string) =>
    selected.every((el) => (el.type === "arrow" ? (el.lineType ?? "straight") : v) === v);
  const allFont = (v: number) => {
    const textEls = selected.filter((el) => el.type === "text");
    return textEls.length > 0 && textEls.every((el) => el.type === "text" && el.fontSize === v);
  };

  const opacityValue = (() => {
    const first = Math.round(selected[0].opacity * 100);
    return selected.every((el) => Math.round(el.opacity * 100) === first)
      ? first
      : null;
  })();
  const radiusValue = (() => {
    const rects = selected.filter((el) => el.type === "rectangle");
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
            className={`panel-tab ${effectiveTab === "style" ? "active" : ""}`}
            onClick={() => setActiveTab("style")}
          >
            Style
          </button>
        )}
        <button
          className={`panel-tab ${effectiveTab === "text" ? "active" : ""}`}
          onClick={() => setActiveTab("text")}
        >
          Text
        </button>
        <button
          className={`panel-tab ${effectiveTab === "layers" ? "active" : ""}`}
          onClick={() => setActiveTab("layers")}
        >
          Layers
        </button>
      </div>

      <div ref={styleRef} className={`panel-tab-content${effectiveTab === "style" ? "" : " hidden"}`}>
        <Group title="Stroke">
          <PaletteGrid
            current={selected[0].strokeColor}
            onPick={(strokeColor) => apply({ strokeColor })}
            label="Stroke color"
          />
        </Group>

          <Group title="Fill">
            <PaletteGrid
              current={selected[0].backgroundColor}
              onPick={(backgroundColor) => apply({ backgroundColor })}
              label="Fill"
            />
          </Group>

          <Group title="Opacity">
            <MiniSlider
              value={opacityValue ?? 100}
              min={0}
              max={100}
              step={5}
              ariaLabel="Opacity"
              onChange={(v) => apply({ opacity: v / 100 })}
            />
          </Group>

          {hasShape && (
            <>
              <Group title="Line type">
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

              <Group title="Stroke style">
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
            </>
          )}

          {hasArrow && (
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

          {hasShape && !hasArrow && (
            <Group title="Borders">
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
      </div>
      <div ref={textRef} className={`panel-tab-content${effectiveTab === "text" ? "" : " hidden"}`}>
        <Group title="Text color">
            <PaletteGrid
              current={textColorValue || selected[0].strokeColor}
              onPick={(textColor) => apply({ textColor })}
              label="Text color"
            />
          </Group>

          <Group title="Opacity">
            <MiniSlider
              value={opacityValue ?? 100}
              min={0}
              max={100}
              step={5}
              ariaLabel="Opacity"
              onChange={(v) => apply({ opacity: v / 100 })}
            />
          </Group>

          <Group title="Size">
            {FONT_SIZES.map((f) => (
              <button
                key={f}
                className={`size-btn text-btn ${allFont(f) ? "active" : ""}`}
                aria-label={`Font ${f}px`}
                style={{ fontSize: Math.max(10, f / 2 - 2) }}
                onClick={() => apply({ fontSize: f })}
              >
                Aa
              </button>
            ))}
          </Group>

          <Group title="Family">
            {FONT_FAMILIES.map((f) => (
              <button
                key={f.value}
                className={`size-btn ${
                  selected.every((el) => (el.fontFamily || FONT_FAMILIES[0].value) === f.value)
                    ? "active"
                    : ""
                }`}
                aria-label={`Font ${f.label}`}
                data-tip={f.label}
                onClick={() => apply({ fontFamily: f.value })}
              >
                <svg width="16" height="16" viewBox="0 0 20 20">
                  <path d={f.iconPath} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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

          {(hasText || hasRectangle || hasArrow) && (
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

          {hasComponent && (
            <>
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

              <Group title="Text offset (px)" vertical>
                <SpacingRow
                  label="Global"
                  value={selected[0].captionGap ?? 2}
                  onChange={(v) => apply({ captionGap: v })}
                />
                <SpacingRow
                  label="Left"
                  value={selected[0].captionOffsetLeft ?? 0}
                  onChange={(v) => apply({ captionOffsetLeft: v })}
                />
                <SpacingRow
                  label="Right"
                  value={selected[0].captionOffsetRight ?? 0}
                  onChange={(v) => apply({ captionOffsetRight: v })}
                />
                <SpacingRow
                  label="Top"
                  value={selected[0].captionOffsetTop ?? 0}
                  onChange={(v) => apply({ captionOffsetTop: v })}
                />
                <SpacingRow
                  label="Bottom"
                  value={selected[0].captionOffsetBottom ?? 0}
                  onChange={(v) => apply({ captionOffsetBottom: v })}
                />
              </Group>
            </>
          )}

          {hasRectangle && (
            <>
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

              <Group title="Offset">
                <MiniSlider
                  value={selected[0].textPadding ?? 8}
                  min={0}
                  max={40}
                  step={1}
                  ariaLabel="Text offset"
                  suffix="px"
                  onChange={(v) => apply({ textPadding: v })}
                />
              </Group>
            </>
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

          {selected.length >= 2 && (
            <Group title="Align">
              <div className="layer-btns">
                <button className="size-btn" data-tip="Align left" aria-label="Align left"
                  onClick={() => editor.alignSelected("left")}>
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <line x1="2" y1="1" x2="2" y2="15" stroke="currentColor" strokeWidth="2"/>
                    <rect x="2" y="2" width="10" height="4" rx="1" fill="currentColor" opacity="0.3"/>
                    <rect x="2" y="9" width="7" height="4" rx="1" fill="currentColor" opacity="0.3"/>
                  </svg>
                </button>
                <button className="size-btn" data-tip="Align center" aria-label="Align center"
                  onClick={() => editor.alignSelected("center")}>
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <line x1="8" y1="1" x2="8" y2="15" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2"/>
                    <rect x="2" y="2" width="12" height="4" rx="1" fill="currentColor" opacity="0.3"/>
                    <rect x="3" y="9" width="10" height="4" rx="1" fill="currentColor" opacity="0.3"/>
                  </svg>
                </button>
                <button className="size-btn" data-tip="Align right" aria-label="Align right"
                  onClick={() => editor.alignSelected("right")}>
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <line x1="14" y1="1" x2="14" y2="15" stroke="currentColor" strokeWidth="2"/>
                    <rect x="4" y="2" width="10" height="4" rx="1" fill="currentColor" opacity="0.3"/>
                    <rect x="7" y="9" width="7" height="4" rx="1" fill="currentColor" opacity="0.3"/>
                  </svg>
                </button>
              </div>
              <div className="layer-btns">
                <button className="size-btn" data-tip="Align top" aria-label="Align top"
                  onClick={() => editor.alignSelected("top")}>
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <line x1="1" y1="2" x2="15" y2="2" stroke="currentColor" strokeWidth="2"/>
                    <rect x="2" y="2" width="4" height="10" rx="1" fill="currentColor" opacity="0.3"/>
                    <rect x="9" y="2" width="4" height="7" rx="1" fill="currentColor" opacity="0.3"/>
                  </svg>
                </button>
                <button className="size-btn" data-tip="Align middle" aria-label="Align middle"
                  onClick={() => editor.alignSelected("middle")}>
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2"/>
                    <rect x="2" y="2" width="4" height="12" rx="1" fill="currentColor" opacity="0.3"/>
                    <rect x="9" y="3" width="4" height="10" rx="1" fill="currentColor" opacity="0.3"/>
                  </svg>
                </button>
                <button className="size-btn" data-tip="Align bottom" aria-label="Align bottom"
                  onClick={() => editor.alignSelected("bottom")}>
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <line x1="1" y1="14" x2="15" y2="14" stroke="currentColor" strokeWidth="2"/>
                    <rect x="2" y="4" width="4" height="10" rx="1" fill="currentColor" opacity="0.3"/>
                    <rect x="9" y="7" width="4" height="7" rx="1" fill="currentColor" opacity="0.3"/>
                  </svg>
                </button>
              </div>
            </Group>
          )}
      </div>
    </div>
  );
}
