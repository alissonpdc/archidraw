import type {
  ConflictChoice,
  DocumentRuntime,
  WorkspaceDocumentEditor,
  WorkspaceDocumentsDeps,
} from "./workspaceDocumentTypes";

export type {
  ConflictChoice,
  DocumentEditorSnapshot,
  WorkspaceDocumentEditor,
  WorkspaceDocumentsDeps,
} from "./workspaceDocumentTypes";

import type { WorkspaceFileBinding } from "./fileBindingStore";
import { refreshAllDocuments, bootDocuments, disposeDocuments } from "./workspaceDocumentReconciler";
import {
  closeDocument,
  openDocument,
  reconnectDocument,
  renameDocument,
  saveAsDocument,
  saveDocument,
} from "./workspaceDocumentActions";
import { resolveDocumentConflict } from "./workspaceDocumentConflicts";

const DEFAULT_WRITE_DELAY_MS = 800;
const DEFAULT_POLL_VISIBLE_MS = 2000;
const DEFAULT_POLL_HIDDEN_MS = 30000;

/**
 * Owns file-backed workspaces: bindings, autosave, external-change polling and
 * conflict resolution. Local workspaces are untouched (localStorage autosave).
 *
 * Usage: const documents = new WorkspaceDocuments({ editor, store, picker, access });
 */
export class WorkspaceDocuments implements DocumentRuntime {
  editor: WorkspaceDocumentEditor;
  store: DocumentRuntime["store"];
  picker: DocumentRuntime["picker"];
  access: DocumentRuntime["access"];
  notify: (message: string) => void;
  writeDelayMs: number;
  pollVisibleMs: number;
  pollHiddenMs: number;
  now: () => number;

  bindings = new Map<string, WorkspaceFileBinding>();
  writeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  pollingTimer: ReturnType<typeof setTimeout> | null = null;
  pollingIds = new Set<string>();
  unsubscribeEditor: (() => void) | null = null;
  visibilityListener: (() => void) | null = null;
  channel: BroadcastChannel | null = null;
  booted = false;
  suspended = 0;

  constructor(deps: WorkspaceDocumentsDeps) {
    this.editor = deps.editor;
    this.store = deps.store;
    this.picker = deps.picker;
    this.access = deps.access;
    this.notify = deps.notify ?? (() => {});
    this.writeDelayMs = deps.writeDelayMs ?? DEFAULT_WRITE_DELAY_MS;
    this.pollVisibleMs = deps.pollVisibleMs ?? DEFAULT_POLL_VISIBLE_MS;
    this.pollHiddenMs = deps.pollHiddenMs ?? DEFAULT_POLL_HIDDEN_MS;
    this.now = deps.now ?? Date.now;
  }

  isSupported(): boolean {
    return this.picker.isSupported();
  }

  bindingFor(workspaceId: string): WorkspaceFileBinding | null {
    return this.bindings.get(workspaceId) ?? null;
  }

  getBindingCount(): number {
    return this.bindings.size;
  }

  /** re-reads every bound file immediately (manual refresh and tests) */
  refreshAll(): Promise<void> {
    return refreshAllDocuments(this);
  }

  /** loads persisted bindings and reconciles every file before any write */
  boot(): Promise<void> {
    return bootDocuments(this);
  }

  dispose(): void {
    disposeDocuments(this);
  }

  /** Open… picker flow. Returns false when cancelled or invalid. */
  open(): Promise<boolean> {
    return openDocument(this);
  }

  /** Ctrl/Cmd+S: flushes an existing file or opens the save picker. */
  save(workspaceId = this.editor.getSnapshot().activeWorkspaceId): Promise<boolean> {
    return saveDocument(this, workspaceId);
  }

  /** Ctrl/Cmd+Shift+S: always opens the save picker. */
  saveAs(workspaceId = this.editor.getSnapshot().activeWorkspaceId): Promise<boolean> {
    return saveAsDocument(this, workspaceId);
  }

  /** Renames a local label or moves a file-backed workspace to a new file. */
  rename(workspaceId: string, name: string): Promise<boolean> {
    return renameDocument(this, workspaceId, name);
  }

  /** Close: removes the workspace from the UI; the file stays on disk. */
  close(workspaceId: string): Promise<boolean> {
    return closeDocument(this, workspaceId);
  }

  /** Re-requests a revoked permission (must run from a user gesture). */
  reconnect(workspaceId: string): Promise<boolean> {
    return reconnectDocument(this, workspaceId);
  }

  /** Resolves the modal shown when both the file and the canvas changed. */
  resolveConflict(
    workspaceId: string,
    choice: ConflictChoice,
  ): Promise<boolean> {
    return resolveDocumentConflict(this, workspaceId, choice);
  }
}
