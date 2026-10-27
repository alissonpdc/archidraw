import { useSyncExternalStore } from "react";
import { useEditorSelector } from "../hooks/useEditor";
import { documents } from "../documents";
import {
  getDocumentSyncSnapshot,
  subscribeDocumentSync,
  type FileSyncStatus,
} from "../../core/documents/syncState";

const STATUS_TEXT: Record<FileSyncStatus, string> = {
  saved: "saved",
  saving: "saving…",
  conflict: "conflict — choose a version",
  missing: "file missing",
  permission: "reconnect to save",
  invalid: "invalid file",
  error: "save error",
};

export function StatusBar() {
  const activeWorkspaceId = useEditorSelector((snap) => snap.activeWorkspaceId);
  const sync = useSyncExternalStore(
    subscribeDocumentSync,
    getDocumentSyncSnapshot,
  );
  const view = sync.views.find((item) => item.workspaceId === activeWorkspaceId);
  const fileStatus = view
    ? `${view.fileName} · ${STATUS_TEXT[view.status]}`
    : "local";

  return (
    <div className="status-bar">
      {view?.status === "permission" ? (
        <button
          type="button"
          className="status-file"
          data-testid="status-file"
          data-status={view.status}
          onClick={() => {
            void documents.reconnect(activeWorkspaceId);
          }}
        >
          {fileStatus}
        </button>
      ) : (
        <span
          className="status-file"
          data-testid="status-file"
          data-status={view?.status ?? "local"}
        >
          {fileStatus}
        </span>
      )}
      <button
        className="status-link"
        onClick={() => window.dispatchEvent(new Event("archidraw:shortcuts"))}
      >
        shortcuts (?)
      </button>
    </div>
  );
}
