import { useSyncExternalStore } from "react";

export type BgColor = string; // hex like "#ffffff"

const KEY = "archidraw:bg-color";

export const BG_PALETTE: { id: BgColor; label: string }[] = [
  { id: "#ffffff", label: "White" },
  { id: "#f6f7f8", label: "Cool Gray" },
  { id: "#f7f2ea", label: "Warm Cream" },
  { id: "#edf1f7", label: "Ice Blue" },
  { id: "#f0f0ee", label: "Parchment" },
  { id: "#e8e8e6", label: "Silver" },
  { id: "#d4d4d4", label: "Ash" },
  { id: "#15181c", label: "Charcoal" },
  { id: "#1d2126", label: "Dark" },
  { id: "#0b0d11", label: "Jet" },
];

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

export function subscribeBgColor(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useBgColor(): BgColor | null {
  return useSyncExternalStore(subscribeBgColor, getBgColor);
}
