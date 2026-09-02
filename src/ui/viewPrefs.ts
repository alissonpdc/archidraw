import { useSyncExternalStore } from "react";

export type GridMode = "none" | "dots" | "lines";

const KEY = "archidraw:grid";

function load(): GridMode | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "none" || v === "dots" || v === "lines" ? v : null;
  } catch {
    return null;
  }
}

// null = "auto": follow the active skin's natural grid
// (blueprint = millimeter paper lines; mocks 01/02/05 = dotted canvas)
const SKIN_AUTO_GRID: Record<string, GridMode> = {
  precision: "dots",
  midnight: "none",
  blueprint: "lines",
  warm: "dots",
  swiss: "dots",
};

let current: GridMode | null = load();
const listeners = new Set<() => void>();

function autoGridForSkin(): GridMode {
  try {
    return (
      SKIN_AUTO_GRID[document.documentElement.dataset.skin ?? "precision"] ??
      "none"
    );
  } catch {
    return "none";
  }
}

export function getGridMode(): GridMode {
  return current ?? autoGridForSkin();
}

export function setGridMode(mode: GridMode) {
  if (mode === current) return;
  current = mode;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // best-effort
  }
  for (const cb of listeners) cb();
}

export function subscribeGrid(cb: () => void) {
  listeners.add(cb);
  // skin switches change the "auto" grid; re-emit so subscribers re-read
  window.addEventListener("archidraw:skin", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("archidraw:skin", cb);
  };
}

export function useGridMode(): GridMode {
  return useSyncExternalStore(subscribeGrid, getGridMode);
}
