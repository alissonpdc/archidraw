import { useSyncExternalStore } from "react";
import {
  getDocumentSyncSnapshot,
  subscribeDocumentSync,
} from "../../core/documents/syncState";
import { documents } from "../documents";

/**
 * Shown only when the file and the canvas both changed since the last sync.
 * The native save picker already covers plain overwrite confirmation; this
 * modal exists because autosave has no picker to ask.
 */
export function SyncConflictModal() {
  const snapshot = useSyncExternalStore(
    subscribeDocumentSync,
    getDocumentSyncSnapshot,
  );
  const conflict = snapshot.conflicts[0];
  if (!conflict) return null;

  return (
    <div className="modal-backdrop tab-confirm-backdrop" data-testid="sync-conflict">
      <div
        className="tab-confirm sync-conflict"
        role="alertdialog"
        aria-modal="true"
        aria-label="File changed on disk"
      >
        <p className="tab-confirm-text">
          <strong>{conflict.fileName}</strong> was modified outside ArchiDraw
          while this workspace has unsaved changes.
        </p>
        <div className="tab-confirm-actions sync-conflict-actions">
          <button
            className="menu-item tab-confirm-btn"
            data-testid="sync-conflict-disk"
            onClick={() => void documents.resolveConflict(conflict.workspaceId, "disk")}
          >
            Use disk version
          </button>
          <button
            className="menu-item tab-confirm-btn"
            data-testid="sync-conflict-mine"
            onClick={() => void documents.resolveConflict(conflict.workspaceId, "mine")}
          >
            Keep my version
          </button>
          <button
            className="menu-item tab-confirm-btn"
            data-testid="sync-conflict-copy"
            onClick={() => void documents.resolveConflict(conflict.workspaceId, "copy")}
          >
            Save as copy…
          </button>
        </div>
      </div>
    </div>
  );
}
