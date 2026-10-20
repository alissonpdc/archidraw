# canvas pixel sampling traps in E2E specs

## Group handles cover the sample row

With `selectedIds.size > 1` the group bounding box gets 8 handles at the
corners and edge midpoints. Scanning horizontally at **y = midpoint** (e.g.
130 for a union box spanning y=100..160) always samples the middle-left/right
handle square (8×8 white fill + colored stroke painted AFTER member shapes),
hiding whatever the shapes drew there. Sample rows between handles (y=115,
y=140–145) or scan a full row strip inside a single `getImageData` readback.

## one getImageData per page

The Playwright fixture fails the test on any console warning. Chromium logs
"Multiple readback operations using getImageData are faster with
willReadFrequently" from the ~3rd rapid readback. Batch ALL sample points of a
test into ONE readback of a region (e.g. scan rows y=110..150 in a single call
and slice columns in JS).

## themed colors are not what tokens.css `:root` says

The test build loads the **blueprint** skin by default:
`--selection-color: #1e5aa8`, not the `#0f766e` of the base `:root` block.
Reading `getComputedStyle(...).getPropertyValue("--selection-color")` at
runtime is the only reliable source. For deterministic pixel assertions, set
your own CSS variable (e.g. `--selection-color: #00ff00`) via
`page.addInitScript` BEFORE the app mounts — `readThemeColors` only re-runs on
`data-theme` / `data-skin` mutations, so inline style changes made after mount
are ignored.

## paste JSON rewrites ids

`pasteFromText` → `insertPasted` generates fresh element ids; asserting pasted
members by the ids written in the clipboard payload fails ("Expected length
11, received 0"). Assert by element type / computed attributes (e.g. the
pasted rectangle's `angle`) instead.
