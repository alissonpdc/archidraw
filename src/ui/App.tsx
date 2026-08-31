import { useEffect, useState } from "react";
import { editor } from "./hooks/useEditor";
import { CanvasHost } from "./components/CanvasHost";
import { Toolbar } from "./components/Toolbar";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { TabBar } from "./components/TabBar";
import { AppMenu } from "./components/AppMenu";
import { ZoomWidget } from "./components/ZoomWidget";
import { HistoryWidget } from "./components/HistoryWidget";
import { StatusBar } from "./components/StatusBar";
import { Toasts } from "./components/Toasts";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { LibraryPanel } from "./components/LibraryPanel";

const TOOL_KEYS: Record<string, Parameters<typeof editor.setTool>[0]> = {
  v: "selection",
  h: "hand",
  r: "rectangle",
  d: "diamond",
  e: "ellipse",
  l: "line",
  a: "arrow",
  t: "text",
};

export function App() {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  useEffect(() => {
    const openShortcuts = () => setShortcutsOpen(true);
    window.addEventListener("archidraw:shortcuts", openShortcuts);
    return () =>
      window.removeEventListener("archidraw:shortcuts", openShortcuts);
  }, []);

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__appReady__ = true;

    const isTextEditing = () => {
      const tag = document.activeElement?.tagName;
      return tag === "TEXTAREA" || tag === "INPUT";
    };

    /** cola via atalho: lê o clipboard do SO p/ imagem externa e, quando não
     *  existe (ou sem permissão de leitura), cai no clipboard interno do app.
     *  Uma única via → sem corrida com o evento `paste` (que antes duplicava:
     *  `img correta` + `item lixo`). */
    const pasteFromKeyboard = async () => {
      let insertedImage = false;
      try {
        const items = navigator.clipboard
          ? await navigator.clipboard.read()
          : [];
        for (const item of items) {
          for (const type of item.types) {
            if (type.startsWith("image/")) {
              const blob = await item.getType(type);
              editor.insertImage(
                new File([blob], "pasted-image", { type }),
              );
              insertedImage = true;
            }
          }
        }
      } catch {
        // sem permissão de leitura: mantém apenas o clipboard interno
      }
      if (!insertedImage) editor.paste();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        editor.onShiftDown();
        return;
      }
      if (isTextEditing()) return;
      const mod = e.metaKey || e.ctrlKey;

      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }
      if (e.code === "Space") {
        editor.onSpaceDown();
        return;
      }
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          editor.redo();
        } else {
          editor.undo();
        }
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        editor.redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        editor.duplicateSelected();
        return;
      }
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        editor.selectAll();
        return;
      }
      if (mod && e.key.toLowerCase() === "c") {
        editor.copySelected();
        return;
      }
      if (mod && e.key.toLowerCase() === "x") {
        editor.cutSelected();
        return;
      }
      if (mod && e.key.toLowerCase() === "v") {
        // decide o que colar de forma determinística (leitura assíncrona do
        // clipboard do SO). preventDefault evita o evento `paste` nativo —
        // sem corrida entre keydown e paste event => sem paste duplicado.
        e.preventDefault();
        void pasteFromKeyboard();
        return;
      }
      if (mod && e.key.toLowerCase() === "g") {
        e.preventDefault();
        if (e.shiftKey) {
          editor.ungroupSelected();
        } else {
          editor.groupSelected();
        }
        return;
      }
      if (e.shiftKey && e.code === "Digit1") {
        editor.zoomToFit();
        return;
      }
      if (!mod) {
        if (e.key.toLowerCase() === "b") {
          e.preventDefault();
          setLibraryOpen((v) => !v);
          return;
        }
        const tool = TOOL_KEYS[e.key.toLowerCase()];
        if (tool) {
          editor.setTool(tool);
          return;
        }
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        editor.deleteSelected();
      }
      if (e.key === "Escape") {
        editor.clearSelection();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") editor.onShiftUp();
      if (e.code === "Space") editor.onSpaceUp();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const internalClipboardHas = () => {
      try {
        return localStorage.getItem("archidraw:clipboard") !== null;
      } catch {
        return false;
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      // via secundária (ex.: item de menu "Paste", ou browsers sem API de
      // clipboard no keydown): imagens externas têm prioridade e, sem elas,
      // cola o clipboard interno do app
      const tag = document.activeElement?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      const items = e.clipboardData?.items;
      if (items) {
        for (const item of items) {
          if (item.kind === "file" && item.type.startsWith("image/")) {
            e.preventDefault();
            const file = item.getAsFile();
            if (file) editor.insertImage(file);
            return;
          }
        }
      }
      // sem imagem externa: cola o clipboard interno do app (localStorage)
      if (internalClipboardHas()) {
        editor.paste();
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  return (
    <div className="app" data-library-open={libraryOpen || undefined}>
      <CanvasHost />
      <TabBar />
      <div className="top-right">
        <AppMenu />
      </div>
      <Toolbar
        libraryOpen={libraryOpen}
        onToggleLibrary={() => setLibraryOpen((v) => !v)}
      />
      {libraryOpen && (
        <LibraryPanel onClose={() => setLibraryOpen(false)} />
      )}
      <PropertiesPanel />
      <div className="bottom-right">
        <ZoomWidget />
        <HistoryWidget />
      </div>
      <StatusBar />
      <Toasts />
      <ShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}
