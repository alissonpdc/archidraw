import { editor } from "./hooks/useEditor";
import { toast } from "./toasts";
import { WorkspaceDocuments } from "../core/documents/workspaceDocuments";
import { browserFileBindingStore } from "../core/documents/fileBindingStore";
import { filePicker } from "../core/documents/filePicker";
import { browserFileAccess } from "../core/documents/fileAccess";

/**
 * App-wide document service. Imported by the UI and started once from
 * main.tsx after the workspace registry has been hydrated.
 */
export const documents = new WorkspaceDocuments({
  editor,
  store: browserFileBindingStore,
  picker: filePicker,
  access: browserFileAccess,
  notify: toast,
  writeDelayMs: 800,
  pollVisibleMs: 2000,
  pollHiddenMs: 30000,
});
