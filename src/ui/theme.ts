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
    return SKINS.includes(v as SkinPref) ? (v as SkinPref) : "midnight";
  } catch {
    return "midnight";
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
