export type ThemePref = "system" | "light" | "dark";
export type SkinPref =
  | "midnight"
  | "blueprint"
  | "warm"
  | "swiss";

const KEY = "archidraw:theme";
const SKIN_KEY = "archidraw:skin";
const PREFS: ThemePref[] = ["system", "light", "dark"];
const SKINS: SkinPref[] = [
  "midnight",
  "blueprint",
  "warm",
  "swiss",
];

export function loadThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return PREFS.includes(v as ThemePref) ? (v as ThemePref) : "system";
  } catch {
    return "system";
  }
}

export function loadSkinPref(): SkinPref {
  try {
    const v = localStorage.getItem(SKIN_KEY);
    return SKINS.includes(v as SkinPref) ? (v as SkinPref) : "blueprint";
  } catch {
    return "blueprint";
  }
}

export function applyThemePref(pref: ThemePref) {
  const root = document.documentElement;
  const target = pref === "system" ? undefined : pref;
  if (root.dataset.theme !== target) {
    if (target) {
      root.dataset.theme = target;
    } else {
      delete root.dataset.theme;
    }
  }
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    // best-effort
  }
  window.dispatchEvent(new Event("archidraw:theme"));
}

export function applySkinPref(skin: SkinPref) {
  const root = document.documentElement;
  root.dataset.skin = skin;
  try {
    localStorage.setItem(SKIN_KEY, skin);
  } catch {
    // best-effort
  }
  window.dispatchEvent(new Event("archidraw:skin"));
}

export function cycleThemePref(current: ThemePref): ThemePref {
  const next = PREFS[(PREFS.indexOf(current) + 1) % PREFS.length];
  applyThemePref(next);
  return next;
}

export function toggleLightDark(): ThemePref {
  const current = loadThemePref();
  let next: "light" | "dark";
  if (current === "dark") {
    next = "light";
  } else {
    next = "dark";
  }
  applyThemePref(next);
  return next;
}

function isResolvedDark(): boolean {
  if (typeof document === "undefined") return false;
  if (document.documentElement.dataset.theme === "dark") return true;
  if (document.documentElement.dataset.theme === "light") return false;
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
  );
}

export function attachThemeColorCorrelation(editor: import("../core/editor").Editor): () => void {
  editor.setDarkMode(isResolvedDark());

  const handler = (e: Event) => {
    const custom = e as CustomEvent<{ isDark: boolean }>;
    const isDark =
      typeof custom.detail?.isDark === "boolean"
        ? custom.detail.isDark
        : isResolvedDark();
    editor.correlateColorsForTheme(isDark);
  };
  window.addEventListener("archidraw:mode-switch", handler);
  return () => {
    window.removeEventListener("archidraw:mode-switch", handler);
  };
}
