import { slugify } from "../exporter";

const ARCHIDRAW_EXTENSION = /\.archidraw(\.json)?$/i;

/** `<slugified name>.archidraw` for file-backed workspaces */
export function workspaceFileName(name: string): string {
  return `${slugify(name)}.archidraw`;
}

/**
 * Workspace display name derived from the file name.
 * Example: workspaceNameFromFile("payments-v2.archidraw") === "payments-v2"
 */
export function workspaceNameFromFile(fileName: string): string {
  const base = fileName.replace(ARCHIDRAW_EXTENSION, "").trim();
  return base || "Workspace";
}

/**
 * Suggested name when a sync conflict is preserved as a second file.
 * Example: conflictCopyFileName("payments.archidraw", 1700000000000)
 */
export function conflictCopyFileName(fileName: string, timestamp: number): string {
  const base = workspaceNameFromFile(fileName);
  return `${slugify(base)}-conflict-${timestamp}.archidraw`;
}
