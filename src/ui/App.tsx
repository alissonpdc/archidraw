import { useEffect, useRef, useState, useCallback } from "react";
import { editor } from "./hooks/useEditor";
import { toggleLightDark } from "./theme";
import { CanvasHost } from "./components/CanvasHost";
import { GlobalTooltip } from "./components/GlobalTooltip";
import { Toolbar } from "./components/Toolbar";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { WorkspacePanel, WorkspacePanelToggle } from "./components/WorkspacePanel";
import { loadPanelOpenPref, savePanelOpenPref } from "./panelPrefs";
import { AppMenu } from "./components/AppMenu";import { ZoomWidget, FocusWidget } from "./components/ZoomWidget";
import { HistoryWidget } from "./components/HistoryWidget";
import { StatusBar } from "./components/StatusBar";
import { Toasts } from "./components/Toasts";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { ExportImageModal } from "./components/ExportImageModal";
import { SaveModal } from "./components/SaveModal";
import { SyncConflictModal } from "./components/SyncConflictModal";
import { LibraryPanel } from "./components/LibraryPanel";
import { ContextMenu } from "./components/ContextMenu";
import { HoverInfoBox } from "./components/HoverInfoBox";
import { documents } from "./documents";

const TOOL_KEYS: Record<string, Parameters<typeof editor.setTool>[0]> = {
  "1": "selection",
  h: "hand",
  "2": "rectangle",
  "3": "diamond",
  "4": "ellipse",
  "5": "line",
  "6": "arrow",
  "7": "text",
  "8": "context",
};

/** arrow keys -> scene delta; Shift multiplies the step */
const NUDGE_KEYS: Record<string, { x: number; y: number }> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

/** nudge step in SCREEN pixels (converted to scene units by the editor call) */
const NUDGE_STEP_PX = 2;
const NUDGE_STEP_BIG_PX = 10;

export function App() {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [exportImageOpen, setExportImageOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [workspacesOpen, setWorkspacesOpen] = useState(loadPanelOpenPref);
  const workspacesOpenRef = useRef(workspacesOpen);
  const selectionBeforePanelRef = useRef<string[] | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleMenu = useCallback(() => {
    setMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setLibraryOpen(false);
      }
      return next;
    });
  }, []);

  const toggleLibrary = useCallback(() => {
    setLibraryOpen((prev) => {
      const next = !prev;
      if (next) {
        setMenuOpen(false);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    workspacesOpenRef.current = workspacesOpen;
    savePanelOpenPref(workspacesOpen);
  }, [workspacesOpen]);

  // selecionar um objeto no canvas fecha o painel: o menu aberto não deve
  // continuar por cima do trabalho que o usuário acabou de começar
  useEffect(() => {
    if (!workspacesOpen) return;
    const unsub = editor.subscribe(() => {
      if (editor.getSnapshot().selectedIds.size > 0) {
        selectionBeforePanelRef.current = null;
        workspacesOpenRef.current = false;
        setWorkspacesOpen(false);
      }
    });
    return () => {
      unsub();
    };
  }, [workspacesOpen]);

  // abrir o painel derruba a seleção: o properties-panel fica na borda
  // esquerda e sobreporia o popup. Ao fechar, a seleção anterior volta — mas
  // só se o usuário não tiver selecionado outra coisa nesse meio-tempo.
  const toggleWorkspacesPanel = useCallback(() => {
    const nextOpen = !workspacesOpenRef.current;
    workspacesOpenRef.current = nextOpen;
    setWorkspacesOpen(nextOpen);
    if (nextOpen) {
      const selected = [...editor.getSnapshot().selectedIds];
      if (selected.length > 0) {
        selectionBeforePanelRef.current = selected;
        editor.clearSelection();
      } else {
        selectionBeforePanelRef.current = null;
      }
      return;
    }
    const saved = selectionBeforePanelRef.current;
    selectionBeforePanelRef.current = null;
    if (saved) {
      editor.restoreSelection(saved);
    }
  }, []);

  const openDocument = useCallback(() => {
    if (documents.isSupported()) void documents.open();
    else fileInputRef.current?.click();
  }, []);

  const saveDocument = useCallback(() => {
    if (documents.isSupported()) void documents.save();
    else setSaveOpen(true);
  }, []);

  const saveDocumentAs = useCallback(() => {
    setSaveOpen(true);
  }, []);

  useEffect(() => {
    const unsub = editor.subscribe(() => {
      setFocusMode(editor.getSnapshot().focusMode);
    });
    return () => { unsub(); };
  }, []);

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
      editor.exitFocusMode();
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
      if (!mod && e.shiftKey && e.altKey && e.code === "KeyD") {
        e.preventDefault();
        toggleLightDark();
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
        // NÃO prevenir default e NÃO ler o clipboard aqui: o browser dispara o
        // evento `paste` nativo (tratado adiante) com os dados do clipboard do
        // SO — inclusive imagens. Suprimir o keydown impediria esse evento, e
        // `navigator.clipboard.read()` faz o Chrome (macOS) abrir o menu nativo
        // "Paste" em vez de colar direto. Via única = evento `paste`.
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
      if (mod && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        editor.toggleLockSelected();
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (e.shiftKey) saveDocumentAs();
        else saveDocument();
        return;
      }
      if (mod && e.key.toLowerCase() === "o") {
        e.preventDefault();
        openDocument();
        return;
      }
      if (mod) return;
      const nudge = NUDGE_KEYS[e.key];
      if (nudge) {
        e.preventDefault();
        const step =
          (e.shiftKey ? NUDGE_STEP_BIG_PX : NUDGE_STEP_PX) /
          editor.getSnapshot().camera.zoom;
        editor.nudgeSelected(nudge.x * step, nudge.y * step);
        return;
      }
      if (e.shiftKey && (e.code === "Digit1" || e.key === "!" || e.key === "1")) {
        editor.zoomToFit();
        return;
      }
      if (e.key.toLowerCase() === "l") {
        e.preventDefault();
        toggleLibrary();
        return;
      }
      if (e.key.toLowerCase() === "w") {
        e.preventDefault();
        toggleWorkspacesPanel();
        return;
      }
      if (e.key.toLowerCase() === "m") {
        e.preventDefault();
        toggleMenu();
        return;
      }
      if (e.key.toLowerCase() === "i") {
        e.preventDefault();
        imageInputRef.current?.click();
        return;
      }
      const tool = TOOL_KEYS[e.key.toLowerCase()];
      if (tool) {
        editor.setTool(tool);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        editor.deleteSelected();
      }
      if (e.key === "Escape") {
        editor.onEscape();
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
  }, [toggleWorkspacesPanel, toggleLibrary, toggleMenu, openDocument, saveDocument, saveDocumentAs]);

  useEffect(() => {
    const internalClipboardHas = () => {
      try {
        return localStorage.getItem("archidraw:clipboard") !== null;
      } catch {
        return false;
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      // via única de colar: o browser dispara `paste` para Ctrl/Meta+V, item
      // de menu "Paste" e clique direito → Paste, sempre com os dados do
      // clipboard do SO. preventDefault em TODA chamada tratada (ou ignorada)
      // evita o menu nativo "Paste" do macOS e a inserção default em alvo
      // não-editável. Prioridade: imagem externa → JSON descritivo de
      // elementos vindo do clipboard do SO → clipboard interno do app.
      const tag = document.activeElement?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      e.preventDefault();
      const items = e.clipboardData?.items;
      if (items) {
        for (const item of items) {
          if (item.kind === "file" && item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) editor.insertImage(file);
            return;
          }
        }
      }
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (text !== "" && editor.pasteFromText(text) > 0) return;
      if (internalClipboardHas()) {
        editor.paste();
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  return (
    <div
      className="app"
      data-library-open={libraryOpen || undefined}
      data-panel-open={workspacesOpen || undefined}
    >
      <CanvasHost />
      <ContextMenu />
      <HoverInfoBox />
      <GlobalTooltip />
      {!focusMode && (
        <>
          <WorkspacePanelToggle open={workspacesOpen} onToggle={toggleWorkspacesPanel} />
          <WorkspacePanel
            open={workspacesOpen}
          />
          <div className="top-right">
            <AppMenu
              open={menuOpen}
              onToggle={toggleMenu}
              onClose={() => setMenuOpen(false)}
              onExportImage={() => setExportImageOpen(true)}
              onOpen={openDocument}
              onSave={saveDocument}
              onSaveAs={saveDocumentAs}
              onDownloadCopy={() => setSaveOpen(true)}
              fileInputRef={fileInputRef}
            />
          </div>
          <Toolbar
            libraryOpen={libraryOpen}
            onToggleLibrary={toggleLibrary}
            imageInputRef={imageInputRef}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            data-testid="image-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) editor.insertImage(file);
              e.target.value = "";
            }}
          />
          {libraryOpen && (
            <LibraryPanel onClose={() => setLibraryOpen(false)} />
          )}
          <PropertiesPanel />
          <div className="bottom-right">
            <FocusWidget />
            <ZoomWidget />
            <HistoryWidget />
          </div>
          <StatusBar />
        </>
      )}
      <Toasts />
      <ShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <ExportImageModal
        open={exportImageOpen}
        onClose={() => setExportImageOpen(false)}
      />
      <SaveModal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
      />
      <SyncConflictModal />
    </div>
  );
}
