/** shared localStorage/id helpers for the "imported" modules. */

/** compact unique id (timestamp + random suffix), no prefix */
export function makeReuseId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** best-effort localStorage write (quota can overflow with big images/libs) */
export function persistJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // best-effort
  }
}