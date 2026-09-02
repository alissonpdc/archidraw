import { useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { editor } from "../hooks/useEditor";
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
  BG_PALETTE_LIGHT,
  BG_PALETTE_DARK,
  getBgColor,
  setBgColor,
  subscribeBgColor,
} from "../bgPrefs";
import {
  CheckIcon,
  ChevronLeftIcon,
  DropletIcon,
  GridIcon,
  ImageIcon,
  KeyboardIcon,
  MenuIcon,
  MonitorIcon,
  MoonIcon,
  OpenIcon,
  PaletteIcon,
  SaveIcon,
  SunIcon,
} from "./icons";
import { toast } from "../toasts";
import { MOD } from "../platform";

const SKIN_OPTIONS: { id: SkinPref; label: string; icon: ReactNode }[] = [
  { id: "midnight", label: "Midnight", icon: <MoonIcon size={14} /> },
  { id: "blueprint", label: "Blueprint", icon: <GridIcon size={14} /> },
  { id: "warm", label: "Warm", icon: <SunIcon size={14} /> },
  { id: "swiss", label: "Ink", icon: <DropletIcon size={14} /> },
];

const THEME_OPTIONS: { id: ThemePref; label: string; icon: ReactNode }[] = [
  { id: "system", label: "System", icon: <MonitorIcon size={14} /> },
  { id: "light", label: "Light", icon: <SunIcon size={14} /> },
  { id: "dark", label: "Dark", icon: <MoonIcon size={14} /> },
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
  className,
  shortcut,
}: {
  label: string;
  icon?: ReactNode;
  active?: boolean;
  onClick: () => void;
  className?: string;
  shortcut?: string;
}) {
  return (
    <button
      className={`menu-item ${active ? "active" : ""} ${className ?? ""}`}
      onClick={onClick}
    >
      <span className="menu-item-icon">{icon}</span>
      <span className="menu-item-label">{label}</span>
      {shortcut && <span className="menu-item-shortcut">{shortcut}</span>}
      {active && (
        <span className="menu-item-check">
          <CheckIcon size={12} />
        </span>
      )}
    </button>
  );
}

function MenuSubmenu({
  label,
  icon,
  open,
  onToggle,
  children,
}: {
  label: string;
  icon?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`menu-submenu ${open ? "open" : ""}`}>
      <button className="menu-item menu-item--submenu" onClick={onToggle}>
        <span className="menu-item-arrow">
          <ChevronLeftIcon size={12} />
        </span>
        <span className="menu-item-icon">{icon}</span>
        <span className="menu-item-label">{label}</span>
      </button>
      {open && <div className="menu-submenu-panel">{children}</div>}
    </div>
  );
}

export function AppMenu({
  onExportImage,
  onSave,
  fileInputRef,
}: {
  onExportImage: () => void;
  onSave: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const [themePref, setThemePref] = useState<ThemePref>(() => loadThemePref());
  const [skinPref, setSkinPref] = useState<SkinPref>(() => loadSkinPref());
  const gridMode = useSyncExternalStore(subscribeGrid, getGridMode);
  const bgColor = useSyncExternalStore(subscribeBgColor, getBgColor);
  const [themeSubmenuOpen, setThemeSubmenuOpen] = useState(false);
  const [gridSubmenuOpen, setGridSubmenuOpen] = useState(false);

  // resolve the actual theme when pref is "system"
  const resolvedIsDark =
    themePref === "dark" ||
    (themePref === "system" &&
      (document.documentElement.dataset.theme === "dark" ||
        (document.documentElement.dataset.theme !== "light" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches)));
  const bgPalette = resolvedIsDark ? BG_PALETTE_DARK : BG_PALETTE_LIGHT;

  const close = () => {
    setOpen(false);
    setThemeSubmenuOpen(false);
    setGridSubmenuOpen(false);
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const name = file.name.toLowerCase();

    // Try Excalidraw scene file first
    if (name.endsWith(".excalidraw")) {
      try {
        const doc = parseExcalidrawScene(text);
        const baseName = file.name.replace(/\.excalidraw$/i, "");
        editor.importDocumentAsNewDiagram(doc, baseName);
        toast(`"${baseName}" imported`);
      } catch {
        toast("Invalid .excalidraw file — import cancelled");
      }
      close();
      return;
    }

    // ArchiDraw format (.archidraw or .archidraw.json)
    const count = editor.importAsNewDiagrams(text);
    if (count > 0) {
      const baseName = file.name.replace(/\.archidraw(\.json)?$/i, "");
      // rename the first imported tab to the filename if it was the default name
      const snap = editor.getSnapshot();
      const first = snap.tabs.find((t) => t.id === snap.activeTabId);
      if (first && /^Diagram \d+$/.test(first.name)) {
        editor.renameTab(first.id, baseName);
      }
      toast(`${count} diagram(s) imported`);
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
                label="Open"
                icon={<OpenIcon size={14} />}
                shortcut={`${MOD}+O`}
                onClick={() => fileInputRef.current?.click()}
              />
              <MenuItem
                label="Save…"
                icon={<SaveIcon size={14} />}
                shortcut={`${MOD}+S`}
                onClick={() => {
                  onSave();
                  close();
                }}
              />
              <MenuItem
                label="Export Image…"
                icon={<ImageIcon size={14} />}
                onClick={() => {
                  onExportImage();
                  close();
                }}
              />
            </MenuSection>

            <MenuSection title="Appearance">
              <div className="menu-mode-wrap">
                <div className="menu-mode-label">Mode</div>
                <div className="menu-mode-icons">
                  {THEME_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      className={`menu-mode-icon ${themePref === opt.id ? "active" : ""}`}
                      title={opt.label}
                      onClick={() => {
                        if (themePref === opt.id) return;
                        applyThemePref(opt.id);
                        setThemePref(opt.id);
                      }}
                    >
                      {opt.icon}
                    </button>
                  ))}
                </div>
              </div>

              <div className="menu-bg-palette">
                <div className="menu-bg-label">Background</div>
                <div className="menu-bg-grid">
                  {bgPalette.map(
                    (c) => (
                      <button
                        key={c.id}
                        className={`menu-bg-swatch ${bgColor === c.id ? "active" : ""}`}
                        style={{ backgroundColor: c.id }}
                        title={c.label}
                        onClick={() => setBgColor(c.id)}
                      />
                    ),
                  )}
                </div>
              </div>

              <MenuSubmenu
                label="Theme"
                icon={<PaletteIcon size={14} />}
                open={themeSubmenuOpen}
                onToggle={() => {
                  setThemeSubmenuOpen((v) => !v);
                  setGridSubmenuOpen(false);
                }}
              >
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
              </MenuSubmenu>

              <MenuSubmenu
                label="Grid"
                icon={<GridIcon size={14} />}
                open={gridSubmenuOpen}
                onToggle={() => {
                  setGridSubmenuOpen((v) => !v);
                  setThemeSubmenuOpen(false);
                }}
              >
                {GRID_OPTIONS.map((opt) => (
                  <MenuItem
                    key={opt.id}
                    label={opt.label}
                    icon={<GridIcon size={14} />}
                    active={gridMode === opt.id}
                    onClick={() => setGridMode(opt.id)}
                  />
                ))}
              </MenuSubmenu>
            </MenuSection>

            <MenuSection title="Help">
              <MenuItem
                label="Shortcuts"
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
