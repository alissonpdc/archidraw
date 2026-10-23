# KB — `Editor.getSnapshot()` must return a stable reference

**Symptom:**
- React app re-renders in an infinite loop (or components render far more often
  than any actual state change) after touching the Editor subscription path.

**Root cause:**
- `src/ui/` subscribes via `useSyncExternalStore(editor.subscribe,
  editor.getSnapshot)`. If `getSnapshot()` builds and returns a fresh object on
  every call, React treats each call as a "changed" snapshot and triggers the
  render/subscribe loop again — even when nothing in the document changed.

**Rule (always follow):**
1. `getSnapshot()` caches its result (`snapshotCache`) and returns THE SAME
   object reference until invalidation.
2. Cache invalidation happens ONLY inside `emit()` (i.e., on real state
   changes). Never invalidate as a side effect of a getter.
3. Any new field added to `EditorSnapshot` must be added to the cache-building
   code in `getSnapshot()` and to the invalidation site in `emit()` — not
   computed on the fly inside `getSnapshot()`.

## Where it happened (reference)

- `src/core/editor.ts` — `getSnapshot` computes nothing; it reads
  `this.snapshotCache` and returns it.
- `src/core/editor.ts` — `emit()` clears `snapshotCache` before notifying
  listeners.
- `src/ui/` — subscription via `useSyncExternalStore`.

## Checklist before touching Editor state/getters

- [ ] No new object allocation inside `getSnapshot()`?
- [ ] New snapshot fields invalidated in `emit()`?
- [ ] E2E suite green (`make gate`) — no render-loop/console-error failures?
