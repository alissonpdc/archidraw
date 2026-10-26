/**
 * Minimal typings for the non-standard File System Access API surface used by
 * file-backed workspaces. TypeScript's DOM lib still omits pickers,
 * permission queries and handle.remove().
 */

interface ArchidrawFilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface ArchidrawFilePickerOptions {
  types?: ArchidrawFilePickerAcceptType[];
  suggestedName?: string;
  excludeAcceptAllOption?: boolean;
  id?: string;
  multiple?: boolean;
}

interface ArchidrawPermissionDescriptor {
  mode: "read" | "readwrite";
}

declare global {
  interface FileSystemHandle {
    queryPermission?(descriptor: ArchidrawPermissionDescriptor): Promise<PermissionState>;
    requestPermission?(descriptor: ArchidrawPermissionDescriptor): Promise<PermissionState>;
    remove?(): Promise<void>;
  }

  interface Window {
    showOpenFilePicker?(
      options?: ArchidrawFilePickerOptions,
    ): Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?(
      options?: ArchidrawFilePickerOptions,
    ): Promise<FileSystemFileHandle>;
  }
}

export {};
