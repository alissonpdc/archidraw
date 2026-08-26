import { useSyncExternalStore } from "react";

export type GridMode = "none" | "dots" | "lines";

const KEY = "archidraw:grid";
const MODES: GridMode[] = ["none", "dots", "lines"];

function load(): GridMode {
  try {
    const v = localStorage.getItem(KEY);
    return MODES.includes(v as GridMode) ? (v as GridMode) : "none";
  } catch {
    return "none";
  }
}

let current: GridMode = load();
const listeners = new Set<() => void>();

export function getGridMode(): GridMode {
  return current;
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
  return () => listeners.delete(cb);
}

export function useGridMode(): GridMode {
  return useSyncExternalStore(subscribeGrid, getGridMode);
}
