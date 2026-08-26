import { useEffect, useMemo, useState } from "react";
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

function ItemIcon({ item, size = 26 }: { item: LibraryItem; size?: number }) {
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

function Card({
  item,
  onInsert,
}: {
  item: LibraryItem;
  onInsert: (item: LibraryItem) => void;
}) {
  return (
    <button
      className="library-card"
      draggable
      aria-label={`Inserir ${item.name}`}
      title={item.name}
      data-component-id={item.id}
      onDragStart={(e) => {
        e.dataTransfer.setData(COMPONENT_DND_TYPE, item.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => onInsert(item)}
    >
      <span className="library-card-icon">
        <ItemIcon item={item} />
      </span>
      <span className="library-card-name">{item.name}</span>
    </button>
  );
}

export function LibraryPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<string[]>(getRecentComponents);

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

  const results = useMemo(() => searchLibrary(query), [query]);
  const grouped = useMemo(() => {
    if (query.trim() !== "") return null;
    return LIBRARY_CATEGORIES.map((cat) => ({
      category: cat,
      items: results.filter((i) => i.category === cat),
    })).filter((g) => g.items.length > 0);
  }, [results, query]);

  const recentItems = useMemo(
    () =>
      recents.length > 0 && query.trim() === ""
        ? recents
            .map((id) => LIBRARY.find((i) => i.id === id))
            .filter((i): i is LibraryItem => !!i)
        : [],
    [recents, query],
  );

  const insert = (item: LibraryItem) => {
    editor.insertComponent(item.id);
    pushRecentComponent(item.id);
    setRecents(getRecentComponents());
  };

  return (
    <aside className="library-panel" aria-label="Biblioteca de componentes">
      <div className="library-header">
        <span className="panel-subtitle">Biblioteca</span>
        <button
          className="tool-btn library-close"
          aria-label="Fechar biblioteca"
          onClick={onClose}
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
            const first = results[0];
            if (first) insert(first);
          }
        }}
      />
      <div className="library-body">
        {recentItems.length > 0 && (
          <section className="library-section">
            <div className="panel-subtitle">Recentes</div>
            <div className="library-grid">
              {recentItems.map((item) => (
                <Card key={item.id} item={item} onInsert={insert} />
              ))}
            </div>
          </section>
        )}
        {grouped
          ? grouped.map(({ category, items }) => (
              <section key={category} className="library-section">
                <div className="panel-subtitle">{category}</div>
                <div className="library-grid">
                  {items.map((item) => (
                    <Card key={item.id} item={item} onInsert={insert} />
                  ))}
                </div>
              </section>
            ))
          : results.length > 0
            ? (
              <section className="library-section">
                <div className="library-list">
                  {results.map((item) => (
                    <Card key={item.id} item={item} onInsert={insert} />
                  ))}
                </div>
              </section>
            )
            : (
              <div className="library-empty">Nenhum componente encontrado</div>
            )}
      </div>
    </aside>
  );
}
