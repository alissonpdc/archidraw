import {
  isNotFoundError,
  isPermissionError,
  type DiskSnapshot,
} from "./fileAccess";
import { workspaceNameFromFile } from "./fileNames";
import { hashText } from "./hashText";
import {
  clearSyncConflict as clearSyncConflictState,
  getFileView,
  getSyncConflict,
  setFileView,
  setSyncConflict,
  type FileSyncStatus,
} from "./syncState";
import type { WorkspaceFileBinding } from "./fileBindingStore";
import type { WorkspaceData } from "../storage";
import type { DocumentRuntime, LocalDocument } from "./workspaceDocumentTypes";

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function loadBindings(
  runtime: DocumentRuntime,
): Promise<WorkspaceFileBinding[]> {
  try {
    return await runtime.store.list();
  } catch (error) {
    runtime.notify(`Could not load file bindings: ${errorText(error)}`);
    return [];
  }
}

export async function persistBinding(
  runtime: DocumentRuntime,
  binding: WorkspaceFileBinding,
): Promise<void> {
  runtime.bindings.set(binding.workspaceId, binding);
  try {
    await runtime.store.put(binding);
  } catch (error) {
    runtime.notify(`Could not persist file binding: ${errorText(error)}`);
  }
}

export async function detachBinding(
  runtime: DocumentRuntime,
  workspaceId: string,
): Promise<void> {
  runtime.bindings.delete(workspaceId);
  try {
    await runtime.store.remove(workspaceId);
  } catch (error) {
    runtime.notify(`Could not remove file binding: ${errorText(error)}`);
  }
}

export async function commitWrite(
  runtime: DocumentRuntime,
  binding: WorkspaceFileBinding,
  hash: string,
  written: DiskSnapshot,
): Promise<void> {
  const next: WorkspaceFileBinding = {
    ...binding,
    lastSyncedHash: hash,
    lastDiskMtime: written.mtime,
    lastDiskSize: written.size,
  };
  await persistBinding(runtime, next);
  clearSyncConflictState(binding.workspaceId);
  markSaved(runtime, next);
  runtime.channel?.postMessage({ workspaceId: binding.workspaceId });
}

export function cancelScheduledWrite(
  runtime: DocumentRuntime,
  workspaceId: string,
): void {
  const timer = runtime.writeTimers.get(workspaceId);
  if (timer) clearTimeout(timer);
  runtime.writeTimers.delete(workspaceId);
}

export async function localDocument(
  runtime: DocumentRuntime,
  workspaceId: string,
  binding: WorkspaceFileBinding,
): Promise<LocalDocument | null> {
  const name =
    workspaceName(runtime, workspaceId) ||
    workspaceNameFromFile(binding.fileName);
  const text = runtime.editor.serializeWorkspaceFile(workspaceId, {
    uid: binding.uid,
    name,
  });
  if (text === null) return null;
  return { text, hash: await hashText(text) };
}

export function workspaceName(
  runtime: DocumentRuntime,
  workspaceId: string,
): string {
  return (
    runtime.editor
      .getSnapshot()
      .workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? ""
  );
}

export function isWorkspaceKnown(
  runtime: DocumentRuntime,
  workspaceId: string,
): boolean {
  return workspaceName(runtime, workspaceId) !== "";
}

export async function readDisk(
  runtime: DocumentRuntime,
  binding: WorkspaceFileBinding,
): Promise<DiskSnapshot | null> {
  try {
    return await runtime.access.read(binding.handle);
  } catch (error) {
    reportAccessError(runtime, binding, error);
    return null;
  }
}

export async function safeWrite(
  runtime: DocumentRuntime,
  binding: WorkspaceFileBinding,
  text: string,
): Promise<DiskSnapshot | null> {
  try {
    return await runtime.access.write(binding.handle, text);
  } catch (error) {
    reportAccessError(runtime, binding, error);
    runtime.notify(`Could not write "${binding.fileName}": ${errorText(error)}`);
    return null;
  }
}

export async function writeHandle(
  runtime: DocumentRuntime,
  handle: FileSystemFileHandle,
  text: string,
): Promise<DiskSnapshot | null> {
  try {
    return await runtime.access.write(handle, text);
  } catch (error) {
    runtime.notify(`Could not write "${handle.name}": ${errorText(error)}`);
    return null;
  }
}

export function reportAccessError(
  runtime: DocumentRuntime,
  binding: WorkspaceFileBinding,
  error: unknown,
): void {
  if (isNotFoundError(error)) {
    updateView(runtime, binding.workspaceId, binding.fileName, "missing");
    return;
  }
  if (isPermissionError(error)) {
    updateView(runtime, binding.workspaceId, binding.fileName, "permission");
    return;
  }
  updateView(
    runtime,
    binding.workspaceId,
    binding.fileName,
    "error",
    errorText(error),
  );
}

export function markSaved(
  runtime: DocumentRuntime,
  binding: WorkspaceFileBinding,
): void {
  updateView(runtime, binding.workspaceId, binding.fileName, "saved");
}

export function updateView(
  runtime: DocumentRuntime,
  workspaceId: string,
  fileName: string,
  status: FileSyncStatus,
  message?: string,
): void {
  const current = getFileView(workspaceId);
  const lastSavedAt =
    status === "saved" ? runtime.now() : (current?.lastSavedAt ?? null);
  if (
    current &&
    current.fileName === fileName &&
    current.status === status &&
    current.message === message &&
    current.lastSavedAt === lastSavedAt
  ) {
    return;
  }
  setFileView({ workspaceId, fileName, status, lastSavedAt, message });
}

/** replaces a canvas from disk, preserving the in-memory camera */
export function replaceWorkspaceFromDisk(
  runtime: DocumentRuntime,
  workspaceId: string,
  data: WorkspaceData,
  name: string,
): string {
  withSuspended(runtime, () => {
    runtime.editor.replaceWorkspaceFromFile(workspaceId, data, name, {
      preserveView: true,
    });
  });
  return workspaceId;
}

export function withSuspended<T>(runtime: DocumentRuntime, action: () => T): T {
  runtime.suspended++;
  try {
    return action();
  } finally {
    runtime.suspended--;
  }
}

export function registerConflict(
  runtime: DocumentRuntime,
  binding: WorkspaceFileBinding,
  disk: DiskSnapshot,
  diskHash: string,
): void {
  cancelScheduledWrite(runtime, binding.workspaceId);
  const hadConflict = getSyncConflict(binding.workspaceId) !== null;
  setSyncConflict({
    workspaceId: binding.workspaceId,
    fileName: binding.fileName,
    diskText: disk.text,
    diskHash,
    diskMtime: disk.mtime,
    diskSize: disk.size,
  });
  updateView(runtime, binding.workspaceId, binding.fileName, "conflict");
  if (!hadConflict) {
    runtime.notify(`"${binding.fileName}" changed on disk`);
  }
}

export async function withFileLock<T>(
  workspaceId: string,
  action: () => Promise<T>,
): Promise<T> {
  const locks = globalThis.navigator?.locks;
  if (!locks) return action();
  return locks.request(`archidraw:document:${workspaceId}`, action);
}

export async function findBindingByHandle(
  runtime: DocumentRuntime,
  handle: FileSystemFileHandle,
): Promise<WorkspaceFileBinding | null> {
  for (const binding of runtime.bindings.values()) {
    if (await runtime.access.sameEntry(binding.handle, handle)) return binding;
  }
  return null;
}

export async function isBoundElsewhere(
  runtime: DocumentRuntime,
  handle: FileSystemFileHandle,
  workspaceId: string,
): Promise<boolean> {
  for (const binding of runtime.bindings.values()) {
    if (binding.workspaceId === workspaceId) continue;
    if (await runtime.access.sameEntry(binding.handle, handle)) return true;
  }
  return false;
}
