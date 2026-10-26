import type { WorkspaceInfo } from "../../core/editor";
import type { WorkspaceFileView } from "../../core/documents/syncState";
import { documents } from "../documents";
import { SaveIcon } from "./icons";

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
