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
        e.preventDefault();
        editor.paste();
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
