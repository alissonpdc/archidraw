import { useSyncExternalStore } from "react";
import { useEditorSelector } from "../hooks/useEditor";
import { documents } from "../documents";
import {
  getDocumentSyncSnapshot,
  subscribeDocumentSync,
  type FileSyncStatus,
} from "../../core/documents/syncState";
import { getAppVersion } from "../../core/version";

const STATUS_TEXT: Record<FileSyncStatus, string> = {
  saved: "saved",
  saving: "saving…",
  modified: "not saved",
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
  const appVersion = getAppVersion();
  const fileStatus = view ? view.fileName : "local";
  const statusTip = view ? STATUS_TEXT[view.status] : "local storage";

  return (
    <div className="status-bar">
      <span className="status-version" data-testid="status-version">
        {appVersion}
      </span>
      <button
        type="button"
        className="status-link"
        onClick={() => window.dispatchEvent(new Event("archidraw:shortcuts"))}
      >
        shortcuts (?)
      </button>
      {view?.status === "permission" ? (
        <button
          type="button"
          className="status-file"
          data-testid="status-file"
          data-status={view.status}
          data-tip={statusTip}
          onClick={() => {
            void documents.reconnect(activeWorkspaceId);
          }}
        >
          <span
            className="status-dot"
            data-testid="status-dot"
            data-status={view.status}
            data-tip={statusTip}
            aria-hidden="true"
          />
          <span className="status-file-name">{fileStatus}</span>
        </button>
      ) : (
        <span
          className="status-file"
          data-testid="status-file"
          data-status={view?.status ?? "local"}
          data-tip={statusTip}
        >
          {view && (
            <span
              className="status-dot"
              data-testid="status-dot"
              data-status={view.status}
              data-tip={statusTip}
              aria-hidden="true"
            />
          )}
          <span className="status-file-name">{fileStatus}</span>
        </span>
      )}
    </div>
  );
}
