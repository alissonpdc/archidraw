import { parse } from "../storage";
import { conflictCopyFileName, workspaceNameFromFile } from "./fileNames";
import { hashText } from "./hashText";
import type { WorkspaceFileBinding } from "./fileBindingStore";
import { clearSyncConflict, getSyncConflict } from "./syncState";
import {
  commitWrite,
  errorText,
  isBoundElsewhere,
  localDocument,
  markSaved,
  persistBinding,
  readDisk,
  registerConflict,
  replaceWorkspaceFromDisk,
  safeWrite,
  updateView,
  withFileLock,
  workspaceName,
  writeHandle,
} from "./workspaceDocumentCore";
import { createDocumentUid } from "./workspaceFile";
import type { ConflictChoice, DocumentRuntime } from "./workspaceDocumentTypes";

export async function loadDiskVersion(
  runtime: DocumentRuntime,
  workspaceId: string,
  binding: WorkspaceFileBinding,
  conflict: {
    diskText: string;
    diskHash: string;
    diskMtime: number;
    diskSize: number;
  },
): Promise<boolean> {
  const data = parse(conflict.diskText);
  if (!data) {
    updateView(runtime, workspaceId, binding.fileName, "invalid");
    runtime.notify("The disk version is not a valid ArchiDraw file");
    return false;
  }
  const displayName =
    workspaceName(runtime, workspaceId) ||
    workspaceNameFromFile(binding.fileName);
  replaceWorkspaceFromDisk(runtime, workspaceId, data, displayName);
  const next: WorkspaceFileBinding = {
    ...binding,
    uid: data.uid ?? binding.uid,
    lastSyncedHash: conflict.diskHash,
    lastDiskMtime: conflict.diskMtime,
    lastDiskSize: conflict.diskSize,
  };
  await persistBinding(runtime, next);
  clearSyncConflict(workspaceId);
  markSaved(runtime, next);
  runtime.notify("Loaded the disk version");
  return true;
}

export async function keepLocalVersion(
  runtime: DocumentRuntime,
  workspaceId: string,
  binding: WorkspaceFileBinding,
  conflict: { diskHash: string },
): Promise<boolean> {
  const local = await localDocument(runtime, workspaceId, binding);
  if (!local) return false;
  let kept = false;
  await withFileLock(workspaceId, async () => {
    const disk = await readDisk(runtime, binding);
    if (!disk) return;
    const diskHash = await hashText(disk.text);
    if (diskHash !== conflict.diskHash) {
      registerConflict(runtime, binding, disk, diskHash);
      runtime.notify("The file changed again; review the conflict");
      return;
    }
    const written = await safeWrite(runtime, binding, local.text);
    if (!written) return;
    await commitWrite(runtime, binding, local.hash, written);
    kept = true;
  });
  if (kept) runtime.notify("Kept the workspace version");
  return kept;
}

export async function saveConflictCopy(
  runtime: DocumentRuntime,
  workspaceId: string,
  binding: WorkspaceFileBinding,
  conflict: { fileName: string },
): Promise<boolean> {
  if (!runtime.picker.isSupported()) {
    runtime.notify("Saving a copy requires Chrome or Edge");
    return false;
  }
  const suggested = conflictCopyFileName(conflict.fileName, runtime.now());
  let handle: FileSystemFileHandle | null = null;
  try {
    handle = await runtime.picker.saveArchidraw(suggested);
  } catch (error) {
    runtime.notify(`Could not save copy: ${errorText(error)}`);
    return false;
  }
  if (!handle) return false;
  if (await runtime.access.sameEntry(handle, binding.handle)) {
    return keepLocalVersion(runtime, workspaceId, binding, {
      diskHash: getSyncConflict(workspaceId)?.diskHash ?? "",
    });
  }
  if (await isBoundElsewhere(runtime, handle, workspaceId)) {
    runtime.notify(`"${handle.name}" is already open in another workspace`);
    return false;
  }
  // the copy is a new document, so it must not carry the original uid
  const uid = createDocumentUid();
  const displayName =
    workspaceName(runtime, workspaceId) ||
    workspaceNameFromFile(handle.name);
  const text = runtime.editor.serializeWorkspaceFile(workspaceId, {
    uid,
    name: displayName,
  });
  if (text === null) return false;
  const written = await writeHandle(runtime, handle, text);
  if (!written) return false;
  const next: WorkspaceFileBinding = {
    ...binding,
    uid,
    fileName: handle.name,
    handle,
    lastSyncedHash: await hashText(text),
    lastDiskMtime: written.mtime,
    lastDiskSize: written.size,
  };
  await persistBinding(runtime, next);
  clearSyncConflict(workspaceId);
  markSaved(runtime, next);
  runtime.notify(`Saved a copy as "${handle.name}"`);
  return true;
}

export async function resolveDocumentConflict(
  runtime: DocumentRuntime,
  workspaceId: string,
  choice: ConflictChoice,
): Promise<boolean> {
  const conflict = getSyncConflict(workspaceId);
  const binding = runtime.bindings.get(workspaceId);
  if (!conflict || !binding) return false;
  if (choice === "disk") {
    return loadDiskVersion(runtime, workspaceId, binding, conflict);
  }
  if (choice === "mine") {
    return keepLocalVersion(runtime, workspaceId, binding, conflict);
  }
  return saveConflictCopy(runtime, workspaceId, binding, conflict);
}
