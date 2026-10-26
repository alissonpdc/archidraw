import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./ui/styles/app.css";
import { App } from "./ui/App";
import { editor } from "./ui/hooks/useEditor";
import { attachAutosave } from "./core/storage";
import { bootWorkspaceStore } from "./core/workspaceRegistry";
import { markSaved } from "./ui/saveStatus";
import { documents } from "./ui/documents";
import {
  browserFilePicker,
  resetFilePicker,
  setFilePicker,
} from "./core/documents/filePicker";
import { clearFileBindingStore } from "./core/documents/fileBindingStore";
import {
  getDocumentSyncSnapshot,
  resetDocumentSyncState,
} from "./core/documents/syncState";
import { hashText } from "./core/documents/hashText";
import {
  applySkinPref,
  applyThemePref,
  attachThemeColorCorrelation,
  loadSkinPref,
  loadThemePref,
} from "./ui/theme";
import { initImportedLibraries } from "./core/importedLibraries";
import { initImportedImages } from "./core/importedImages";
import { initCustomLibrary } from "./core/customLibrary";
import { initNativeLibraries } from "./core/nativeLibraries";
import { elementVisualBounds, detailsBadgeAnchor } from "./core/renderer";
import {
  parseColor,
  ensureContrast,
  themeColor,
  contrastRatio,
  relativeLuminance,
  BASE_COLORS,
  shadesOf,
  locate,
  isPaletteColor,
  correlateIntensity,
} from "./core/color";
import { edgePathPoints, defaultAutoPath, determineBindingSide, autoReflowEndpointBends } from "./core/utils";
import { parseMarkdown, isPlainText } from "./core/markdown";
import {
  detectStructuredLang,
  formatJson,
  formatYaml,
  formatStructured,
  tokenizeJson,
  tokenizeYaml,
  tokenizeStructured,
} from "./core/structuredCode";

if (import.meta.env.MODE === "test" || import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__editor__ = editor;
  (window as unknown as Record<string, unknown>).__elementVisualBounds__ =
    elementVisualBounds;
  (window as unknown as Record<string, unknown>).__detailsBadgeAnchor__ =
    detailsBadgeAnchor;
  (window as unknown as Record<string, unknown>).__color__ = {
    parseColor,
    ensureContrast,
    themeColor,
    contrastRatio,
    relativeLuminance,
    BASE_COLORS,
    shadesOf,
    locate,
    isPaletteColor,
    correlateIntensity,
  };
  (window as unknown as Record<string, unknown>).__archidrawUtils__ = {
    edgePathPoints,
    defaultAutoPath,
    determineBindingSide,
    autoReflowEndpointBends,
  };
  (window as unknown as Record<string, unknown>).__theme__ = {
    attachThemeColorCorrelation,
  };
  (window as unknown as Record<string, unknown>).__markdown__ = {
    parseMarkdown,
    isPlainText,
  };
  (window as unknown as Record<string, unknown>).__structuredCode__ = {
    detectStructuredLang,
    formatJson,
    formatYaml,
    formatStructured,
    tokenizeJson,
    tokenizeYaml,
    tokenizeStructured,
  };
  (window as unknown as Record<string, unknown>).__documents__ = documents;
  (window as unknown as Record<string, unknown>).__documentsTest__ = {
    setPicker: setFilePicker,
    resetPicker: resetFilePicker,
    browserPicker: browserFilePicker,
    clearBindings: clearFileBindingStore,
    resetState: resetDocumentSyncState,
    hashText,
    syncSnapshot: getDocumentSyncSnapshot,
    poll: () => documents.refreshAll(),
  };
}

// restore theme preference before first render (no flash of wrong theme)
applyThemePref(loadThemePref());
applySkinPref(loadSkinPref());

// re-registra bibliotecas .excalidrawlib importadas e imagens importadas
// ANTES do restore (elementos salvos podem referenciar seus componentIds)
initNativeLibraries();
initImportedLibraries();
initImportedImages();
initCustomLibrary();

// restore last session before first render (no flash of empty canvas);
// legacy single-key autosave migrates into the workspace registry here
editor.hydrateWorkspaceStore(bootWorkspaceStore());

attachAutosave(editor, 400, markSaved);
attachThemeColorCorrelation(editor);
void documents
  .boot()
  .catch((error: unknown) => {
    console.error("document sync boot failed", error);
  })
  .finally(() => {
    (window as unknown as Record<string, unknown>).__documentsReady__ = true;
  });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
