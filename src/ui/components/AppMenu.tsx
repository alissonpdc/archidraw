import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { editor, useEditor } from "../hooks/useEditor";
import { exportPNG, exportSVG, slugify } from "../../core/exporter";
import { parseExcalidrawScene } from "../../core/excalidrawSceneImport";
import {
  applySkinPref,
  applyThemePref,
  loadSkinPref,
  loadThemePref,
  type SkinPref,
  type ThemePref,
} from "../theme";
import { getGridMode, setGridMode, subscribeGrid, type GridMode } from "../viewPrefs";
import {
  CheckIcon,
  DropletIcon,
  ExportIcon,
  GridIcon,
  ImportIcon,
  KeyboardIcon,
  MenuIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  SunIcon,
  TargetIcon,
} from "./icons";
import { toast } from "../toasts";

const SKIN_OPTIONS: { id: SkinPref; label: string; icon: ReactNode }[] = [
  { id: "default", label: "Default", icon: <PaletteIcon size={14} /> },
  { id: "midnight", label: "Midnight", icon: <MoonIcon size={14} /> },
  { id: "blueprint", label: "Blueprint", icon: <GridIcon size={14} /> },
  { id: "precision", label: "Precision Slate", icon: <TargetIcon size={14} /> },
  { id: "warm", label: "Warm Studio", icon: <SunIcon size={14} /> },
  { id: "swiss", label: "Swiss Ink", icon: <DropletIcon size={14} /> },
];

const THEME_OPTIONS: { id: ThemePref; label: string; icon: ReactNode }[] = [
  { id: "light", label: "Light", icon: <SunIcon size={14} /> },
  { id: "dark", label: "Dark", icon: <MoonIcon size={14} /> },
  { id: "system", label: "System", icon: <MonitorIcon size={14} /> },
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
  icon,
  active = false,
  onClick,
}: {
  label: string;
  icon?: ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`menu-item ${active ? "active" : ""}`} onClick={onClick}>
      <span className="menu-item-icon">{icon}</span>
      <span className="menu-item-label">{label}</span>
      <span className="menu-item-check">{active && <CheckIcon size={12} />}</span>
    </button>
  );
}

export function AppMenu() {
  const snap = useEditor();
  const [open, setOpen] = useState(false);
  const [themePref, setThemePref] = useState<ThemePref>(() => loadThemePref());
  const [skinPref, setSkinPref] = useState<SkinPref>(() => loadSkinPref());
  const gridMode = useSyncExternalStore(subscribeGrid, getGridMode);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeName =
    snap.tabs.find((t) => t.id === snap.activeTabId)?.name ?? "diagram";
  const filename = slugify(activeName);

  const close = () => setOpen(false);

  const exportJSON = () => {
    const blob = new Blob([editor.serializeState()], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.archidraw`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Workspace exported");
    close();
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const name = file.name.toLowerCase();

    // Try Excalidraw scene file first
    if (name.endsWith(".excalidraw")) {
      try {
        const doc = parseExcalidrawScene(text);
        editor.importDocument(doc);
        toast(`"${file.name}" imported`);
      } catch {
        toast("Invalid .excalidraw file — import cancelled");
      }
      close();
      return;
    }

    // ArchiDraw format (.archidraw or .archidraw.json)
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
              <MenuItem
                label="Import…"
                icon={<ImportIcon size={14} />}
                onClick={() => fileInputRef.current?.click()}
              />
              <MenuItem
                label="Export PNG"
                icon={<ExportIcon size={14} />}
                onClick={() => {
                  exportPNG(snap.doc, filename).then((ok) =>
                    toast(ok ? "PNG exported" : "Empty canvas — nothing to export"),
                  );
                  close();
                }}
              />
              <MenuItem
                label="Export SVG"
                icon={<ExportIcon size={14} />}
                onClick={() => {
                  const ok = exportSVG(snap.doc, filename);
                  toast(ok ? "SVG exported" : "Empty canvas — nothing to export");
                  close();
                }}
              />
              <MenuItem
                label="Export .archidraw"
                icon={<ExportIcon size={14} />}
                onClick={exportJSON}
              />
            </MenuSection>

            <MenuSection title="Themes">
              {SKIN_OPTIONS.map((opt) => (
                <MenuItem
                  key={opt.id}
                  label={opt.label}
                  icon={opt.icon}
                  active={skinPref === opt.id}
                  onClick={() => {
                    applySkinPref(opt.id);
                    setSkinPref(opt.id);
                  }}
                />
              ))}
            </MenuSection>

            <MenuSection title="Mode">
              {THEME_OPTIONS.map((opt) => (
                <MenuItem
                  key={opt.id}
                  label={opt.label}
                  icon={opt.icon}
                  active={themePref === opt.id}
                  onClick={() => {
                    applyThemePref(opt.id);
                    setThemePref(opt.id);
                  }}
                />
              ))}
            </MenuSection>

            <MenuSection title="Canvas">
              {GRID_OPTIONS.map((opt) => (
                <MenuItem
                  key={opt.id}
                  label={opt.label}
                  icon={<GridIcon size={14} />}
                  active={gridMode === opt.id}
                  onClick={() => setGridMode(opt.id)}
                />
              ))}
            </MenuSection>

            <MenuSection title="Help">
              <MenuItem
                label="Keyboard shortcuts"
                icon={<KeyboardIcon size={14} />}
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
        accept=".archidraw,.archidraw.json,.excalidraw,.json,application/json"
        style={{ display: "none" }}
        data-testid="import-input"
        onChange={(e) => {
          onImportFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
