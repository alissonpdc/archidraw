# KB — FPS/performance assertions: measure per-frame render cost, never rAF cadence

**Symptom:**
- `performance.spec.ts` (or any FPS-related spec) fails intermittently ONLY
  when the full suite runs with many parallel workers, while it passes with
  fewer workers or in isolation.

**Root cause:**
- Asserting on rAF cadence (frames actually delivered per wall-clock second)
  measures OS/browser scheduling under load (half of the CPUs running other
  specs), not the app's rendering cost. With `E2E_WORKERS` high, a perfectly
  healthy app still drops frames because the machine is saturated.

**Rule (always follow):**
1. NEVER assert on rAF cadence / delivered FPS.
2. Measure the per-frame render cost (ms per render callback) and compare it
   against the budget `1000 / PERF_MIN_FPS`.
3. `PERF_ELEMENTS` (default `500`) and `PERF_MIN_FPS` (default `45`) are the
   env governors: defaults are local-only. CI relaxes to `PERF_ELEMENTS=100`
   and `PERF_MIN_FPS=25` — write specs so they honor the env vars, never hard
   -code the local numbers.
4. Keep the sample window deterministic after `open(page)` (no interactions
   inflating isolated frames) when possible.

## Where it happened (reference)

- `e2e/specs/performance.spec.ts` — render-cost measurement vs
  `1000 / PERF_MIN_FPS`.
- `playwright.config.ts` / `Makefile` — `PERF_ELEMENTS` / `PERF_MIN_FPS` env
  wiring (local vs CI values listed in AGENTS.md "Test env vars").

## Checklist before touching performance specs

- [ ] Assertion compares render cost against `1000 / PERF_MIN_FPS` (not FPS)?
- [ ] No hard-coded local governor values (uses env defaults)?
