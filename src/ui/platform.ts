/** true when running on Apple platforms (⌘ instead of Ctrl) */
export const isMac = /Mac|iPhone|iPad/.test(
  typeof navigator === "undefined" ? "" : navigator.userAgent,
);

/** platform-appropriate modifier label for tooltips/shortcuts */
export const MOD = isMac ? "⌘" : "Ctrl";
