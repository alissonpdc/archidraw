import type { FileAccess } from "./fileAccess";
import type { FileBindingStore, WorkspaceFileBinding } from "./fileBindingStore";
import type { FilePicker } from "./filePicker";
import type { WorkspaceFileIdentity } from "./workspaceFile";
import type { WorkspaceData } from "../storage";

export interface DocumentEditorSnapshot {
  activeWorkspaceId: string;
  workspaces: readonly { id: string; name: string }[];
}

export interface WorkspaceDocumentEditor {
  subscribe(listener: () => void): () => void;
  getSnapshot(): DocumentEditorSnapshot;
  openWorkspace(workspaceId: string): void;
  serializeWorkspaceFile(
    workspaceId: string,
    identity: WorkspaceFileIdentity,
  ): string | null;
  isWorkspaceEmpty(workspaceId: string): boolean;
  openWorkspaceFile(data: WorkspaceData, name: string): string;
  replaceWorkspaceFromFile(
    workspaceId: string,
    data: WorkspaceData,
    name: string,
    options?: { preserveView?: boolean },
  ): boolean;
  renameWorkspace(workspaceId: string, name: string): void;
  closeWorkspace(workspaceId: string): void;
}

export interface WorkspaceDocumentsDeps {
  editor: WorkspaceDocumentEditor;
  store: FileBindingStore;
  picker: FilePicker;
  access: FileAccess;
  notify?: (message: string) => void;
  writeDelayMs?: number;
  pollVisibleMs?: number;
  pollHiddenMs?: number;
  now?: () => number;
}

export type ConflictChoice = "disk" | "mine" | "copy";

export interface LocalDocument {
  text: string;
  hash: string;
}

export interface NewFileOptions {
  newUid: boolean;
  removeOldFile: boolean;
}

/**
 * Mutable state shared by the document service collaborators. The facade
 * implements it; the reconciler and file actions operate on this contract.
 */
export interface DocumentRuntime {
  editor: WorkspaceDocumentEditor;
  store: FileBindingStore;
  picker: FilePicker;
  access: FileAccess;
  notify: (message: string) => void;
  writeDelayMs: number;
  pollVisibleMs: number;
  pollHiddenMs: number;
  now: () => number;
  bindings: Map<string, WorkspaceFileBinding>;
  writeTimers: Map<string, ReturnType<typeof setTimeout>>;
  pollingTimer: ReturnType<typeof setTimeout> | null;
  pollingIds: Set<string>;
  unsubscribeEditor: (() => void) | null;
  visibilityListener: (() => void) | null;
  channel: BroadcastChannel | null;
  booted: boolean;
  suspended: number;
}
