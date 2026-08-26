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
      {item.icon.map((d, i) => (
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
      aria-label={`Inserir ${item.name}`}
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
      aria-label="Biblioteca de componentes"
      onMouseOver={showTip}
      onMouseLeave={() => setTip(null)}
      onScroll={() => setTip(null)}
    >
      <TileTooltip tip={tip} />
      <div className="library-header">
        <span className="panel-subtitle">Biblioteca</span>
        <button
          className="tool-btn library-close"
          aria-label="Fechar biblioteca"
          onClick={close}
        >
          ×
        </button>
      </div>
      <input
        className="library-search"
        type="text"
        placeholder="Buscar componente…"
        aria-label="Buscar componente"
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
            <div className="panel-subtitle">Recentes</div>
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
            <div className="library-empty">Nenhum componente encontrado</div>
          )
        ) : (
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
        )}
      </div>
    </aside>
  );
}
