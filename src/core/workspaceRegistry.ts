import type { WorkspaceData } from "./storage";
import { parse } from "./storage";

const INDEX_KEY = "archidraw:workspaces";
const DATA_PREFIX = "archidraw:workspaces:";
const LEGACY_WORKSPACE_KEY = "archidraw:workspace";

export interface WorkspaceMeta {
  id: string;
  name: string;
  updatedAt: number;
}

export interface WorkspaceIndex {
  metas: WorkspaceMeta[];
  activeId: string | null;
}

export interface WorkspaceBootEntry {
  meta: WorkspaceMeta;
  data: WorkspaceData;
}

export interface WorkspaceBoot {
  entries: WorkspaceBootEntry[];
  activeId: string | null;
}

interface RawIndexRecord {
  metas?: unknown;
  activeId?: unknown;
}

const isValidMeta = (raw: unknown): raw is WorkspaceMeta =>
  typeof raw === "object" &&
  raw !== null &&
  typeof (raw as WorkspaceMeta).id === "string" &&
  typeof (raw as WorkspaceMeta).name === "string" &&
  typeof (raw as WorkspaceMeta).updatedAt === "number";

/** reads and validates the workspace index; null when absent or malformed */
export function readIndex(): WorkspaceIndex | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(INDEX_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const rec = parsed as RawIndexRecord;
  if (!Array.isArray(rec.metas)) return null;
  const metas = rec.metas.filter(isValidMeta);
  const activeId = typeof rec.activeId === "string" ? rec.activeId : null;
  return { metas, activeId };
}

export function writeIndex(index: WorkspaceIndex) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // quota exceeded or storage unavailable — persistence is best-effort
  }
}

/** writes one workspace's data blob (no-op on storage failures) */
export function writeWorkspaceData(id: string, json: string): boolean {
  try {
    localStorage.setItem(DATA_PREFIX + id, json);
    return true;
  } catch {
    return false;
  }
}

export function readWorkspaceData(id: string): string | null {
  try {
    return localStorage.getItem(DATA_PREFIX + id);
  } catch {
    return null;
  }
}

export function removeWorkspaceEntry(id: string) {
  try {
    localStorage.removeItem(DATA_PREFIX + id);
  } catch {
    // ignore
  }
}

function removeLegacyWorkspace() {
  try {
    localStorage.removeItem(LEGACY_WORKSPACE_KEY);
  } catch {
    // ignore
  }
}

/**
 * boots the workspace store: registry lookup with one-time migration of the
 * legacy single-key autosave (`archidraw:workspace`) into a registry entry.
 * Returns the parsed entries to hydrate into the Editor (may be empty).
 * Legacy data with an invalid/unknown schema is discarded (boots clean).
 */
export function bootWorkspaceStore(): WorkspaceBoot {
  const existing = readIndex();

  if (existing) {
    const entries = existing.metas
      .map((meta) => {
        const json = readWorkspaceData(meta.id);
        if (!json) return null;
        const data = parse(json);
        if (!data) return null;
        return { meta, data };
      })
      .filter((e): e is WorkspaceBootEntry => e !== null);
    return { entries, activeId: existing.activeId };
  }

  const legacyJson = (() => {
    try {
      return localStorage.getItem(LEGACY_WORKSPACE_KEY);
    } catch {
      return null;
    }
  })();

  const data = legacyJson ? parse(legacyJson) : null;
  removeLegacyWorkspace();
  if (!legacyJson || !data) {
    return { entries: [], activeId: null };
  }

  const meta: WorkspaceMeta = {
    id: `ws_${Date.now().toString(36)}`,
    name: "Workspace 1",
    updatedAt: Date.now(),
  };
  writeIndex({ metas: [meta], activeId: meta.id });
  writeWorkspaceData(meta.id, JSON.stringify(data));
  return { entries: [{ meta, data }], activeId: meta.id };
}
