export type ThemePref = "system" | "light" | "dark";

const KEY = "archidraw:theme";
const PREFS: ThemePref[] = ["system", "light", "dark"];

export function loadThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return PREFS.includes(v as ThemePref) ? (v as ThemePref) : "system";
  } catch {
    return "system";
  }
}

export function applyThemePref(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === "system") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = pref;
  }
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    // best-effort
  }
}

export function cycleThemePref(current: ThemePref): ThemePref {
  const next = PREFS[(PREFS.indexOf(current) + 1) % PREFS.length];
  applyThemePref(next);
  return next;
}
