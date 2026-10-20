# KB — reload flipped element colors (light/dark): false `mode-switch` at boot

**Symptom:** pressing Cmd+R (refresh) toggled some elements' colors between
light/dark on every reload (e.g. `#d3e1ed` ↔ `#092a48` — same hue, intensity
swapped). It only affected elements with palette colors
(`BASE_COLORS` → `shadesOf`); `DEFAULT_STROKE`/`CONTEXT_STROKE`/custom hex
never changed — which made it look "different from dark/light mode".

**Root cause:** module evaluation order at boot.

1. `main.tsx` imports `App` → (via `AppMenu`) **`bgPrefs.ts` evaluates and
   installs the `MutationObserver` on `data-theme`**, capturing `lastDark` in
   a freshly loaded document (attribute absent → **system** value).
2. Only later does `main.tsx:86` call `applyThemePref(loadThemePref())` →
   sets `data-theme` to the **saved preference**.
3. If the pref contradicts the system (e.g. pref=dark, OS=light), the observer
   sees a false "switch" → dispatches `archidraw:mode-switch` →
   `correlateColorsForTheme()` (`theme.ts` listener) runs and the **autosave
   persists it**.
4. `correlateIntensity` is an **involution** (intensity i → 4−i). Running it
   on every reload: becomes an A↔B toggle forever.

Confirmed with instrumentation: `mode-switch` fired 1× per reload, from the
`MutationObserver` in `bgPrefs.ts`.

**Fix:**
- `bgPrefs.ts` initializes with `applyThemePref(loadThemePref())` **before**
  capturing `lastDark` and installing the observer — the initial application
  is invisible to the observer, under any import order.
- `applyThemePref` (`theme.ts`) is idempotent: only touches the attribute if
  the target value differs (`setAttribute` with an identical value also
  generates a MutationRecord).

**Rule (always follow):** any `data-theme`/`data-skin` observer must be
installed **after** applying the persisted preference, and appliers of
observed attributes must be idempotent — `setAttribute` fires
MutationObserver even with an equal value. Theme event handlers that
**persist via autosave** (`correlateColorsForTheme`) must not be involutions
without per-load idempotency.

**Regression test:** `tests/specs/theme-reload-stability.spec.ts`
(dark pref + light system, paints a rectangle with extreme palette shades,
reload ×2, colors stable).
