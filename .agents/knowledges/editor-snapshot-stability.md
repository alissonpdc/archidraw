# KB — `Editor.getSnapshot()` must return a stable reference

**Symptom:** `Editor`-driven React components render in an infinite loop; the
UI freezes or React throws "Maximum update depth exceeded". Bursts of CPU with
no visible state change.

**Root cause:** `src/ui/` subscribes via
`useSyncExternalStore(editor.subscribe, editor.getSnapshot)`. React compares
the snapshot returned by `getSnapshot` on every render — and on every store
notification — with `Object.is`. If the getter builds a fresh object each call
(`return { elements: [...], ... }`), every call yields a value that is never
`Object.is`-equal to the previous one, so React re-renders forever even when
nothing changed.

**Rule (always follow):**

1. `getSnapshot()` returns the **same object reference** between mutations.
   Keep a cached snapshot field on `Editor`.
2. Invalidate/rebuild the cache **only inside `emit()`** (and at
   initialization). Any public `Editor` mutation ends with `emit()`, so the
   cache stays coherent.
3. Never compute the snapshot on the fly, and never return a spread/copy of
   the cached snapshot — return the cached reference itself.
4. Expose derived selectors to `src/ui/` as plain functions over the snapshot
   instead of embedding per-use computation in `getSnapshot()`.
