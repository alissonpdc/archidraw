import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  LIBRARY,
  LIBRARY_CATEGORIES,
  getLibraryItem,
  getRecentComponents,
  pushRecentComponent,
  searchLibrary,
} from "../../core/library";
import type { LibraryItem } from "../../core/library";
import { editor } from "../hooks/useEditor";
import {
  componentAssetDataUri,
  hasComponentAsset,
} from "../../core/componentAssets";
import {
  getImportedLibraries,
  importExcalidrawLibFile,
  removeImportedLibrary,
} from "../../core/importedLibraries";
import type { ImportedLibrary } from "../../core/importedLibraries";
import {
  getImportedImages,
  removeImportedImage,
} from "../../core/importedImages";
import type { ImportedImageData } from "../../core/importedImages";

export const COMPONENT_DND_TYPE = "application/x-archidraw-component";

/** recents cap: 3 rows of the 5-column tile grid */
const RECENTS_LIMIT = 15;

interface TipState {
  text: string;
  x: number;
  y: number;
}

/** fixed-position tooltip in a portal — panel overflow never clips it */
function TileTooltip({ tip }: { tip: TipState | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!tip || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, tip.x - r.width / 2),
      window.innerWidth - r.width - 8,
    );
    setPos({ left, top: tip.y });
  }, [tip]);

  if (!tip) return null;
  return createPortal(
    <div
      ref={ref}
      className="panel-tooltip"
      style={{
        left: pos?.left ?? tip.x,
        top: pos?.top ?? tip.y,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {tip.text}
    </div>,
    document.body,
  );
}

function ItemIcon({ item, size = 28 }: { item: LibraryItem; size?: number }) {
  if (hasComponentAsset(item.id)) {
    return (
      <img
        className="library-card-img"
        src={componentAssetDataUri(item.id) ?? undefined}
        width={size}
        height={size}
        alt=""
        draggable={false}
      />
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {(item.icon ?? []).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/** borderless icon-only tile; service name shown as tooltip */
function Tile({
  item,
  onInsert,
}: {
  item: LibraryItem;
  onInsert: (item: LibraryItem) => void;
}) {
  return (
    <button
      className="library-card library-tile"
      draggable
      aria-label={`Insert ${item.name}`}
      data-tip={item.name}
      data-component-id={item.id}
      onDragStart={(e) => {
        e.dataTransfer.setData(COMPONENT_DND_TYPE, item.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => onInsert(item)}
    >
      <ItemIcon item={item} />
    </button>
  );
}

export function LibraryPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<string[]>(getRecentComponents);
  const [awsOpen, setAwsOpen] = useState(false);
  const [tip, setTip] = useState<TipState | null>(null);
  const [imported, setImported] = useState<ImportedLibrary[]>(getImportedLibraries);
  const [importedImages, setImportedImages] = useState<ImportedImageData[]>(getImportedImages);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // re-syncs the Imported group when a new image is inserted/pasted (the editor
  // emits on insertComponent; getImportedImages returns a stable ref until items
  // change, so setState bails out when nothing changed — no wasted re-renders)
  useEffect(() => {
    const onEdit = () => setImportedImages(getImportedImages());
    const unsub = editor.subscribe(onEdit);
    return () => {
      unsub();
    };
  }, []);

  const close = () => {
    setQuery("");
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const searching = query.trim() !== "";
  const results = useMemo(() => searchLibrary(query), [query]);
  const awsItems = useMemo(
    () => [...LIBRARY].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const recentItems = useMemo(
    () =>
      !searching && recents.length > 0
        ? recents
            .map((id) => LIBRARY.find((i) => i.id === id))
            .filter((i): i is LibraryItem => !!i)
            .slice(0, RECENTS_LIMIT)
        : [],
    [recents, searching],
  );

  const insert = (item: LibraryItem) => {
    editor.insertComponent(item.id);
    pushRecentComponent(item.id);
    setRecents(getRecentComponents());
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const lib = await importExcalidrawLibFile(file);
      setImported(getImportedLibraries());
      setOpenGroups((prev) => new Set(prev).add(lib.id));
      setImportError(null);
    } catch {
      setImportError("Invalid .excalidrawlib file");
    }
  };

  const onRemoveImported = (libId: string) => {
    removeImportedLibrary(libId);
    setImported(getImportedLibraries());
  };

  const onRemoveImportedImage = (id: string) => {
    removeImportedImage(id);
    setImportedImages(getImportedImages());
  };

  // event-delegated tooltips (same pattern as PropertiesPanel)
  const showTip = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest("[data-tip]");
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTip({
      text: el.getAttribute("data-tip") || "",
      x: r.left + r.width / 2,
      y: r.top,
    });
  };

  return (
    <aside
      className="library-panel"
      aria-label="Component Library"
      onMouseOver={showTip}
      onMouseLeave={() => setTip(null)}
      onScroll={() => setTip(null)}
    >
      <TileTooltip tip={tip} />
      <div className="library-header">
        <span className="panel-subtitle">Library</span>
        <div className="library-header-actions">
          <button
            className="tool-btn library-import"
            aria-label="Import Excalidraw library"
            title="Import .excalidrawlib"
            data-testid="library-import"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 17V5" />
              <path d="M6.5 10.5 L12 5 L17.5 10.5" />
              <path d="M4 20 H20" />
            </svg>
          </button>
          <button
            className="tool-btn library-close"
            aria-label="Close library"
            onClick={close}
          >
            ×
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".excalidrawlib,.json,application/json"
          className="library-import-input"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void onImportFile(file);
          }}
        />
      </div>
      <input
        className="library-search"
        type="text"
        placeholder="Search component…"
        aria-label="Search component"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (results[0]) insert(results[0]);
          }
        }}
      />
      <div className="library-body">
        {recentItems.length > 0 && (
          <section className="library-section" data-testid="library-recents">
            <div className="panel-subtitle">Recents</div>
            <div className="library-grid">
              {recentItems.map((item) => (
                <Tile key={`r-${item.id}`} item={item} onInsert={insert} />
              ))}
            </div>
          </section>
        )}
        {searching ? (
          results.length > 0 ? (
            <section className="library-section">
              <div className="library-grid">
                {results.map((item) => (
                  <Tile key={item.id} item={item} onInsert={insert} />
                ))}
              </div>
            </section>
          ) : (
            <div className="library-empty">No component found</div>
          )
        ) : (
          <>
            {importError && (
              <div className="library-error" role="alert">
                {importError}
              </div>
            )}
            <section className="library-section">
              <button
                className="library-section-header"
                aria-expanded={awsOpen}
                onClick={() => setAwsOpen((v) => !v)}
              >
                <svg
                  className={`library-chevron ${awsOpen ? "open" : ""}`}
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 1.5 L7 5 L3 8.5" />
                </svg>
                AWS
              </button>
              {awsOpen &&
                LIBRARY_CATEGORIES.map((cat) => {
                  const items = awsItems.filter((i) => i.category === cat);
                  if (items.length === 0) return null;
                  return (
                    <div key={cat} className="library-subgroup">
                      <div className="panel-subtitle">{cat}</div>
                      <div className="library-grid">
                        {items.map((item) => (
                          <Tile key={item.id} item={item} onInsert={insert} />
                        ))}
                      </div>
                    </div>
                  );
                })}
            </section>
            {importedImages.length > 0 && (
              <section
                className="library-section"
                data-testid="library-imported-images"
              >
                <div className="panel-subtitle">Imported</div>
                <div className="library-subgroup">
                  <div className="library-grid">
                    {importedImages.map((img) => {
                      const item = getLibraryItem(img.id);
                      if (!item) return null;
                      return (
                        <div key={item.id} className="library-tile-wrap">
                          <Tile item={item} onInsert={insert} />
                          <button
                            className="library-tile-remove"
                            aria-label={`Remove ${item.name}`}
                            data-tip={`Remove ${item.name}`}
                            onClick={() => onRemoveImportedImage(item.id)}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}
            {imported.map((lib) => {
              const isOpen = openGroups.has(lib.id);
              return (
                <section
                  key={lib.id}
                  className="library-section"
                  data-testid="library-imported-group"
                >
                  <div className="library-section-row">
                    <button
                      className="library-section-header"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setOpenGroups((prev) => {
                          const next = new Set(prev);
                          if (next.has(lib.id)) next.delete(lib.id);
                          else next.add(lib.id);
                          return next;
                        })
                      }
                    >
                      <svg
                        className={`library-chevron ${isOpen ? "open" : ""}`}
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 1.5 L7 5 L3 8.5" />
                      </svg>
                      <span className="library-group-name">{lib.name}</span>
                    </button>
                    <button
                      className="tool-btn library-group-remove"
                      aria-label={`Remove library ${lib.name}`}
                      data-tip={`Remove ${lib.name}`}
                      onClick={() => onRemoveImported(lib.id)}
                    >
                      ×
                    </button>
                  </div>
                  {isOpen && (
                    <div className="library-subgroup">
                      <div className="library-grid">
                        {lib.items.map((it) => {
                          const item = getLibraryItem(it.id);
                          return item ? (
                            <Tile key={item.id} item={item} onInsert={insert} />
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </>
        )}
      </div>
    </aside>
  );
}
