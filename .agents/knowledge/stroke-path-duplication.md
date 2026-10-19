# strokeCode duplication hides coverage in new render helpers

## Symptom

A new helper that retraces an element's cached `Path2D` (multi-selection
member highlight) showed ~100 uncovered statements in the E2E coverage run —
every switch branch dead — even though the E2E spec painted all element kinds
and asserted the visual result on real canvas pixels.

## Cause

`drawElement` already populated `cache.strokePath` for every element type with
its own inline construction code (rect / diamond / ellipse / polygon /
line / arrow). A helper using the same WeakMap cache therefore always hit the
early `if (cache.strokePath) return` fast path, and its switched construction
branches never executed. Duplicated path-building code makes the "cached copy"
unreachable.

## Rule

When a render helper needs an element's stroke path, there must be exactly ONE
construction site. `getStrokePath(el)` builds and caches the `Path2D`;
`drawElement` assigns it via `cache.strokePath = getStrokePath(el) ?? undefined`
and strokes the cache. Never rebuild inline the geometry that the helper also
builds — the duplication defeats both DRY and the coverage measurement (the
E2E suite then exercises only the duplicate).

## Coverage debug recipe

`make test` writes `test-results/monocart/coverage/coverage-report.json` with
byte-offset `statements[].start/end`, not line numbers. To map offsets to
lines: read `files[].source`, collect `\n` positions into an offset array, and
`bisect` each zero-count start offset. Zero-count filename lookup:
`files[].sourcePath`. Useful when the regression gate reports a drop with no
line hints.
