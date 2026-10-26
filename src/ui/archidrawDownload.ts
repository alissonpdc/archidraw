import { downloadBlob } from "../core/exporter";
import { workspaceFileName } from "../core/documents/fileNames";

/** `<slugified name>.archidraw` — shared by the save modal and panel downloads */
export function archidrawFilename(name: string): string {
  return workspaceFileName(name);
}

/**
 * Downloads serialized ArchiDraw JSON as `<slugified name>.archidraw`.
 * Returns false when there is nothing to export (null JSON).
 * Example: downloadArchidraw(editor.serializeWorkspace(id), workspace.name)
 */
export function downloadArchidraw(json: string | null, name: string): boolean {
  if (!json) return false;
  downloadBlob(
    new Blob([json], { type: "application/json" }),
    archidrawFilename(name),
  );
  return true;
}
