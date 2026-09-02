import { useSyncExternalStore } from "react";

export type BgColor = string; // hex like "#ffffff"

const KEY = "archidraw:bg-color";

export interface BgPaletteEntry {
  id: BgColor;
  label: string;
  pair: BgColor; // the paired color in the opposite mode
}

export const BG_PALETTE: BgPaletteEntry[] = [
  { id: "#ffffff", label: "White", pair: "#1d2126" },
  { id: "#f6f7f8", label: "Cool Gray", pair: "#15181c" },
  { id: "#f7f2ea", label: "Cream", pair: "#0b0d11" },
  { id: "#edf1f7", label: "Ice Blue", pair: "#1a1d22" },
  { id: "#f0f0ee", label: "Parchment", pair: "#262b31" },
];

export const BG_PALETTE_LIGHT = BG_PALETTE;
export const BG_PALETTE_DARK: BgPaletteEntry[] = BG_PALETTE.map((e) => ({
  id: e.pair,
  label: e.label,
  pair: e.id,
}));

export const DEFAULT_BG: BgColor = "#f6f7f8"; // Cool Gray

function loadFromStorage(): BgColor | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && v.startsWith("#") ? v : null;
  } catch {
    return null;
  }
}

let current: BgColor = loadFromStorage() ?? DEFAULT_BG;
const listeners = new Set<() => void>();

function applyToDom(color: BgColor | null) {
  const root = document.documentElement;
  if (color && color !== DEFAULT_BG) {
    root.style.setProperty("--bg-canvas", color);
  } else {
    root.style.removeProperty("--bg-canvas");
  }
}

// apply on module load (only if user has an explicit choice)
applyToDom(loadFromStorage());

export function getBgColor(): BgColor {
  return current;
}

export function setBgColor(color: BgColor) {
  if (color === current) return;
  current = color;
  applyToDom(color);
  try {
    if (color !== DEFAULT_BG) {
      localStorage.setItem(KEY, color);
    } else {
      localStorage.removeItem(KEY);
    }
  } catch {
    // best-effort
  }
  for (const cb of listeners) cb();
  window.dispatchEvent(new Event("archidraw:bg-change"));
}

function resolvedThemeIsDark(): boolean {
  if (document.documentElement.dataset.theme === "dark") return true;
  if (document.documentElement.dataset.theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Switch the canvas background to match the target theme mode. */
export function switchBgForTheme(targetPref: "system" | "light" | "dark") {
  const targetDark =
    targetPref === "dark" || (targetPref === "system" && resolvedThemeIsDark());
  const palette = targetDark
    ? BG_PALETTE.map((e) => e.pair)
    : BG_PALETTE.map((e) => e.id);
  // only干预 if the user explicitly chose a bg that's now invalid
  const stored = loadFromStorage();
  if (stored && !palette.includes(stored)) {
    setBgColor(targetDark ? BG_PALETTE[0].pair : DEFAULT_BG);
  }
}

// Auto-switch bg when data-theme changes (media query or manual set)
{
  let lastDark = resolvedThemeIsDark();
  const obs = new MutationObserver(() => {
    const isDark = resolvedThemeIsDark();
    if (isDark === lastDark) return;
    lastDark = isDark;
    const stored = loadFromStorage();
    if (!stored) return; // no explicit choice → let CSS handle it
    const palette = isDark
      ? BG_PALETTE.map((e) => e.pair)
      : BG_PALETTE.map((e) => e.id);
    if (!palette.includes(stored)) {
      setBgColor(isDark ? BG_PALETTE[0].pair : DEFAULT_BG);
    }
  });
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
}

export function subscribeBgColor(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useBgColor(): BgColor {
  return useSyncExternalStore(subscribeBgColor, getBgColor);
}
