import { parse, SCHEMA_VERSION, type WorkspaceData, type WorkspaceTabData } from "../storage";
import type { Camera } from "../types";

const DEFAULT_CAMERA: Camera = { scrollX: 0, scrollY: 0, zoom: 1 };

export interface WorkspaceFileIdentity {
  uid: string;
  name: string;
}

/** creates a stable document identity for a workspace file */
export function createDocumentUid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `doc_${crypto.randomUUID()}`;
  }
  return `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Serializes a workspace for the repository file.
 *
 * Camera and the active canvas are normalized so pan/zoom and tab switching
 * never produce Git diffs. The real view state remains in localStorage.
 */
export function serializeWorkspaceFile(
  tabs: readonly WorkspaceTabData[],
  identity: WorkspaceFileIdentity,
): string {
  const normalized = tabs.map((tab) => ({ ...tab, camera: { ...DEFAULT_CAMERA } }));
  const data: WorkspaceData = {
    schemaVersion: SCHEMA_VERSION,
    uid: identity.uid,
    name: identity.name,
    // the first canvas is a deterministic anchor for the file format
    activeTabId: normalized[0]?.id ?? "",
    tabs: normalized,
  };
  // round-trip through the reader so storage defaults (angle, strokeOpacity,
  // …) are written up front. Otherwise a plain reload would look like a local
  // change and rewrite the file just to add missing defaults.
  const canonical = parse(JSON.stringify(data));
  return `${JSON.stringify(canonical ?? data, null, 2)}\n`;
}
