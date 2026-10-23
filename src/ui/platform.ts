function detectMac(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform ?? nav.platform ?? "";
  if (/Mac|iPhone|iPad|iPod/i.test(platform)) return true;
  return /Mac|iPhone|iPad|iPod/i.test(nav.userAgent ?? "");
}

/** true when running on Apple platforms (⌘ instead of Ctrl) */
export const isMac = detectMac();

export const isWindows =
  typeof navigator !== "undefined" &&
  (/Win/i.test((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? "") ||
    /Windows/i.test(navigator.userAgent ?? ""));

/** platform-appropriate modifier label for tooltips/shortcuts */
export const MOD = isMac ? "⌘" : "Ctrl";

/** platform-appropriate alt/option label for shortcuts */
export const ALT = isMac ? "⌥" : "Alt";

/** platform-appropriate redo shortcut */
export const REDO_SHORTCUT = isMac ? `${MOD}+Shift+Z` : `${MOD}+Y`;

export function getPlatformModifiers(userAgentOrNav?: string | Navigator) {
  let mac = isMac;
  if (typeof userAgentOrNav === "string") {
    mac = /Mac|iPhone|iPad|iPod/i.test(userAgentOrNav);
  } else if (userAgentOrNav) {
    const nav = userAgentOrNav as Navigator & { userAgentData?: { platform?: string } };
    const platform = nav.userAgentData?.platform ?? nav.platform ?? "";
    mac = /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac|iPhone|iPad|iPod/i.test(nav.userAgent ?? "");
  }
  const mod = mac ? "⌘" : "Ctrl";
  const alt = mac ? "⌥" : "Alt";
  const redo = mac ? `${mod}+Shift+Z` : `${mod}+Y`;
  return { isMac: mac, MOD: mod, ALT: alt, REDO_SHORTCUT: redo };
}
