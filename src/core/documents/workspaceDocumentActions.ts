import { parse } from "../storage";
import { isNotFoundError } from "./fileAccess";
import { workspaceFileName, workspaceNameFromFile } from "./fileNames";
import { hashText } from "./hashText";
import { createDocumentUid } from "./workspaceFile";
import {
  clearSyncConflict,
  getFileView,
  getSyncConflict,
  removeFileView,
} from "./syncState";
import {
  cancelScheduledWrite,
  detachBinding,
  errorText,
  findBindingByHandle,
  isBoundElsewhere,
  markSaved,
  persistBinding,
  updateView,
  withSuspended,
  workspaceName,
  writeHandle,
} from "./workspaceDocumentCore";
import { flush, reconcileWorkspaceBinding } from "./workspaceDocumentReconciler";
import type {
  DocumentRuntime,
  NewFileOptions,
} from "./workspaceDocumentTypes";
import type { WorkspaceFileBinding } from "./fileBindingStore";

/** Open… picker flow. Returns false when cancelled or invalid. */
export async function openDocument(runtime: DocumentRuntime): Promise<boolean> {
  if (!runtime.picker.isSupported()) {
    runtime.notify("Opening workspace files requires Chrome or Edge");
    return false;
  }
  try {
    const handle = await runtime.picker.openArchidraw();
    if (!handle) return false;
    return await openHandle(runtime, handle);
  } catch (error) {
    runtime.notify(`Could not open file: ${errorText(error)}`);
    return false;
  }
}

/** Ctrl/Cmd+S: flushes an existing file or opens the save picker. */
export async function saveDocument(
  runtime: DocumentRuntime,
  workspaceId = runtime.editor.getSnapshot().activeWorkspaceId,
): Promise<boolean> {
  const binding = runtime.bindings.get(workspaceId);
  if (!binding) return saveAsDocument(runtime, workspaceId);
  const view = getFileView(workspaceId);
  if (view?.status === "conflict") {
    runtime.notify("Resolve the file conflict before saving");
    return false;
  }
  if (view?.status === "missing" || view?.status === "invalid") {
    return saveAsDocument(runtime, workspaceId);
  }
  if (view?.status === "permission" && !(await reconnectDocument(runtime, workspaceId))) {
    return false;
  }
  cancelScheduledWrite(runtime, workspaceId);
  await flush(runtime, workspaceId);
  if (getFileView(workspaceId)?.status === "saved") {
    runtime.notify(`Saved to "${binding.fileName}"`);
    return true;
  }
  return false;
}

/** Ctrl/Cmd+Shift+S: always opens the save picker. */
export async function saveAsDocument(
  runtime: DocumentRuntime,
  workspaceId = runtime.editor.getSnapshot().activeWorkspaceId,
): Promise<boolean> {
  if (!runtime.picker.isSupported()) {
    runtime.notify("Saving to a file requires Chrome or Edge");
    return false;
  }
  const name = workspaceName(runtime, workspaceId);
  if (!name) return false;
  try {
    const handle = await runtime.picker.saveArchidraw(workspaceFileName(name));
    if (!handle) return false;
    return await bindNewFile(runtime, workspaceId, handle, {
      newUid: true,
      removeOldFile: false,
    });
  } catch (error) {
    runtime.notify(`Could not save file: ${errorText(error)}`);
    return false;
  }
}

/** Renames a local label or moves a file-backed workspace to a new file. */
export async function renameDocument(
  runtime: DocumentRuntime,
  workspaceId: string,
  name: string,
): Promise<boolean> {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const binding = runtime.bindings.get(workspaceId);
  if (!binding) {
    runtime.editor.renameWorkspace(workspaceId, trimmed);
    return true;
  }
  if (workspaceFileName(trimmed) === binding.fileName) {
    runtime.editor.renameWorkspace(workspaceId, trimmed);
    return true;
  }
  if (!runtime.picker.isSupported()) {
    runtime.notify("Renaming a workspace file requires Chrome or Edge");
    return false;
  }
  if (getFileView(workspaceId)?.status === "conflict") {
    runtime.notify("Resolve the file conflict before renaming");
    return false;
  }
  await flush(runtime, workspaceId);
  if (getSyncConflict(workspaceId)) {
    runtime.notify("Resolve the file conflict before renaming");
    return false;
  }
  try {
    const handle = await runtime.picker.saveArchidraw(workspaceFileName(trimmed));
    if (!handle) return false;
    return await bindNewFile(runtime, workspaceId, handle, {
      newUid: false,
      removeOldFile: true,
    });
  } catch (error) {
    runtime.notify(`Could not rename file: ${errorText(error)}`);
    return false;
  }
}

/** Close: removes the workspace from the UI; the file stays on disk. */
export async function closeDocument(
  runtime: DocumentRuntime,
  workspaceId: string,
): Promise<boolean> {
  if (getSyncConflict(workspaceId)) {
    runtime.notify("Resolve the file conflict before closing");
    return false;
  }
  cancelScheduledWrite(runtime, workspaceId);
  if (runtime.bindings.has(workspaceId)) {
    await flush(runtime, workspaceId);
    if (getSyncConflict(workspaceId)) {
      runtime.notify("Resolve the file conflict before closing");
      return false;
    }
    await detachBinding(runtime, workspaceId);
  }
  withSuspended(runtime, () => runtime.editor.closeWorkspace(workspaceId));
  removeFileView(workspaceId);
  return true;
}

/** Re-requests a revoked permission (must run from a user gesture). */
export async function reconnectDocument(
  runtime: DocumentRuntime,
  workspaceId: string,
): Promise<boolean> {
  const binding = runtime.bindings.get(workspaceId);
  if (!binding) return false;
  let granted = false;
  try {
    granted = await runtime.access.requestPermission(binding.handle);
  } catch (error) {
    runtime.notify(`Could not reconnect file: ${errorText(error)}`);
    return false;
  }
  if (!granted) {
    updateView(runtime, workspaceId, binding.fileName, "permission");
    runtime.notify("File permission was not granted");
    return false;
  }
  await reconcileWorkspaceBinding(runtime, binding);
  if (getFileView(workspaceId)?.status === "saved") {
    runtime.notify(`Reconnected "${binding.fileName}"`);
    return true;
  }
  return false;
}

async function openHandle(
  runtime: DocumentRuntime,
  handle: FileSystemFileHandle,
): Promise<boolean> {
  const granted = await runtime.access.requestPermission(handle);
  if (!granted) {
    runtime.notify("Read/write permission was not granted");
    return false;
  }
  const existing = await findBindingByHandle(runtime, handle);
  if (existing) {
    runtime.editor.openWorkspace(existing.workspaceId);
    runtime.notify(`"${existing.fileName}" is already open`);
    return true;
  }
  const disk = await runtime.access.read(handle).catch((error: unknown) => {
    runtime.notify(`Could not read "${handle.name}": ${errorText(error)}`);
    return null;
  });
  if (!disk) return false;
  const data = parse(disk.text);
  if (!data) {
    runtime.notify(`"${handle.name}" is not a valid ArchiDraw file`);
    return false;
  }
  const workspaceId = withSuspended(runtime, () =>
    runtime.editor.openWorkspaceFile(data, workspaceNameFromFile(handle.name)),
  );
  const previous = runtime.bindings.get(workspaceId);
  if (previous) await detachBinding(runtime, workspaceId);
  const binding: WorkspaceFileBinding = {
    workspaceId,
    uid: data.uid ?? createDocumentUid(),
    fileName: handle.name,
    handle,
    lastSyncedHash: await hashText(disk.text),
    lastDiskMtime: disk.mtime,
    lastDiskSize: disk.size,
  };
  await persistBinding(runtime, binding);
  clearSyncConflict(workspaceId);
  markSaved(runtime, binding);
  runtime.notify(`Opened "${handle.name}"`);
  return true;
}

async function bindNewFile(
  runtime: DocumentRuntime,
  workspaceId: string,
  handle: FileSystemFileHandle,
  options: NewFileOptions,
): Promise<boolean> {
  const granted = await runtime.access.requestPermission(handle);
  if (!granted) {
    runtime.notify("Read/write permission was not granted");
    return false;
  }
  if (await isBoundElsewhere(runtime, handle, workspaceId)) {
    runtime.notify(`"${handle.name}" is already open in another workspace`);
    return false;
  }
  const existing = await runtime.access.read(handle).catch(() => null);
  if (existing && existing.text.trim() !== "" && !parse(existing.text)) {
    runtime.notify(`"${handle.name}" is not a valid ArchiDraw file`);
    return false;
  }
  const oldBinding = runtime.bindings.get(workspaceId);
  const uid =
    options.newUid || !oldBinding ? createDocumentUid() : oldBinding.uid;
  const fileName = handle.name;
  const displayName = workspaceNameFromFile(fileName);
  const text = runtime.editor.serializeWorkspaceFile(workspaceId, {
    uid,
    name: displayName,
  });
  if (text === null) return false;
  const written = await writeHandle(runtime, handle, text);
  if (!written) return false;
  const next: WorkspaceFileBinding = {
    workspaceId,
    uid,
    fileName,
    handle,
    lastSyncedHash: await hashText(text),
    lastDiskMtime: written.mtime,
    lastDiskSize: written.size,
  };
  await persistBinding(runtime, next);
  clearSyncConflict(workspaceId);
  markSaved(runtime, next);
  withSuspended(runtime, () =>
    runtime.editor.renameWorkspace(workspaceId, displayName),
  );
  if (options.removeOldFile && oldBinding) {
    await removeOldFile(runtime, oldBinding.handle, handle);
  }
  runtime.notify(`Saved to "${fileName}"`);
  return true;
}

async function removeOldFile(
  runtime: DocumentRuntime,
  oldHandle: FileSystemFileHandle,
  newHandle: FileSystemFileHandle,
): Promise<void> {
  if (await runtime.access.sameEntry(oldHandle, newHandle)) return;
  try {
    const removed = await runtime.access.remove(oldHandle);
    if (!removed) runtime.notify("The previous file could not be removed");
  } catch (error) {
    if (isNotFoundError(error)) return;
    runtime.notify(`The previous file could not be removed: ${errorText(error)}`);
  }
}
