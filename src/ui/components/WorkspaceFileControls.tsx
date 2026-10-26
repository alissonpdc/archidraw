import type { WorkspaceInfo } from "../../core/editor";
import type { FileSyncStatus, WorkspaceFileView } from "../../core/documents/syncState";
import { documents } from "../documents";
import { SaveIcon } from "./icons";

const STATUS_LABEL: Record<FileSyncStatus, string> = {
  saved: "Saved",
  saving: "Saving…",
  conflict: "Conflict",
  missing: "Missing",
  permission: "Reconnect",
  invalid: "Invalid file",
  error: "Save error",
};

const NEEDS_ATTENTION: ReadonlySet<FileSyncStatus> = new Set([
  "conflict",
  "missing",
  "permission",
  "invalid",
  "error",
]);

function activateBadge(workspace: WorkspaceInfo, view: WorkspaceFileView): void {
  if (view.status === "permission") {
    void documents.reconnect(workspace.id);
    return;
  }
  if (view.status === "missing" || view.status === "invalid") {
    void documents.saveAs(workspace.id);
  }
}

/**
 * File name + sync status shown next to a workspace row. Reconnect, missing
 * and invalid states are actionable directly from the badge.
 */
export function WorkspaceFileBadge({
  workspace,
  view,
}: {
  workspace: WorkspaceInfo;
  view: WorkspaceFileView;
}) {
  const label = STATUS_LABEL[view.status];
  const attention = NEEDS_ATTENTION.has(view.status);
  return (
    <button
      type="button"
      className="tree-file-badge"
      data-testid={`ws-file-${workspace.name}`}
      data-status={view.status}
      title={`${view.fileName} · ${label}`}
      disabled={!attention}
      onClick={(e) => {
        e.stopPropagation();
        activateBadge(workspace, view);
      }}
    >
      <span className="tree-file-name">{view.fileName}</span>
      <span className="tree-file-status">{label}</span>
    </button>
  );
}

/** Save/Save As entry point for the workspace row. */
export function WorkspaceFileAction({
  workspace,
  view,
  supported,
}: {
  workspace: WorkspaceInfo;
  view: WorkspaceFileView | null;
  supported: boolean;
}) {
  if (!supported) return null;
  if (view) {
    return (
      <button
        className="icon-btn visible"
        data-testid="ws-save-as"
        aria-label={`Save ${workspace.name} as a new file`}
        title="Save as…"
        onClick={(e) => {
          e.stopPropagation();
          void documents.saveAs(workspace.id);
        }}
      >
        <SaveIcon size={12} />
      </button>
    );
  }
  return (
    <button
      className="icon-btn visible"
      data-testid="ws-save-file"
      aria-label={`Save ${workspace.name} to a file`}
      title="Save to file…"
      onClick={(e) => {
        e.stopPropagation();
        void documents.save(workspace.id);
      }}
    >
      <SaveIcon size={12} />
    </button>
  );
}
