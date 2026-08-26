export function StatusBar() {
  return (
    <div className="status-bar">
      <button
        className="status-link"
        onClick={() => window.dispatchEvent(new Event("archidraw:shortcuts"))}
      >
        atalhos (?)
      </button>
    </div>
  );
}
