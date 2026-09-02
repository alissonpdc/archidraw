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

function findPair(color: BgColor): BgColor | null {
  for (const entry of BG_PALETTE) {
    if (entry.id === color) return entry.pair;
    if (entry.pair === color) return entry.id;
  }
  return null;
}

function load(): BgColor | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && v.startsWith("#") ? v : null;
  } catch {
    return null;
  }
}

let current: BgColor | null = load();
const listeners = new Set<() => void>();

function applyToDom(color: BgColor | null) {
  const root = document.documentElement;
  if (color) {
    root.style.setProperty("--bg-canvas", color);
  } else {
    root.style.removeProperty("--bg-canvas");
  }
}

// apply on module load
applyToDom(current);

export function getBgColor(): BgColor | null {
  return current;
}

export function setBgColor(color: BgColor | null) {
  if (color === current) return;
  current = color;
  applyToDom(color);
  try {
    if (color) {
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

/** Switch the canvas background to the paired color in the opposite mode. */
export function switchBgPair() {
  if (!current) return;
  const paired = findPair(current);
  if (paired) setBgColor(paired);
}

export function subscribeBgColor(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useBgColor(): BgColor | null {
  return useSyncExternalStore(subscribeBgColor, getBgColor);
}
