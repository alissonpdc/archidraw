import { useEffect, useRef, useState } from "react";
import {
  BASE_COLORS,
  hexToHsl,
  locate,
  normalizeHex,
  shadesOf,
} from "../../core/color";

const MIXED = "\u0000";
const AUTO = "";

function inkClass(hex: string): string {
  const [, , l] = hexToHsl(hex);
  return l < 60 ? "ink-dark" : "ink-light";
}

export type PickerKind = "stroke" | "fill" | "text" | "textBg";

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
        data-tip={`${label} color`}
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
  const isMixed = current === MIXED;
  const normCurrent = normalizeHex(current);
  const isCustomInitial = !isAutoActive && !isMixed && !loc && Boolean(normCurrent);

  const [activeBase, setActiveBase] = useState<number>(() => loc?.base ?? 0);
  const [activeIntensity, setActiveIntensity] = useState<number>(() => loc?.intensity ?? 2);
  const [customHex, setCustomHex] = useState<string | null>(
    isCustomInitial && normCurrent ? normCurrent : null,
  );
  const [hexInput, setHexInput] = useState<string>(() => {
    if (isAutoActive || isMixed) return "";
    if (normCurrent) return normCurrent.slice(1);
    return "";
  });
  const [hovered, setHovered] = useState<number | null>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectAllRef = useRef(false);

  const isCustom = !isAutoActive && !isMixed && customHex !== null;

  const shades = shadesOf(BASE_COLORS[activeBase].color);
  const previewIntensity = hovered ?? activeIntensity;
  const preview = isCustom ? customHex : shades[previewIntensity];

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
    if (!isCustom && document.activeElement?.tagName !== "INPUT") {
      cellRefs.current[activeIntensity]?.focus();
    }
  }, [activeIntensity, isCustom]);

  const applyHex = (norm: string) => {
    const matchedLoc = locate(norm);
    if (matchedLoc) {
      setActiveBase(matchedLoc.base);
      setActiveIntensity(matchedLoc.intensity);
      setCustomHex(null);
    } else {
      setCustomHex(norm);
    }
    onPick(norm);
  };

  const commitHex = (norm: string) => {
    applyHex(norm);
    setHexInput(norm.slice(1));
  };

  const handleBaseClick = (baseIdx: number) => {
    setCustomHex(null);
    setActiveBase(baseIdx);
    setHovered(null);
    const newShades = shadesOf(BASE_COLORS[baseIdx].color);
    const nextIntensity = baseIdx === loc?.base ? loc.intensity : 2;
    setActiveIntensity(nextIntensity);
    const picked = newShades[nextIntensity];
    setHexInput(picked.slice(1));
    onPick(picked);
  };

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/^#/, "").slice(0, 6);
    setHexInput(raw);
    if (raw.length === 6) {
      const norm = normalizeHex(raw);
      if (norm) {
        applyHex(norm);
      }
    }
  };

  const handleHexKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const norm = normalizeHex(hexInput);
      if (norm) {
        commitHex(norm);
        onClose();
      }
    }
  };

  const handleHexBlur = () => {
    selectAllRef.current = false;
    const norm = normalizeHex(hexInput);
    if (norm) {
      commitHex(norm);
    } else {
      const currentNorm = normalizeHex(preview);
      setHexInput(currentNorm ? currentNorm.slice(1) : "");
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    selectAllRef.current = true;
    e.currentTarget.select();
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
    if (selectAllRef.current) {
      selectAllRef.current = false;
      e.preventDefault();
      e.currentTarget.select();
    }
  };

  const handleNativeChange = (e: React.FormEvent<HTMLInputElement>) => {
    const val = e.currentTarget.value.toLowerCase();
    const norm = normalizeHex(val);
    if (norm) {
      commitHex(norm);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === "INPUT") {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      return;
    }
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      if (isCustom) return;
      e.stopPropagation();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const currentIdx = hovered ?? activeIntensity;
      const next = Math.min(4, Math.max(0, currentIdx + dir));
      setHovered(next);
      setActiveIntensity(next);
      cellRefs.current[next]?.focus();
      const nextShade = shades[next];
      setHexInput(nextShade.slice(1));
      onPick(nextShade);
    }
  };

  const title = isCustom
    ? "CUSTOM"
    : `${BASE_COLORS[activeBase].name.toUpperCase()} · ${previewIntensity + 1}`;

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
            {title}
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
            setHexInput("");
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
          const isBaseSelected = activeBase === i && !isAutoActive && !isCustom;
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
          {shades.map((shade, i) => {
            const isRampSelected = i === activeIntensity && !isAutoActive && !isCustom;
            return (
              <button
                key={shade}
                type="button"
                ref={(el) => {
                  cellRefs.current[i] = el;
                }}
                className={`ramp-cell${isRampSelected ? ` selected ${inkClass(shade)}` : ""}${i === hovered ? " hovered" : ""}`}
                style={{ background: shade }}
                aria-label={`${label} ${BASE_COLORS[activeBase].name} intensity ${i + 1}`}
                onMouseEnter={() => setHovered(i)}
                onClick={() => {
                  setCustomHex(null);
                  setActiveIntensity(i);
                  setHexInput(shade.slice(1));
                  onPick(shade);
                  onClose();
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="pop-hex-section">
        <span className="panel-subtitle">Hex</span>
        <div className="pop-hex-row">
          <label className="pop-hex-swatch-wrap" title="Custom color picker">
            <input
              type="color"
              className="pop-hex-native"
              value={normalizeHex(preview) ?? "#000000"}
              tabIndex={-1}
              aria-label="Custom color picker"
              onChange={handleNativeChange}
              onInput={handleNativeChange}
            />
            <span
              className={`pop-hex-swatch${preview === "transparent" ? " transparent-checker" : ""}`}
              style={{ backgroundColor: preview }}
            />
          </label>
          <div className="pop-hex-input-wrap">
            <span className="pop-hex-prefix">#</span>
            <input
              type="text"
              className="pop-hex-input"
              value={hexInput}
              placeholder="000000"
              maxLength={7}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label={`${label} hex`}
              onFocus={handleFocus}
              onMouseUp={handleMouseUp}
              onChange={handleHexChange}
              onKeyDown={handleHexKeyDown}
              onBlur={handleHexBlur}
            />
          </div>
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
