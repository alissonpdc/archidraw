import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Color picker with base + intensity model (design/color-palette-options/02):
 * a current-color chip, a row of 8 base dots, and a popover with the 5
 * intensities of the chosen base plus a live preview and the opacity slider.
 * Text mode adds an "Auto" dot that clears the color to follow the stroke.
 */

export const BASE_COLORS: { name: string; color: string }[] = [
  { name: "Grey", color: "#868e96" },
  { name: "Red", color: "#e03131" },
  { name: "Orange", color: "#f08c00" },
  { name: "Yellow", color: "#f5c518" },
  { name: "Green", color: "#2f9e44" },
  { name: "Blue", color: "#1971c2" },
  { name: "Purple", color: "#6741d9" },
  { name: "Pink", color: "#d6336c" },
];

const POP_WIDTH = 232;
/** sentinel for "some selected elements disagree" coming from the panel */
const MIXED = "\u0000";
/** sentinel for "no explicit color" (text follows the stroke) */
const AUTO = "";

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
export function shadesOf(hex: string): string[] {
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

function locate(hex: string): { base: number; intensity: number } | null {
  for (let i = 0; i < BASE_COLORS.length; i++) {
    const idx = shadesOf(BASE_COLORS[i].color).indexOf(hex);
    if (idx !== -1) return { base: i, intensity: idx };
  }
  return null;
}

function inkClass(hex: string): string {
  const [, , l] = hexToHsl(hex);
  return l < 60 ? "ink-dark" : "ink-light";
}

export type PickerKind = "stroke" | "fill" | "text";

/** escape the color before embedding it into the preview SVG markup */
function svgSafe(color: string): string {
  return color.replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function previewSvg(kind: PickerKind, color: string): string {
  const c = svgSafe(color);
  if (kind === "stroke") {
    return `<svg width="84" height="44" viewBox="0 0 84 44"><rect x="4" y="4" width="76" height="36" rx="5" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round"/></svg>`;
  }
  if (kind === "fill") {
    return `<svg width="84" height="44" viewBox="0 0 84 44"><rect x="4" y="4" width="76" height="36" rx="5" fill="${c}" stroke="var(--element-stroke)" stroke-width="2"/></svg>`;
  }
  return `<svg width="84" height="44" viewBox="0 0 84 44"><text x="42" y="29" text-anchor="middle" fill="${c}" style="font-family: var(--font-ui)" font-size="20" font-weight="600">Aa 01</text></svg>`;
}

interface OpenState {
  base: number;
  intensity: number;
  x: number;
  y: number;
}

interface ColorRampPickerProps {
  current: string;
  onPick: (color: string) => void;
  label: string;
  kind?: PickerKind;
  /** text picker: first dot clears the color so it follows the stroke */
  allowAuto?: boolean;
  /** stroke color used to render the Auto chip/dot preview */
  autoColor?: string;
  /** opacity percent for the popover slider (stroke/fill only) */
  opacity?: number | null;
  onOpacity?: (v: number) => void;
}

function clampPopoverX(rect: DOMRect): number {
  let x = rect.left;
  if (x + POP_WIDTH > window.innerWidth - 8) x = window.innerWidth - POP_WIDTH - 8;
  return Math.max(8, x);
}

function chipDisplay(
  current: string,
  allowAuto: boolean,
  autoColor: string,
): { bg: string; name: string; checker: boolean } {
  if (current === MIXED) return { bg: "transparent", name: "—", checker: true };
  if (allowAuto && current === AUTO) {
    return { bg: autoColor, name: "Auto · stroke", checker: false };
  }
  const loc = locate(current);
  return {
    bg: current,
    name: loc
      ? `${BASE_COLORS[loc.base].name} · I${loc.intensity + 1}`
      : current.toUpperCase(),
    checker: false,
  };
}

export function ColorRampPicker({
  current,
  onPick,
  label,
  kind = "stroke",
  allowAuto = false,
  autoColor = "",
  opacity,
  onOpacity,
}: ColorRampPickerProps) {
  const [open, setOpen] = useState<OpenState | null>(null);
  const [shown, setShown] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!wrapRef.current?.contains(t) && !t.closest(".color-popover")) {
        setOpen(null);
      }
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) cellRefs.current[open.intensity]?.focus();
  }, [open]);

  const openAt = (base: number, intensity: number, rect: DOMRect) => {
    setShown(intensity);
    setOpen({ base, intensity, x: clampPopoverX(rect), y: rect.bottom + 6 });
  };

  const resolved =
    allowAuto && current === AUTO ? autoColor || AUTO : current;
  const loc = resolved === AUTO || current === MIXED ? null : locate(resolved);
  const isAutoActive = allowAuto && current === AUTO;
  const chip = chipDisplay(current, allowAuto, autoColor);
  const dotColors = allowAuto ? BASE_COLORS.slice(0, BASE_COLORS.length - 1) : BASE_COLORS;

  const shades = open ? shadesOf(BASE_COLORS[open.base].color) : null;
  const preview = shades ? shades[shown] : null;

  const onPopoverKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(null);
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.stopPropagation();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const next = Math.min(4, Math.max(0, shown + dir));
      setShown(next);
      cellRefs.current[next]?.focus();
    }
  };

  return (
    <div className="color-ramp-picker" ref={wrapRef}>
      <button
        type="button"
        className="current-color"
        aria-label={`${label} current`}
        onClick={(e) =>
          openAt(loc?.base ?? 6, loc?.intensity ?? 3, e.currentTarget.getBoundingClientRect())
        }
      >
        <span
          className={`chip-swatch${chip.checker ? " transparent-checker" : ""}`}
          style={{ background: chip.bg }}
        />
        <span className="chip-name">{chip.name}</span>
      </button>
      <div className="base-dots">
        {allowAuto && (
          <button
            type="button"
            className={`base-dot${isAutoActive ? " active" : ""}`}
            style={{
              background: `linear-gradient(135deg, ${autoColor} 50%, var(--bg-surface) 50%)`,
            }}
            title="Auto (segue o stroke)"
            aria-label={`${label} Auto`}
            onClick={() => onPick(AUTO)}
          />
        )}
        {dotColors.map((entry, i) => (
          <button
            key={entry.name}
            type="button"
            className={`base-dot${loc?.base === i ? " active" : ""}`}
            style={{ background: entry.color }}
            title={entry.name}
            aria-label={`${label} ${entry.name}`}
            onClick={(e) =>
              openAt(i, 3, e.currentTarget.getBoundingClientRect())
            }
          />
        ))}
      </div>
      {open && shades && preview && createPortal(
        <div
          className="color-popover color-popover--portal"
          style={{ left: open.x, top: open.y }}
          role="menu"
          aria-label={`${label} intensities`}
          onKeyDown={onPopoverKeyDown}
        >
          <div className="pop-header">
            <span className="pop-title">
              {BASE_COLORS[open.base].name} · {shown + 1}
            </span>
            <span className="pop-hex">{preview.toUpperCase()}</span>
          </div>
          <div
            className="pop-preview"
            dangerouslySetInnerHTML={{ __html: previewSvg(kind, preview) }}
          />
          <div className="ramp">
            {shades.map((shade, i) => (
              <button
                key={shade}
                type="button"
                ref={(el) => {
                  cellRefs.current[i] = el;
                }}
                className={`ramp-cell${i === shown ? ` selected ${inkClass(shade)}` : ""}`}
                style={{ background: shade }}
                aria-label={`${label} ${BASE_COLORS[open.base].name} intensity ${i + 1}`}
                onMouseEnter={() => setShown(i)}
                onClick={() => {
                  onPick(shade);
                  setOpen(null);
                }}
              />
            ))}
          </div>
          {onOpacity && (
            <div className="pop-opacity">
              <div className="panel-subtitle-row">
                <span className="panel-subtitle">Opacity</span>
                <span className="slider-value">{opacity ?? 100}</span>
              </div>
              <input
                type="range"
                className="opacity-range"
                min={0}
                max={100}
                step={5}
                value={opacity ?? 100}
                aria-label="Opacity"
                onChange={(e) => onOpacity(Number(e.target.value))}
              />
            </div>
          )}
          <div className="pop-hint">
            <kbd>esc</kbd> fecha
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
