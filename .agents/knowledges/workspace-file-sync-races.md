# KB — workspace file sync: false conflict modals during active drawing

**Symptom:** drawing in a file-backed workspace (`.archidraw`) intermittently triggers the conflict modal:
`"{fileName} was modified outside ArchiDraw while this workspace has unsaved changes."`
even though the file was never opened or modified outside ArchiDraw.

**Root cause:** three concurrent race conditions in `workspaceDocumentReconciler.ts`:
1. **Concurrent flushes:** While an async `safeWrite` was writing to disk, subsequent edits or debounce ticks triggered a second `flush`. The second flush grabbed `binding = runtime.bindings.get(workspaceId)` before the first write called `commitWrite`. The second flush then queued on `withFileLock(workspaceId)`. When the first write finished and wrote to disk, the second flush entered the lock with the *pre-write* `lastSyncedHash`. It read disk (which had the first write's content), saw `diskHash !== binding.lastSyncedHash`, and falsely registered a conflict.
2. **Concurrent polling during write:** The 2-second background poll (`pollWorkspace`) ran while `flush` was in progress (`status === "saving"`). Because line 322 checked `if (unchanged && getFileView(workspaceId)?.status === "saved") return;`, the `"saving"` status caused polling to skip the early return. Polling read disk before or after `commitWrite` with stale hashes, triggering `registerConflict`.
3. **Polling triggering disk writes during draw:** When disk text was unchanged (`diskHash === binding.lastSyncedHash`) but the user was drawing (`local.hash !== diskHash`), polling called `writeIfBaseUnchanged`, bypassing the 800ms autosave debounce and racing with the active debounce timer.

**Rule (always follow):**
- **Track in-flight writes per workspace (`inFlightWrites`, `pendingFlushes`):** If a write is currently in flight, record a pending flush and await the in-flight promise. Never start a concurrent file lock attempt with stale captured state. When the in-flight write finishes, run the pending flush using the freshly committed binding and serialized document.
- **Skip polling during in-flight writes:** `pollWorkspace` must return immediately if `runtime.inFlightWrites.has(workspaceId)` or `getFileView(workspaceId)?.status === "saving"`.
- **Re-read binding inside the lock:** Inside `writeIfBaseUnchanged`, always read `runtime.bindings.get(workspaceId)`. If `diskHash === local.hash`, the content is already committed; update the binding and mark saved instead of registering a conflict.
- **Do not write from polling while drawing:** When `diskHash === binding.lastSyncedHash`, update `lastDiskMtime` and `lastDiskSize` to prevent repeated disk reads. If `local.hash !== diskHash`, only trigger `flush` if no debounce timer is active (`!runtime.writeTimers.has(workspaceId)`).
