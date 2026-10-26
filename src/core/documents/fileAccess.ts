export interface DiskSnapshot {
  text: string;
  mtime: number;
  size: number;
}

export interface FileAccess {
  queryPermission(handle: FileSystemFileHandle): Promise<boolean>;
  requestPermission(handle: FileSystemFileHandle): Promise<boolean>;
  stat(handle: FileSystemFileHandle): Promise<{ mtime: number; size: number }>;
  read(handle: FileSystemFileHandle): Promise<DiskSnapshot>;
  write(handle: FileSystemFileHandle, text: string): Promise<DiskSnapshot>;
  sameEntry(a: FileSystemFileHandle, b: FileSystemFileHandle): Promise<boolean>;
  remove(handle: FileSystemFileHandle): Promise<boolean>;
}

const READ_WRITE = { mode: "readwrite" } as const;

function errorName(error: unknown): string {
  return typeof error === "object" && error !== null
    ? String((error as { name?: unknown }).name ?? "")
    : "";
}

/** true when the file was removed or renamed outside the app */
export function isNotFoundError(error: unknown): boolean {
  return errorName(error) === "NotFoundError";
}

/** true when the browser revoked the granted read/write permission */
export function isPermissionError(error: unknown): boolean {
  return errorName(error) === "NotAllowedError" || errorName(error) === "SecurityError";
}

export const browserFileAccess: FileAccess = {
  async queryPermission(handle) {
    if (!handle.queryPermission) return true;
    return (await handle.queryPermission(READ_WRITE)) === "granted";
  },

  async requestPermission(handle) {
    if (!handle.requestPermission) return true;
    return (await handle.requestPermission(READ_WRITE)) === "granted";
  },

  async stat(handle) {
    const file = await handle.getFile();
    return { mtime: file.lastModified, size: file.size };
  },

  async read(handle) {
    const file = await handle.getFile();
    return {
      text: await file.text(),
      mtime: file.lastModified,
      size: file.size,
    };
  },

  async write(handle, text) {
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    const file = await handle.getFile();
    return { text, mtime: file.lastModified, size: file.size };
  },

  async sameEntry(a, b) {
    try {
      return await a.isSameEntry(b);
    } catch {
      return false;
    }
  },

  async remove(handle) {
    if (!handle.remove) return false;
    await handle.remove();
    return true;
  },
};
