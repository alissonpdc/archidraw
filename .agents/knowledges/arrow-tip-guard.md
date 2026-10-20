# KB — Sketch arrow must not overshoot the arrowhead (tip guard)

**Symptom:** E2E `sketch animated shaft never renders past the arrow tip` fails
**flakily** (sometimes `dark` = 0, sometimes 10) for an arrow
`dashed + roughness 3 + animated` drawn from (200,200)→(500,200), sampling dark
pixels at x∈[502,514], y∈[196,204].

**Root cause (twofold):**

1. **Selection handle at the tip contaminates the sample.** The arrow stays
   selected after the draw; the tip handle is a ~7px square centered on the
   tip with a border colored like selection (`#6965db`, luminance ~0.43 < 0.5).
   Its right border falls inside the sampled region → `dark = 10`. Flaky
   because the captured frame varies with the animation's RAF loop.
2. **Rigid misregistration defeated the clamp.** `clampEnd`/`clampStart` in
   `roughPolyline` only pin the geometry in LOCAL space; the rigid transform
   (`translate` up to ±0.9×roughness, rot, scale) shifted the whole polyline,
   so the tip could overshoot the head by ~2-3px even while "clamped".

**Rule (always follow):**

1. When sampling drawing pixels on the canvas, **deselect first** and wait for
   the frame commit:
   ```ts
   await page.evaluate(async () => {
     const ed = (window as any).__editor__;
     ed.clearSelection();
     // 3 frames = commit of the handle-free redraw
     await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));
   });
   ```
2. "Clamped" arrow tips (shaft and head wings) must keep the anchor EXACT in
   final space: the rigid transform's pivot must be the clamp point itself with
   **zero translation** (rot/scale around the tip). Never `translate` a clamp
   point — it is no longer "exact" after that.

## Actual implementation

- `src/core/roughPath.ts` — `roughSegments`: when `clampStart || clampEnd`,
  `ax/ay` = clamped point, translation offset = 0, pivot at `(ax,ay)`.
  ⚠️ The `roughPolyline`→`roughPath.ts` extraction (8ed27ff) reintroduced this
  bug (pivot at bbox center + translate up to ±0.9×roughness); the `unApply` is
  only exact if the pivot is the clamp point with zero translation.
- `tests/specs/arrow-animation.spec.ts:268` — deselects before sampling.
