import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./ui/styles/app.css";
import { App } from "./ui/App";
import { editor } from "./ui/hooks/useEditor";
import { attachAutosave, loadFromStorage } from "./core/storage";
import { markSaved } from "./ui/saveStatus";
import { applyThemePref, loadThemePref } from "./ui/theme";
import { initImportedLibraries } from "./core/importedLibraries";

if (import.meta.env.MODE === "test" || import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__editor__ = editor;
}

// restore theme preference before first render (no flash of wrong theme)
applyThemePref(loadThemePref());

// re-registra bibliotecas .excalidrawlib importadas antes do restore
// (elementos salvos podem referenciar seus componentIds)
initImportedLibraries();

// restore last session before first render (no flash of empty canvas)
const saved = loadFromStorage();
if (saved) {
  editor.restoreState(JSON.stringify(saved));
}

attachAutosave(editor, 400, markSaved);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
