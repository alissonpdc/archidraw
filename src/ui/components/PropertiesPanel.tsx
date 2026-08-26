import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { editor, useEditor } from "../hooks/useEditor";

/** 9 cores básicas compartilhadas por traço e preenchimento */
const BASE_COLORS: { name: string; color: string }[] = [
  { name: "Cinza", color: "#868e96" },
  { name: "Vermelho", color: "#e03131" },
  { name: "Laranja", color: "#f08c00" },
  { name: "Amarelo", color: "#f5c518" },
  { name: "Verde", color: "#2f9e44" },
  { name: "Ciano", color: "#0c8599" },
  { name: "Azul", color: "#1971c2" },
  { name: "Roxo", color: "#6741d9" },
  { name: "Rosa", color: "#d6336c" },
];

const STROKE_WIDTHS = [1, 2, 4, 8] as const;
const FONT_SIZES = [16, 20, 28, 36];

type Patch = Partial<{
  strokeColor: string;
  backgroundColor: string;
  strokeWidth: number;
  opacity: number;
  fontSize: number;
  strokeStyle: "solid" | "dashed" | "dotted" | "dashdot";
  roughness: 0 | 1 | 2 | 3;
  borderRadius: number;
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

/** 5 intensidades da cor (claro → escuro), com a cor original no meio */
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
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel-group">
      <div className="panel-subtitle">{title}</div>
      <div className="panel-group-body">{children}</div>
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

  useEffect(() => {
    if (expanded === null) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setExpanded(null);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [expanded]);

  const expandedShades =
    expanded !== null && expanded > 0
      ? shadesOf(BASE_COLORS[expanded - 1].color)
      : null;
  const col = expanded !== null ? expanded % PALETTE_COLS : 0;
  const popoverLeft = Math.max(0, col * SWATCH_STEP - 65);

  return (
    <div className="palette-wrap" ref={wrapRef}>
      <div className="swatch-row swatch-row-5">
        <button
          className={`swatch transparent-checker ${
            current === "transparent" ? "active" : ""
          }`}
          aria-label={`${label} Transparente`}
          data-tip="Transparente"
          onClick={() => {
            setExpanded(null);
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
            onClick={() => setExpanded(expanded === i + 1 ? null : i + 1)}
          />
        ))}
      </div>
      {expandedShades && (
        <div
          className="color-popover"
          style={{ left: popoverLeft }}
          role="menu"
          aria-label={`${label} intensidades`}
        >
          <div className="swatch-shade-row">
            {expandedShades.map((shade, i) => (
              <button
                key={shade}
                className={`swatch ${current === shade ? "active" : ""}`}
                style={{ background: shade }}
                aria-label={`${label} intensidade ${i + 1}`}
                data-tip={shade.toUpperCase()}
                onClick={() => {
                  onPick(shade);
                  setExpanded(null);
                }}
              />
            ))}
          </div>
        </div>
      )}
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
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  ariaLabel: string;
  suffix?: string;
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
        {value}
        {suffix}
      </span>
    </div>
  );
}

export function PropertiesPanel() {
  const snap = useEditor();
  const [tip, setTip] = useState<TipState | null>(null);
  const selected = snap.doc.elements.filter((el) =>
    snap.selectedIds.has(el.id),
  );

  if (selected.length === 0) return null;

  // event-delegated tooltips: [data-tip] inside the panel renders in a
  // fixed-position portal layer, so overflow never clips them
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
  const allStroke = (v: number) => selected.every((el) => el.strokeWidth === v);
  const allStyle = (v: string) =>
    selected.every((el) => el.strokeStyle === v);
  const allRoughness = (v: number) =>
    selected.every((el) => el.roughness === v);
  const allFont = (v: number) =>
    selected
      .filter((el) => el.type === "text")
      .every((el) => el.type === "text" && el.fontSize === v);

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

  return (
    <div
      className="properties-panel"
      onMouseOver={showTip}
      onMouseLeave={() => setTip(null)}
      onScroll={() => setTip(null)}
    >
      <PanelTooltip tip={tip} />
      <Group title="Traço">
        <PaletteGrid
          current={selected[0].strokeColor}
          onPick={(strokeColor) => apply({ strokeColor })}
          label="Cor de traço"
        />
      </Group>

      <Group title="Preenchimento">
        <PaletteGrid
          current={selected[0].backgroundColor}
          onPick={(backgroundColor) => apply({ backgroundColor })}
          label="Preenchimento"
        />
      </Group>

      <Group title="Opacidade">
        <MiniSlider
          value={opacityValue ?? 100}
          min={0}
          max={100}
          step={5}
          ariaLabel="Opacidade"
          onChange={(v) => apply({ opacity: v / 100 })}
        />
      </Group>

      {hasShape && (
        <>
          <Group title="Tipo de linha">
            {(["solid", "dashed", "dotted", "dashdot"] as const).map((s) => (
              <button
                key={s}
                className={`size-btn line-style-btn ${allStyle(s) ? "active" : ""}`}
                aria-label={`Linha ${s}`}
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

          <Group title="Estilo do traço">
            {(
              [
                {
                  v: 0,
                  label: "Arquiteto",
                  paths: ["M2 7 L18 7"],
                },
                {
                  v: 1,
                  label: "Rascunho",
                  paths: [
                    "M2.5 7 C6 5.8 12 8.4 17.5 6.8",
                    "M3 7.6 C7 8.6 13 6.2 17 8",
                  ],
                },
                {
                  v: 2,
                  label: "Rabisco",
                  paths: [
                    "M2 8 C6 4 12 10 18 6",
                    "M2.5 6.5 C7 9.5 12 4.5 17.5 8",
                    "M3 7 C8 6 11 8.5 16.5 6.8",
                  ],
                },
                {
                  v: 3,
                  label: "Caos",
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
                aria-label={`Seriedade ${label}`}
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

      <Group title="Espessura">
        {STROKE_WIDTHS.map((w) => (
          <button
            key={w}
            className={`size-btn ${allStroke(w) ? "active" : ""}`}
            aria-label={`Espessura ${w}`}
            onClick={() => apply({ strokeWidth: w })}
          >
            <span className="thickness-preview" style={{ height: w + 1 }} />
          </button>
        ))}
      </Group>

      {hasShape && (
        <Group title="Bordas">
          <div className="v-stack">
            <div className="border-presets">
            <button
              className={`size-btn border-preset-btn tip-up ${
                radiusValue === 0 ? "active" : ""
              }`}
              aria-label="Bordas quadradas"
              data-tip="Quadrada"
              onClick={() => apply({ borderRadius: 0 })}
            >
              <span className="corner-preview square" />
            </button>
            <button
              className={`size-btn border-preset-btn tip-up ${
                radiusValue === 100 ? "active" : ""
              }`}
              aria-label="Bordas arredondadas"
              data-tip="Arredondada"
              onClick={() => apply({ borderRadius: 100 })}
            >
              <span className="corner-preview round" />
            </button>
            <button
              className={`size-btn border-preset-btn tip-up ${isCustomRadius ? "active" : ""}`}
              aria-label="Bordas personalizadas"
              data-tip="Personalizada"
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
                ariaLabel="Arredondamento personalizado"
                onChange={(v) => apply({ borderRadius: v })}
              />
            )}
          </div>
        </Group>
      )}

      {hasText && (
        <Group title="Fonte">
          {FONT_SIZES.map((f) => (
            <button
              key={f}
              className={`size-btn text-btn ${allFont(f) ? "active" : ""}`}
              aria-label={`Fonte ${f}px`}
              style={{ fontSize: Math.max(10, f / 2 - 2) }}
              onClick={() => apply({ fontSize: f })}
            >
              Aa
            </button>
          ))}
        </Group>
      )}
    </div>
  );
}
