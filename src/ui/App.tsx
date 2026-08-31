import { useEffect, useRef, useState } from "react";
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
  // token de deduplicação entre as duas vias de colar (keydown fallback e o
  // evento `paste`): a via que resolver primeiro invalida a outra
  const pasteToken = useRef(0);

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
        // NÃO prevenir default aqui: no macOS Chrome isso suprime o evento
        // `paste` nativo e abre o menu "Paste" do sistema em vez de colar. A
        // via primária é o evento `paste` (tratado adiante), que carrega as
        // imagens do clipboard do SO. Fallback abaixo cobre os casos onde o
        // evento `paste` não chega (ex.: headless / Ctrl+V no macOS), usando
        // o token para não colar 2x quando o `paste` também disparar.
        const token = ++pasteToken.current;
        void (async () => {
          let imageFile: File | null = null;
          try {
            const items = navigator.clipboard
              ? await navigator.clipboard.read()
              : [];
            for (const item of items) {
              for (const type of item.types) {
                if (type.startsWith("image/")) {
                  const blob = await item.getType(type);
                  imageFile = new File([blob], "pasted-image", { type });
                }
              }
            }
          } catch {
            // sem permissão de leitura: mantém apenas o clipboard interno
          }
          if (pasteToken.current !== token) return; // `paste` já assumiu
          if (imageFile) editor.insertImage(imageFile);
          else editor.paste();
        })();
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
      // via nativa de colar: dispara para Ctrl/Meta+V, item de menu "Paste" e
      // clique direito → Paste, sempre com os dados do clipboard do SO.
      // cancelar o fallback do keydown garante que só uma via insere (token).
      // Imagens externas têm prioridade; sem elas, cola o clipboard interno
      // do app (localStorage). preventDefault aqui também evita o menu nativo
      // de "Paste" do macOS.
      pasteToken.current += 1;
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
        e.preventDefault();
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
