export interface FilePicker {
  isSupported(): boolean;
  openArchidraw(): Promise<FileSystemFileHandle | null>;
  saveArchidraw(suggestedName: string): Promise<FileSystemFileHandle | null>;
}

const PICKER_ACCEPT = {
  "application/json": [".archidraw", ".excalidraw"],
};

const PICKER_ID = "archidraw-workspace-document";

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

/** real Chromium/Edge pickers; Firefox/Safari report unsupported */
export const browserFilePicker: FilePicker = {
  isSupported() {
    return (
      typeof window !== "undefined" &&
      typeof window.showOpenFilePicker === "function" &&
      typeof window.showSaveFilePicker === "function"
    );
  },

  async openArchidraw() {
    const picker = window.showOpenFilePicker;
    if (!picker) return null;
    try {
      const [handle] = await picker({
        types: [{ description: "ArchiDraw workspace", accept: PICKER_ACCEPT }],
        multiple: false,
        id: PICKER_ID,
      });
      return handle ?? null;
    } catch (error) {
      if (isAbortError(error)) return null;
      throw error;
    }
  },

  async saveArchidraw(suggestedName: string) {
    const picker = window.showSaveFilePicker;
    if (!picker) return null;
    try {
      return await picker({
        types: [{ description: "ArchiDraw workspace", accept: PICKER_ACCEPT }],
        suggestedName,
        id: PICKER_ID,
      });
    } catch (error) {
      if (isAbortError(error)) return null;
      throw error;
    }
  },
};

let activePicker: FilePicker = browserFilePicker;

/** replaces the picker implementation (e2e tests and embedding) */
export function setFilePicker(picker: FilePicker): void {
  activePicker = picker;
}

export function resetFilePicker(): void {
  activePicker = browserFilePicker;
}

/**
 * Indirection so the documents service always sees the currently active
 * picker, including pickers installed after the app booted.
 */
export const filePicker: FilePicker = {
  isSupported: () => activePicker.isSupported(),
  openArchidraw: () => activePicker.openArchidraw(),
  saveArchidraw: (suggestedName) => activePicker.saveArchidraw(suggestedName),
};
