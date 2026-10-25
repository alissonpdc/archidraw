const PANEL_PREF_KEY = "archidraw:panel-open";

export function loadPanelOpenPref(): boolean {
  try {
    return localStorage.getItem(PANEL_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function savePanelOpenPref(open: boolean) {
  try {
    localStorage.setItem(PANEL_PREF_KEY, open ? "1" : "0");
  } catch {
    // best-effort
  }
}
