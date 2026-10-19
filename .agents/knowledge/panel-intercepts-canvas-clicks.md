# E2E: the properties panel intercepts canvas clicks at x < ~260

## Symptom

A spec clicks an element at, say, `(170, 170)` and the editor selection does
not change — sometimes the *previous* selection survives instead. Clicking the
same point with nothing selected works fine.

## Cause

`PropertiesPanel` only mounts while something is selected, and it floats OVER
the canvas on the left edge (~260px wide). With a selection active, any
`page.mouse.click` below that strip is swallowed by the panel, not the canvas.
The panel is unmounted when the selection is empty, which makes the failure
look inconsistent: the first click lands, the next one silently does not.

## Rule

In E2E specs, once a selection exists, keep synthetic canvas clicks at
`x > 260` (and below the centered toolbar, `y > 80`). Coordinates used to
*draw* (no selection yet) are unrestricted.

## Where it bit

`e2e/specs/boolean-ops.spec.ts` — the context-membership test initially placed
its shapes at x 90..220; shift-clicking the second shape did nothing. Shapes
were moved to x 300+ and the same flow passed.
