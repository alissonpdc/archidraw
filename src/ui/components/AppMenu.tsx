import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { editor, useEditor } from "../hooks/useEditor";
import { exportPNG, exportSVG, slugify } from "../../core/exporter";
import {
  applyThemePref,
  loadThemePref,
  type ThemePref,
} from "../theme";
import { getGridMode, setGridMode, subscribeGrid, type GridMode } from "../viewPrefs";
import { CheckIcon, MenuIcon } from "./icons";
import { toast } from "../toasts";

const THEME_OPTIONS: { id: ThemePref; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

const GRID_OPTIONS: { id: GridMode; label: string }[] = [
  { id: "dots", label: "Dots" },
  { id: "lines", label: "Lines" },
  { id: "none", label: "None" },
];

function MenuSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="menu-section">
      <div className="menu-section-title">{title}</div>
      {children}
    </div>
  );
}

function MenuItem({
  label,
  active = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`menu-item ${active ? "active" : ""}`} onClick={onClick}>
      <span className="menu-item-check">{active && <CheckIcon size={12} />}</span>
      {label}
    </button>
  );
}

export function AppMenu() {
  const snap = useEditor();
  const [open, setOpen] = useState(false);
  const [themePref, setThemePref] = useState<ThemePref>(() => loadThemePref());
  const gridMode = useSyncExternalStore(subscribeGrid, getGridMode);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const activeName =
    snap.tabs.find((t) => t.id === snap.activeTabId)?.name ?? "diagrama";
  const filename = slugify(activeName);

  const close = () => setOpen(false);

  const exportJSON = () => {
    const blob = new Blob([editor.serializeState()], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.archidraw.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Workspace exported as JSON");
    close();
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    if (editor.restoreState(text)) {
      toast(`"${file.name}" imported`);
    } else {
      toast("Invalid file — import cancelled");
    }
    close();
  };

  return (
    <div className="app-menu">
      <button
        data-testid="app-menu-button"
        className={`tool-btn menu-btn ${open ? "active" : ""}`}
        title="Menu"
        aria-label="Main menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MenuIcon size={18} />
      </button>
      {open && (
        <>
          <div className="menu-backdrop" onClick={close} />
          <div className="menu-dropdown">
            <MenuSection title="File">
              <MenuItem label="Import JSON…" onClick={() => fileInputRef.current?.click()} />
              <MenuItem label="Open Image…" onClick={() => imageInputRef.current?.click()} />
              <MenuItem
                label="Export PNG"
                onClick={() => {
                  exportPNG(snap.doc, filename).then((ok) =>
                    toast(ok ? "PNG exported" : "Empty canvas — nothing to export"),
                  );
                  close();
                }}
              />
              <MenuItem
                label="Export SVG"
                onClick={() => {
                  const ok = exportSVG(snap.doc, filename);
                  toast(ok ? "SVG exported" : "Empty canvas — nothing to export");
                  close();
                }}
              />
              <MenuItem label="Export JSON" onClick={exportJSON} />
            </MenuSection>

            <MenuSection title="Theme">
              {THEME_OPTIONS.map((opt) => (
                <MenuItem
                  key={opt.id}
                  label={opt.label}
                  active={themePref === opt.id}
                  onClick={() => {
                    applyThemePref(opt.id);
                    setThemePref(opt.id);
                  }}
                />
              ))}
            </MenuSection>

            <MenuSection title="Grid">
              {GRID_OPTIONS.map((opt) => (
                <MenuItem
                  key={opt.id}
                  label={opt.label}
                  active={gridMode === opt.id}
                  onClick={() => setGridMode(opt.id)}
                />
              ))}
            </MenuSection>

            <MenuSection title="Help">
              <MenuItem
                label="Keyboard shortcuts (?)"
                onClick={() => {
                  window.dispatchEvent(new Event("archidraw:shortcuts"));
                  close();
                }}
              />
            </MenuSection>
          </div>
        </>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        data-testid="import-input"
        onChange={(e) => {
          onImportFile(e.target.files?.[0]);
          e.target.value = "";
        }}
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
          close();
        }}
      />
    </div>
  );
}
