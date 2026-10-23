# KB — workspace index read/write field mismatch silently dropped all data

**Symptom:** every e2e persistence test that relied on reload passed on first
load but the workspace registry was re-seeded from scratch on every app boot —
index was always read as `null` (probes showed `[probe] rawIndex: <valid JSON>`
yet `readIndex()` returned null). Newly created workspaces and their saved
blobs accumulated as orphans (`archidraw:workspaces:{id}` without index meta).

**Root cause:** field name mismatch between writer and reader in
`src/core/workspaceRegistry.ts`. `writeIndex()` persisted
`{ metas: [...], activeId }`, but `readIndex()` validated
`rec.entries` (leftover from an earlier draft of the schema). Validation
`if (!Array.isArray(rec.entries)) return null` turned every valid index into
`null`, so `bootWorkspaceStore()` always took the legacy-migration path.

**Rule (always follow):**
1. Reader and writer of the same storage record MUST be validated against the
   SAME field names declared in one shared type. Keep the raw-record shape in
   a local `interface RawIndexRecord` right next to `readIndex()`, derived
   from the value `writeIndex()` constructs — not from memory.
2. When boot code silently falls back (null → legacy migration), instrument
   with a temporary probe INSIDE `readIndex()` (not inside the boot caller):
   log both `localStorage.getItem(KEY)` and the validator's verdict so a
   writer/reader mismatch shows up immediately.
3. Add a reload regression test that asserts BOTH the index and the blob keys
   survive a reload (`tests/specs/workspaces.spec.ts` › workspaces persist /
   legacy autosave migrates cover this).

**Fix applied:** validated `rec.metas` + typed `RawIndexRecord { metas?: unknown; activeId?: unknown }`.
