import { useEffect, useRef, useState } from "react";
import { BASE_COLORS, hexToHsl, locate, shadesOf } from "../../core/color";

const MIXED = "\u0000";
const AUTO = "";

function inkClass(hex: string): string {
  const [, , l] = hexToHsl(hex);
  return l < 60 ? "ink-dark" : "ink-light";
}

export type PickerKind = "stroke" | "fill" | "text";

function chipDisplay(
  current: string,
  allowAuto: boolean,
  autoColor: string,
): { bg: string; name: string; checker: boolean } {
  if (current === MIXED) return { bg: "transparent", name: "—", checker: true };
  if (allowAuto && current === AUTO) {
    return { bg: autoColor, name: "Auto", checker: false };
  }
  const loc = locate(current);
  return {
    bg: current,
    name: loc
      ? `${BASE_COLORS[loc.base].name} · ${loc.intensity + 1}`
      : current.toUpperCase(),
    checker: false,
  };
}

export interface ColorBoxProps {
  current: string;
  label: string;
  kind?: PickerKind;
  allowAuto?: boolean;
  autoColor?: string;
  isOpen?: boolean;
  onToggle: () => void;
}

export function ColorBox({
  current,
  label,
  allowAuto = false,
  autoColor = "",
  isOpen = false,
  onToggle,
}: ColorBoxProps) {
  const chip = chipDisplay(current, allowAuto, autoColor);
  return (
    <div className="color-ramp-picker">
      <button
        type="button"
        className={`current-color${isOpen ? " active" : ""}`}
        aria-label={`${label} current`}
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <span
          className={`chip-swatch${chip.checker ? " transparent-checker" : ""}`}
          style={{ background: chip.bg }}
        />
        <span className="chip-name">{chip.name}</span>
      </button>
    </div>
  );
}

export const ColorRampPicker = ColorBox;

export interface ColorSubmenuProps {
  current: string;
  onPick: (color: string) => void;
  label: string;
  kind?: PickerKind;
  allowAuto?: boolean;
  autoColor?: string;
  opacity?: number | null;
  onOpacity?: (v: number) => void;
  onClose: () => void;
}

export function ColorSubmenu({
  current,
  onPick,
  label,
  allowAuto = false,
  autoColor = "",
  opacity,
  onOpacity,
  onClose,
}: ColorSubmenuProps) {
  const loc = locate(current);
  const isAutoActive = allowAuto && current === AUTO;

  const [overrideBase, setOverrideBase] = useState<number | null>(null);
  const [overrideIntensity, setOverrideIntensity] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectedBase = overrideBase ?? (loc?.base ?? 6);
  const selectedIntensity = overrideIntensity ?? (loc?.intensity ?? 2);
  const opacityVal = opacity ?? 100;
  const [opacityThumbLeft, setOpacityThumbLeft] = useState<number>(() => {
    const pct = (opacity ?? 100) / 100;
    return pct * (164 - 14) + 7;
  });
  const opacityWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = opacityWrapRef.current;
    if (!wrap) return;
    const input = wrap.querySelector("input");
    if (!input) return;
    const pct = (opacity ?? 100) / 100;
    const trackWidth = input.offsetWidth || 164;
    const thumbW = 14;
    setOpacityThumbLeft(pct * (trackWidth - thumbW) + thumbW / 2);
  }, [opacity]);

  useEffect(() => {
    cellRefs.current[selectedIntensity]?.focus();
  }, [selectedIntensity]);

  const shades = shadesOf(BASE_COLORS[selectedBase].color);
  const previewIntensity = hovered ?? selectedIntensity;
  const preview = shades[previewIntensity];

  const handleBaseClick = (baseIdx: number) => {
    setOverrideBase(baseIdx);
    setHovered(null);
    const newShades = shadesOf(BASE_COLORS[baseIdx].color);
    const nextIntensity = baseIdx === loc?.base ? loc.intensity : 2;
    setOverrideIntensity(nextIntensity);
    onPick(newShades[nextIntensity]);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.stopPropagation();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const currentIdx = hovered ?? selectedIntensity;
      const next = Math.min(4, Math.max(0, currentIdx + dir));
      setHovered(next);
      setOverrideIntensity(next);
      cellRefs.current[next]?.focus();
      onPick(shades[next]);
    }
  };

  return (
    <div
      className="color-submenu color-popover color-popover--portal"
      role="menu"
      aria-label={`${label} intensities`}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div className="submenu-header pop-header">
        <div className="submenu-title-group">
          <span className="pop-title">
            {BASE_COLORS[selectedBase].name.toUpperCase()} · {previewIntensity + 1}
          </span>
          <span className="pop-hex">{preview.toUpperCase()}</span>
        </div>
        <button
          type="button"
          className="submenu-close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      {allowAuto && (
        <button
          type="button"
          className={`submenu-auto-btn${isAutoActive ? " active" : ""}`}
          aria-label={`${label} Auto`}
          onClick={() => {
            onPick(AUTO);
            onClose();
          }}
        >
          <span
            className="chip-swatch"
            style={{
              background: `linear-gradient(135deg, ${autoColor} 50%, var(--bg-surface) 50%)`,
            }}
          />
          <span>Auto</span>
        </button>
      )}

      <div className="matrix-3x5" role="group" aria-label="Base colors">
        {BASE_COLORS.map((entry, i) => {
          const isBaseSelected = selectedBase === i && !isAutoActive;
          return (
            <button
              key={entry.name}
              type="button"
              className={`matrix-cell base-dot${isBaseSelected ? " active" : ""}`}
              style={{ background: entry.color }}
              title={entry.name}
              aria-label={`${label} ${entry.name}`}
              onClick={() => handleBaseClick(i)}
            />
          );
        })}
      </div>

      <div className="submenu-intensity">
        <span className="panel-subtitle">Intensity</span>
        <div className="ramp" onMouseLeave={() => setHovered(null)}>
          {shades.map((shade, i) => (
            <button
              key={shade}
              type="button"
              ref={(el) => {
                cellRefs.current[i] = el;
              }}
              className={`ramp-cell${i === selectedIntensity && !isAutoActive ? ` selected ${inkClass(shade)}` : ""}${i === hovered ? " hovered" : ""}`}
              style={{ background: shade }}
              aria-label={`${label} ${BASE_COLORS[selectedBase].name} intensity ${i + 1}`}
              onMouseEnter={() => setHovered(i)}
              onClick={() => {
                onPick(shade);
                onClose();
              }}
            />
          ))}
        </div>
      </div>

      {onOpacity && (
        <div className="pop-opacity">
          <span className="panel-subtitle">Opacity</span>
          <div className="opacity-slider-wrap" ref={opacityWrapRef}>
            <input
              type="range"
              className="opacity-range"
              min={0}
              max={100}
              step={5}
              value={opacityVal}
              aria-label="Opacity"
              onChange={(e) => {
                const val = Number(e.target.value);
                onOpacity(val);
                const input = e.currentTarget;
                const pct = val / 100;
                const trackWidth = input.offsetWidth || 164;
                const thumbW = 14;
                setOpacityThumbLeft(pct * (trackWidth - thumbW) + thumbW / 2);
              }}
            />
            <span
              className="opacity-bubble"
              style={{ left: opacityThumbLeft, transform: "translateX(-50%)" }}
            >
              {opacityVal}%
            </span>
          </div>
        </div>
      )}

      <div className="pop-hint">
        <kbd>esc</kbd> to close
      </div>
    </div>
  );
}
