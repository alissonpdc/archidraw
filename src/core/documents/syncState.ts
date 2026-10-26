export type FileSyncStatus =
  | "saving"
  | "saved"
  | "conflict"
  | "missing"
  | "permission"
  | "invalid"
  | "error";

export interface WorkspaceFileView {
  workspaceId: string;
  fileName: string;
  status: FileSyncStatus;
  lastSavedAt: number | null;
  message?: string;
}

export interface SyncConflict {
  workspaceId: string;
  fileName: string;
  diskText: string;
  diskHash: string;
  diskMtime: number;
  diskSize: number;
}

export interface DocumentSyncSnapshot {
  views: WorkspaceFileView[];
  conflicts: SyncConflict[];
}

let views = new Map<string, WorkspaceFileView>();
let conflicts = new Map<string, SyncConflict>();
let snapshot: DocumentSyncSnapshot = { views: [], conflicts: [] };
const listeners = new Set<() => void>();

function rebuildSnapshot(): void {
  snapshot = {
    views: [...views.values()],
    conflicts: [...conflicts.values()],
  };
  for (const listener of listeners) listener();
}

export function setFileView(view: WorkspaceFileView): void {
  views.set(view.workspaceId, view);
  rebuildSnapshot();
}

export function removeFileView(workspaceId: string): void {
  views.delete(workspaceId);
  conflicts.delete(workspaceId);
  rebuildSnapshot();
}

export function getFileView(workspaceId: string): WorkspaceFileView | null {
  return views.get(workspaceId) ?? null;
}

export function setSyncConflict(conflict: SyncConflict): void {
  conflicts.set(conflict.workspaceId, conflict);
  rebuildSnapshot();
}

export function clearSyncConflict(workspaceId: string): void {
  if (!conflicts.delete(workspaceId)) return;
  rebuildSnapshot();
}

export function getSyncConflict(workspaceId: string): SyncConflict | null {
  return conflicts.get(workspaceId) ?? null;
}

export function getDocumentSyncSnapshot(): DocumentSyncSnapshot {
  return snapshot;
}

export function subscribeDocumentSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** clears the observable state (e2e reset) */
export function resetDocumentSyncState(): void {
  views = new Map();
  conflicts = new Map();
  rebuildSnapshot();
}
