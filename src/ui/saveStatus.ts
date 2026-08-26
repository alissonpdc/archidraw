import { useSyncExternalStore } from "react";

let lastSavedAt: number | null = null;
const listeners = new Set<() => void>();

export function markSaved() {
  lastSavedAt = Date.now();
  for (const cb of listeners) cb();
}

export function getLastSavedAt(): number | null {
  return lastSavedAt;
}

export function subscribeSaveStatus(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useLastSavedAt(): number | null {
  return useSyncExternalStore(subscribeSaveStatus, getLastSavedAt);
}
