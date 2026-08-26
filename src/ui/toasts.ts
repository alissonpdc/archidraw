import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  message: string;
}

let toasts: Toast[] = [];
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const cb of listeners) cb();
}

export function toast(message: string, durationMs = 3000) {
  const t = { id: ++seq, message };
  toasts = [...toasts, t];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    emit();
  }, durationMs);
}

export function getToasts(): Toast[] {
  return toasts;
}

export function subscribeToasts(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribeToasts, getToasts);
}
