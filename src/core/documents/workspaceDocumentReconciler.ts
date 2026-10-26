import { parse, type WorkspaceData } from "../storage";
import { workspaceNameFromFile } from "./fileNames";
import { hashText } from "./hashText";
import type { DiskSnapshot } from "./fileAccess";
import type { WorkspaceFileBinding } from "./fileBindingStore";
import {
  clearSyncConflict,
  getFileView,
  getSyncConflict,
  removeFileView,
} from "./syncState";
import {
  cancelScheduledWrite,
  commitWrite,
  isWorkspaceKnown,
  loadBindings,
  localDocument,
  markSaved,
  persistBinding,
  readDisk,
  registerConflict,
  replaceWorkspaceFromDisk,
  reportAccessError,
  safeWrite,
  updateView,
  withFileLock,
  withSuspended,
  workspaceName,
} from "./workspaceDocumentCore";
import type {
  DocumentRuntime,
  LocalDocument,
} from "./workspaceDocumentTypes";

export async function bootDocuments(runtime: DocumentRuntime): Promise<void> {
  if (runtime.booted) return;
  runtime.booted = true;
  runtime.unsubscribeEditor = runtime.editor.subscribe(() =>
    onEditorChange(runtime),
  );
  const persisted = await loadBindings(runtime);
  runtime.bindings = new Map(persisted.map((binding) => [binding.workspaceId, binding]));
  for (const binding of [...runtime.bindings.values()]) {
    await reconcileWorkspaceBinding(runtime, binding);
  }
  runtime.visibilityListener = () => onVisibilityChange(runtime);
  document.addEventListener("visibilitychange", runtime.visibilityListener);
  scheduleNextPoll(runtime);
  openChannel(runtime);
}

export function disposeDocuments(runtime: DocumentRuntime): void {
  runtime.booted = false;
  runtime.unsubscribeEditor?.();
  runtime.unsubscribeEditor = null;
  for (const timer of runtime.writeTimers.values()) clearTimeout(timer);
  runtime.writeTimers.clear();
  if (runtime.pollingTimer) clearTimeout(runtime.pollingTimer);
  runtime.pollingTimer = null;
  if (runtime.visibilityListener) {
    document.removeEventListener("visibilitychange", runtime.visibilityListener);
    runtime.visibilityListener = null;
  }
  runtime.channel?.close();
  runtime.channel = null;
}

/** re-reads every bound file immediately (manual refresh and tests) */
export async function refreshAllDocuments(runtime: DocumentRuntime): Promise<void> {
  await pollAll(runtime);
}

function onEditorChange(runtime: DocumentRuntime): void {
  if (!runtime.booted || runtime.suspended > 0) return;
  const workspaceId = runtime.editor.getSnapshot().activeWorkspaceId;
  if (!workspaceId || !runtime.bindings.has(workspaceId)) return;
  if (getSyncConflict(workspaceId)) return;
  scheduleWrite(runtime, workspaceId);
}

function scheduleWrite(runtime: DocumentRuntime, workspaceId: string): void {
  cancelScheduledWrite(runtime, workspaceId);
  const timer = setTimeout(() => {
    runtime.writeTimers.delete(workspaceId);
    void flush(runtime, workspaceId);
  }, runtime.writeDelayMs);
  runtime.writeTimers.set(workspaceId, timer);
}

export async function flush(
  runtime: DocumentRuntime,
  workspaceId: string,
): Promise<void> {
  const binding = runtime.bindings.get(workspaceId);
  if (!binding || getSyncConflict(workspaceId)) return;
  const local = await localDocument(runtime, workspaceId, binding);
  if (!local) return;
  if (local.hash === binding.lastSyncedHash) {
    markSaved(runtime, binding);
    return;
  }
  await writeIfBaseUnchanged(runtime, workspaceId, binding, local);
}

async function writeIfBaseUnchanged(
  runtime: DocumentRuntime,
  workspaceId: string,
  binding: WorkspaceFileBinding,
  local: LocalDocument,
): Promise<void> {
  await withFileLock(workspaceId, async () => {
    updateView(runtime, workspaceId, binding.fileName, "saving");
    const disk = await readDisk(runtime, binding);
    if (!disk) return;
    const diskHash = await hashText(disk.text);
    if (diskHash !== binding.lastSyncedHash) {
      registerConflict(runtime, binding, disk, diskHash);
      return;
    }
    await writeLocal(runtime, binding, local);
  });
}

async function writeLocal(
  runtime: DocumentRuntime,
  binding: WorkspaceFileBinding,
  local: LocalDocument,
): Promise<void> {
  const written = await safeWrite(runtime, binding, local.text);
  if (!written) return;
  await commitWrite(runtime, binding, local.hash, written);
}

export async function reconcileWorkspaceBinding(
  runtime: DocumentRuntime,
  binding: WorkspaceFileBinding,
): Promise<void> {
  if (!isWorkspaceKnown(runtime, binding.workspaceId)) {
    await recoverOrRead(runtime, binding);
    return;
  }
  let granted = false;
  try {
    granted = await runtime.access.queryPermission(binding.handle);
  } catch (error) {
    reportAccessError(runtime, binding, error);
    return;
  }
  if (!granted) {
    updateView(runtime, binding.workspaceId, binding.fileName, "permission");
    return;
  }
  const disk = await readDisk(runtime, binding);
  if (!disk) return;
  await reconcileDisk(runtime, binding, disk);
}

async function recoverOrRead(
  runtime: DocumentRuntime,
  binding: WorkspaceFileBinding,
): Promise<void> {
  const disk = await readDisk(runtime, binding);
  if (!disk || !disk.text.trim()) return;
  const data = parse(disk.text);
  if (!data) {
    updateView(runtime, binding.workspaceId, binding.fileName, "invalid");
    return;
  }
  await adoptDisk(runtime, binding, disk, await hashText(disk.text), data);
}

async function reconcileDisk(
  runtime: DocumentRuntime,
  binding: WorkspaceFileBinding,
  disk: DiskSnapshot,
): Promise<void> {
  const workspaceId = binding.workspaceId;
  const local = await localDocument(runtime, workspaceId, binding);
  if (disk.text.trim() === "") {
    if (local) await writeOverEmpty(runtime, workspaceId, binding, local);
    return;
  }
  const data = parse(disk.text);
  if (!data) {
    updateView(runtime, workspaceId, binding.fileName, "invalid");
    return;
  }
  const diskHash = await hashText(disk.text);
  if (diskHash === binding.lastSyncedHash) {
    if (!local || local.hash === diskHash) {
      markSaved(runtime, binding);
      return;
    }
    await writeIfBaseUnchanged(runtime, workspaceId, binding, local);
    return;
  }
  if (
    !local ||
    local.hash === binding.lastSyncedHash ||
    local.hash === diskHash
  ) {
    await adoptDisk(runtime, binding, disk, diskHash, data);
    return;
  }
  registerConflict(runtime, binding, disk, diskHash);
}

async function writeOverEmpty(
  runtime: DocumentRuntime,
  workspaceId: string,
  binding: WorkspaceFileBinding,
  local: LocalDocument,
): Promise<void> {
  await withFileLock(workspaceId, async () => {
    updateView(runtime, workspaceId, binding.fileName, "saving");
    const disk = await readDisk(runtime, binding);
    if (!disk) return;
    if (disk.text.trim() !== "") {
      registerConflict(runtime, binding, disk, await hashText(disk.text));
      return;
    }
    await writeLocal(runtime, binding, local);
  });
}

async function adoptDisk(
  runtime: DocumentRuntime,
  binding: WorkspaceFileBinding,
  disk: DiskSnapshot,
  diskHash: string,
  data: WorkspaceData,
): Promise<void> {
  const previousId = binding.workspaceId;
  const displayName =
    workspaceName(runtime, previousId) ||
    workspaceNameFromFile(binding.fileName);
  const targetId = isWorkspaceKnown(runtime, previousId)
    ? replaceWorkspaceFromDisk(runtime, previousId, data, displayName)
    : withSuspended(runtime, () =>
        runtime.editor.openWorkspaceFile(
          data,
          workspaceNameFromFile(binding.fileName),
        ),
      );
  const next: WorkspaceFileBinding = {
    ...binding,
    workspaceId: targetId,
    uid: data.uid ?? binding.uid,
    fileName: binding.handle.name,
    lastSyncedHash: diskHash,
    lastDiskMtime: disk.mtime,
    lastDiskSize: disk.size,
  };
  if (targetId !== previousId) {
    runtime.bindings.delete(previousId);
    removeFileView(previousId);
    await runtime.store.remove(previousId).catch(() => {});
  }
  await persistBinding(runtime, next);
  clearSyncConflict(targetId);
  markSaved(runtime, next);
  runtime.notify(`Updated "${next.fileName}" from disk`);
}

function scheduleNextPoll(runtime: DocumentRuntime): void {
  if (!runtime.booted) return;
  const hidden = document.visibilityState === "hidden";
  const delay = hidden ? runtime.pollHiddenMs : runtime.pollVisibleMs;
  runtime.pollingTimer = setTimeout(() => {
    void pollAll(runtime).finally(() => {
      runtime.pollingTimer = null;
      scheduleNextPoll(runtime);
    });
  }, delay);
}

function onVisibilityChange(runtime: DocumentRuntime): void {
  if (!runtime.booted) return;
  if (runtime.pollingTimer) clearTimeout(runtime.pollingTimer);
  runtime.pollingTimer = null;
  scheduleNextPoll(runtime);
}

async function pollAll(runtime: DocumentRuntime): Promise<void> {
  await Promise.allSettled(
    [...runtime.bindings.keys()].map((workspaceId) =>
      pollWorkspace(runtime, workspaceId),
    ),
  );
}

async function pollWorkspace(
  runtime: DocumentRuntime,
  workspaceId: string,
): Promise<void> {
  const binding = runtime.bindings.get(workspaceId);
  if (!binding || getSyncConflict(workspaceId)) return;
  if (runtime.pollingIds.has(workspaceId)) return;
  runtime.pollingIds.add(workspaceId);
  try {
    let granted = false;
    try {
      granted = await runtime.access.queryPermission(binding.handle);
    } catch (error) {
      reportAccessError(runtime, binding, error);
      return;
    }
    if (!granted) {
      updateView(runtime, workspaceId, binding.fileName, "permission");
      return;
    }
    let stat: { mtime: number; size: number };
    try {
      stat = await runtime.access.stat(binding.handle);
    } catch (error) {
      reportAccessError(runtime, binding, error);
      return;
    }
    const unchanged =
      stat.mtime === binding.lastDiskMtime &&
      stat.size === binding.lastDiskSize;
    if (unchanged && getFileView(workspaceId)?.status === "saved") return;
    const disk = await readDisk(runtime, binding);
    if (!disk) return;
    await reconcileDisk(runtime, binding, disk);
  } finally {
    runtime.pollingIds.delete(workspaceId);
  }
}

function openChannel(runtime: DocumentRuntime): void {
  if (typeof BroadcastChannel === "undefined") return;
  runtime.channel = new BroadcastChannel("archidraw:documents");
  runtime.channel.onmessage = (event: MessageEvent) => {
    const workspaceId = (event.data as { workspaceId?: unknown } | null)
      ?.workspaceId;
    if (typeof workspaceId === "string") {
      void pollWorkspace(runtime, workspaceId);
    }
  };
}
