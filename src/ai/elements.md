## 3. Element model

### 3.1 Coordinate system and z-order

- Scene units are pixels at zoom `1`. The Y axis grows downward.
- For rectangles, diamonds, ellipses, polygons, components, contexts and text, `x` and `y` are the top-left corner of the bounding box and `width`/`height` are positive.
- A `polygon` (boolean result) keeps its real outline in `rings`; `x`, `y`, `width` and `height` are just the bounding box of those rings and must match it whenever you write the element by hand.
- For lines and arrows, `x` and `y` are the start point and `x + width`, `y + height` are the end point. `width` and `height` are signed, so a stroke going up-left uses negative values.
- `angle` is in radians, clockwise, around the center of the box. The `x`, `y`, `width` and `height` values always describe the unrotated box.
- `borderRadius` is a percentage of the smaller side, from `0` to `100`.
- `opacity`, `strokeOpacity` and `fillOpacity` range from `0` to `1` and multiply each other.
- Elements render in array order: index `0` is the bottommost layer. The app keeps context elements beneath their children, so list a context before the elements it contains.

### 3.2 Common fields

Present on every element. The default column applies to the clipboard normalizer; in a `.archidraw` file write every base field explicitly.

| Field | Type | Default on paste | Notes |
|---|---|---|---|
| id | string | generated as `el_<base36>_<base36>` | unique within the document; always regenerated on paste |
| type | ElementType | required | an unknown value rejects the whole clipboard payload |
| x | number | 0 | scene X of the top-left corner |
| y | number | 0 | scene Y of the top-left corner |
| width | number | 100 | signed run for line and arrow |
| height | number | 100 | signed run for line and arrow |
| strokeColor | string | `#3d4248` | native UI palette hex (`15×5`) or sentinel (`#3d4248`, `#c4c7ca`, `transparent`); read `/ai/catalog.md` before picking one |
| backgroundColor | string | `#dfe0e2` | native UI palette hex (`15×5`), `#dfe0e2`, or `transparent` for no fill (use `'transparent'` on `component` elements so no background card is drawn); read `/ai/catalog.md` |
| strokeWidth | number | 1 | **Native UI Thickness presets: `1`, `2`, `4`, `8`** (plus `0` on `component` icons so no box outline is drawn). Never use fractional or custom widths like `1.5` or `3`. |
| opacity | number | 1 | alpha of the whole element, `0` to `1` (UI slider uses `0.05` / `5%` steps). This is the scale everywhere in this document, including native library items; the only place that uses 0 to 100 is the Excalidraw dialect of section 5.2 |
| strokeOpacity | number | 1 | alpha of the outline (`0` to `1`) |
| fillOpacity | number | 1 | alpha of the fill (`1` for filled shapes, `0` for unfilled `component`/`context`) |
| strokeStyle | StrokeStyle | `solid` | **Native UI Stroke Type presets: `"solid"`, `"dashed"`, `"dotted"`, `"dashdot"`**. Note: on `arrow`, `animated: true` is ONLY enabled in the UI when `strokeStyle` is `"dashed"`, `"dotted"`, or `"dashdot"` (`"solid"` must always have `animated: false`). |
| fillStyle | FillStyle | `solid` | **Native UI Fill Type presets: `"solid"`, `"hachure"`, `"cross-hachure"`** |
| roughness | integer 0 to 3 | 0 | **Native UI Stroke Style presets: `0` (Architect), `1` (Draft — default for library components), `2` (Sketchy), `3` (Chaos)**. Set `roughness: 1` (`Draft`) on surrounding shapes, contexts and arrows to match the hand-drawn sketch default of library items seamlessly. |
| borderRadius | number | 0 | **Native UI Roundness presets: `0` (Square), `100` (Rounded), or `1..99` (Custom: `10` on `context`, `20` on `component`, `8`–`25` on `rectangle`)**; only `rectangle`, `component` and `context` round their corners — every other type uses `0` |
| angle | number | 0 | radians, clockwise, around the box center |
| groupId | string | none | elements sharing a groupId move, select and resize together |
| locked | boolean | false | disables direct manipulation |
| details | string | none | free-form Markdown shown as an "i" badge and rendered for humans on hover — see section 3.8 |
| fontFamily | string | app default | **Omit `fontFamily`** (so the app automatically picks its native **Sans** or **Sketch** font from `roughness`), or use one of the **4 exact native UI Family strings**: `'"Segoe UI", system-ui, sans-serif'` (Sans), `'"Architects Daughter", cursive'` (Sketch), `'Georgia, "Times New Roman", serif'` (Serif), `'Consolas, "SF Mono", monospace'` (Consolas). Never invent font names like `"Inter"` or `"Arial"`. |
| bold | boolean | false | |
| italic | boolean | false | |
| underline | boolean | false | |
| textColor | string | `""` (Auto — inherits `strokeColor`) | **Prefer `""` (empty string) to activate the native UI `Auto` button**, which inherits `strokeColor` and adapts to light/dark themes automatically. Only set an explicit palette colour when `strokeColor` is a light sentinel like `#c4c7ca` on `context` (use `"#26292c"` or `"#3d4248"`). |
| lineSpacing | number | 1.25 | line height multiplier for multi-line text |
| fontSize | number | 20 for labels and text, 14 for context labels, 12 for component labels | **Use ONLY the native UI Size presets: `14` (`S`), `20` (`M`), `28` (`L`), `36` (`XL`)** (plus `12` default on `component`). Never use custom sizes like `11`, `13`, `14`, `18`, or `22` — instead, use `14` (`S`) or `20` (`M`) and size the box (`width`, `height`) and corridors to fit! |
| textAlign | TextAlign | `center` for labels, `left` for text elements | |
| textVAlign | TextVAlign | `middle` | |
| textOffsetGlobal | number | 0 for text elements, 8 for shape and context labels | base inset applied on the aligned side only; ignored when the alignment is `center`/`middle` |
| textOffsetTop | number | 0 | pixels added to the side offset; only read for `textVAlign: "top"` (or a context's top corners) |
| textOffsetBottom | number | 0 | pixels added to the side offset; only read for `textVAlign: "bottom"` (or a context's bottom corners) |
| textOffsetLeft | number | 0 | pixels added to the side offset; only read for `textAlign: "left"` (or a context's left corners) |
| textOffsetRight | number | 0 | pixels added to the side offset; only read for `textAlign: "right"` (or a context's right corners) |
| captionPosition | CaptionPosition | `bottom` | side that carries a `component` caption — the only label it moves; the details badge has its own fixed anchor (bottom-right corner on shapes, below the label on edges) |
| captionGap | number | 2 | pixels between the element and its caption |
| captionOffsetTop | number | 0 | pixels, caption fine tuning |
| captionOffsetBottom | number | 0 | pixels, caption fine tuning |
| captionOffsetLeft | number | 0 | pixels, caption fine tuning |
| captionOffsetRight | number | 0 | pixels, caption fine tuning |

> **Palette & Component Catalog:** For the 15-hue Color Palette Table (3:1 contrast rules) and the 62 official `componentId` icons (section 3.7), read **`/ai/catalog.md`**.

#### 3.2.1 Native UI Presets & Controls (Never Invent Custom Values)

Every visual control in ArchiDraw's Properties Panel compares exact preset values (`===`). Always use **only** the native UI presets below so that selecting any element in the UI highlights its active buttons:

| UI Control | JSON Field | Exact Native UI Presets (Only Allowed Values) |
|---|---|---|
| **Size** | `fontSize` | **`14` (`S`)**, **`20` (`M`)**, **`28` (`L`)**, **`36` (`XL`)** *(plus `12` default on `component` captions)*. Never use `11`, `13`, `16`, `18`, `22` — use `14` (`S`) or `20` (`M`) and size the box/corridor to fit! |
| **Family** | `fontFamily` | Omit `fontFamily` (auto-selects Sans for `roughness: 0` or Sketch for `roughness >= 1`), or write one of the 4 exact UI strings: `'"Segoe UI", system-ui, sans-serif'`, `'"Architects Daughter", cursive'`, `'Georgia, "Times New Roman", serif'`, `'Consolas, "SF Mono", monospace'`. |
| **Stroke Thickness** | `strokeWidth` | **`1`**, **`2`**, **`4`**, **`8`** *(plus **`0`** on `component` icons)*. Use `2` on `rectangle`/`diamond`/`ellipse`, `1` (or `2`) on `arrow`/`line`, `1` on `context`, `0` on `component`. |
| **Stroke Type & Animation** | `strokeStyle`, `animated` | `"solid"`, `"dashed"`, `"dotted"`, `"dashdot"`. **UI Rule:** The Animation toggle is disabled when `strokeStyle === "solid"`. Only set `animated: true` when `strokeStyle` is `"dashed"`, `"dotted"`, or `"dashdot"`; `"solid"` must always have `animated: false`. |
| **Stroke Style** | `roughness` | **`0` (Architect)**, **`1` (Draft)**, **`2` (Sketchy)**, **`3` (Chaos)**. |
| **Path Type & Arrowheads** | `lineType`, `startArrowhead`, `endArrowhead` | `lineType`: `"straight"`, `"curved"`, `"auto"`. Arrowheads: `"none"`, `"circle"`, `"arrow"`, `"triangle"`. |
| **Roundness** | `borderRadius` | **`0` (Square)**, **`100` (Rounded)**, or **`1..99` (Custom: `10` on `context`, `20` on `component`, `8`–`25` on `rectangle`)**. All other types use `0`. |
| **Colors & Text Color Auto** | `strokeColor`, `backgroundColor`, `textColor` | Use only the **75 hex values from the 15×5 palette** in `/ai/catalog.md` plus `#3d4248`, `#dfe0e2`, `#c4c7ca`, `transparent`. Set **`"textColor": ""` (Auto)** on shapes, components, and arrows so the UI's native **Auto** button is active (inheriting `strokeColor` and adapting to light/dark themes); only set an explicit dark `textColor` (`"#26292c"`) on `context` when `strokeColor` is `"#c4c7ca"`. |

### 3.3 Type-specific fields

| Element type | Extra fields |
|---|---|
| rectangle, diamond, ellipse | `label` (string) — drawn inside the box |
| polygon | `rings` (required, array of rings of `{x, y}` points), `label` (string) — drawn inside the box. `rings[0]` is the outer ring; every following ring is a hole. Coordinates are local to the element: `(0, 0)` is the top-left corner `x, y`, so moving the element only rewrites `x`/`y`. Rings are open — do not repeat the first point at the end — and need at least 3 points each |
| line | `label`, `labelT`, `lineType`, `controlPoint`, `bendPoints`, `startBinding`, `endBinding` |
| arrow | all line fields plus `animated` (boolean, default false), `startArrowhead` (default `none`), `endArrowhead` (default `arrow`) |
| text | `text` (string, defaults to empty), `fontSize` (number, defaults to 20) |
| component | `componentId` (string, defaults to empty), `label` (caption drawn outside the box, on the `captionPosition` side), `src` (data URL of a raster), `fill` (boolean, default false; true stretches the raster to the whole box). The catalog id picks a bundled icon — see section 3.7 in `/ai/catalog.md` |
| context | `label`, `labelPosition` (default `top-left`), `labelSide` (`internal` when created in the app, `external` when missing), `childIds` (array of element id strings) |

Notes on edges:

- An edge never fills its interior: `backgroundColor`, `fillStyle` and `fillOpacity` on a `line` or `arrow` are read and then ignored when drawing it. Write `transparent` and move on.
- **Native UI edge `fontSize: 14` (`S`), `textColor: ""` (Auto), & no `details` on edges:** Always set **`"fontSize": 14`** (the native UI `S` preset) and **`"textColor": ""`** (native UI `Auto`) on every `arrow` or `line` that carries a `label`, and keep `label` concise (**`<= 14` chars**, e.g., `"DNS Query"`, `"HTTPS"`, `"VPC Link"`, `"OrderPlaced"`, `"Async Binlog"`, `"Verify JWT"`, `"IAM Policy"`, `"Max 3 Retries"`). **Do NOT put `details` on `arrow` or `line` elements** — on edges, the `"i"` badge renders `~28 scene px` below the `label` inside routing corridors and collides with parallel lanes, context borders, and arrowheads. Always attach `details` (SLOs, retry policies, replication lag, payload schemas) to the `rectangle` and `component` node elements instead, where the `"i"` badge sits neatly tucked inside the bottom-right corner.
- **Edge Label Plate Width (`plateW = label.length * 10 + 16`) & Minimum Horizontal Run (`>= 180 px`):** At `"fontSize": 14` (`S`), an edge label's opaque background plate is **`plateW = label.length * 10 + 16` pixels wide** (`~116–146 px` wide by `26 px` tall for a `10–13` char label). If two nodes are connected by a short horizontal arrow (such as `60..120 px`), the label plate is wider than the arrow itself and will cover both neighboring icons! Therefore, **every horizontal labeled arrow MUST have at least `180 px` of clear horizontal gap between the source right edge and target left edge (`T.x - (S.x + S.width) >= 180`)**, and you must **never squeeze 3 nodes into the same horizontal row inside a 2-column context**.
- **Native UI Animation rule (`animated: true` requires non-solid `strokeStyle`):** In the Properties Panel, the Animation toggle is disabled when `strokeStyle === "solid"`. Only set `"animated": true` on arrows whose `strokeStyle` is `"dashed"`, `"dotted"`, or `"dashdot"`; arrows with `"strokeStyle": "solid"` must always have `"animated": false`.
- **Smart `labelT` positioning (`0.62` in component stacks, `0.30` on L-bend/Z-bend exit legs, never near a short entry leg):** `labelT` positions the label along the total polyline length from `0` (start) to `1` (end), default `0.5`:
  - On a vertical arrow going `bottom -> top` below a `component` icon (whose `bottom` caption occupies the first `18px` below the icon), leave at least `160 px` vertical step (`100 px` arrow run) and set **`"labelT": 0.62`** so the `14px` (`S`) arrow label is centered in the open gap below the component caption.
  - **Never set `labelT >= 0.65` on a Z-bend whose final horizontal entry leg `(midX, endY) → (endX, endY)` is shorter than `140 px`** — doing so places the `120–140 px` wide horizontal label plate directly on top of the target node `T` or a middle-row icon! Instead, either place the label on the **first open leg (`"labelT": 0.25` to `0.35`)** where it sits in a clear corridor, or route an **L-bend across the top row (`(startX, 260) → (targetCenterX, 260) → (targetCenterX, targetTopY)` with `"labelT": 0.35`)** so the label sits on the `300 px` open horizontal segment!
- `controlPoint` is an absolute scene point that bends a `curved` line or arrow. When a `curved` edge carries no `controlPoint`, the renderer falls back to an arc whose control sits above the midpoint by 30% of the horizontal span.
- `bendPoints` are intermediate vertices used by `auto` routing. The array is all-or-nothing: every item must be a valid `{x, y}` point or the field is dropped.
- `lineType: "auto"` with no `bendPoints` routes orthogonally on its own: the path leaves and enters through the `side` recorded in each binding (falling back to the nearest cardinal side) and the `x`/`y`/`width`/`height` box only feeds the unbound fallback. The `side` values are therefore the knob for a clean right-angle connector. `bendPoints`, when present, replace that automatic polyline.
- File defaults: the loader (section 2.3) fills none of these, and the renderer falls back on every read — a missing `lineType` reads as `straight`, `startArrowhead` as `none`, `endArrowhead` as `arrow`, `labelT` as `0.5`, `animated` as `false`. Omitting them is safe; writing them, as the examples do, is just clearer.
- `componentId` picks the icon from the section 3.7 catalog (`aws-ec2`, `aws-lambda`, `aws-ecs`, `aws-eks`, `aws-api-gateway`, `aws-elb`, `aws-route53`, `aws-cloudfront`, `aws-vpc`, `aws-dynamodb`, `aws-rds`, `aws-elasticache`, `aws-s3`, `aws-sqs`, `aws-sns` and many more, the GCP/Azure/Kubernetes sets included) or a section 3.7.1 System Design item starting with `sd-` (which auto-expands into native editable elements on paste/import).
- `src` holds a self-contained raster such as `data:image/png;base64,...` for pasted or imported images.
- Nothing from the section 5.2 dialect belongs here: `points`, `roundness`, `closed` and the `draw` type exist only on the raster library path, and corner rounding is spelled `borderRadius` in this model. Writing them on a native element does nothing.

Notes on polygons (boolean results): the app writes them from the Layers panel → Merge actions (`union`, `subtract`, `intersect`, `crop`). The operation is destructive — the operands are removed and the result takes their place at the topmost operand's z-position, carrying its stroke and fill style. Each connected solid becomes its own `polygon` element, so joining two disjoint shapes yields two polygons, and a subtraction that leaves two pieces also yields two. `crop` and `subtract` read the topmost selected shape as cutter/mask (`crop` keeps only what falls inside it, `subtract` removes it). A `polygon` is itself a valid operand for a later operation, so results can be combined again. When writing one by hand, keep `x`/`y`/`width`/`height` equal to the ring bounding box; a ring set with an empty outer ring is invalid and the element is rejected on paste.

Note on contexts: `childIds` is read as written — Open never recomputes membership nor prunes the array; a dead id is ignored, not rejected. Fill it with the app's own rule: an element of any type — edges included — belongs to a context when its rotated bounds fall entirely inside the context's bounds, which is what the app records whenever an element is created, pasted or duplicated inside a context (contexts are never members of other contexts). A context the app itself creates is `strokeColor: "#c4c7ca"`, `backgroundColor: "transparent"`, `strokeWidth: 1`, `borderRadius: 10`, `fontSize: 14`, `labelPosition: "top-left"` and `labelSide: "internal"`; copy those values when the drawing needs a plain boundary, and remember that a fill is a real fill — take one from the section 3.2 palette if you want the region tinted. A context's caption is drawn in `textColor`, which falls back to `strokeColor`, so the `#c4c7ca` boundary an app-made context carries gives a deliberately faint region name: set `textColor` (a palette colour) or a darker `strokeColor` when the name has to be read.

### 3.4 Enumerations

| Name | Values |
|---|---|
| ElementType | `rectangle`, `diamond`, `ellipse`, `polygon`, `line`, `arrow`, `text`, `component`, `context` |
| StrokeStyle | `solid`, `dashed`, `dotted`, `dashdot` |
| FillStyle | `solid`, `hachure`, `cross-hachure` |
| LineType | `straight`, `curved`, `auto` |
| ArrowHeadType | `none`, `circle`, `arrow`, `triangle` |
| TextAlign | `left`, `center`, `right` |
| TextVAlign | `top`, `middle`, `bottom` |
| CaptionPosition | `top`, `bottom`, `left`, `right` |
| LabelPosition | `top-left`, `top-right`, `bottom-left`, `bottom-right` |
| BindingSide | `top`, `bottom`, `left`, `right` |
| ContextLabelSide | `internal`, `external` |

All enum values are lowercase strings. An invalid value falls back to the default on paste and is not an error by itself.

### 3.5 Edge bindings

Lines and arrows attach to other elements through `startBinding` and `endBinding`.

| Field | Type | Default | Notes |
|---|---|---|---|
| elementId | string | required | id of the bound element |
| nx | number | 0.5 | horizontal position inside the target bounds, 0 to 1 |
| ny | number | 0.5 | vertical position inside the target bounds, 0 to 1 |
| side | BindingSide | none | hint for the attach side |

#### Exact Binding Anchor & Endpoint Coordinate Table

Always align an arrow's `x, y, width, height` with the bound points on the source (`S`) and target (`T`) elements so both bound and fallback coordinates match to the pixel:

| `side` | Canonical `(nx, ny)` | Exact Scene Coordinate `(anchorX, anchorY)` on Element `E` |
|---|---|---|
| `"top"` | `nx: 0.5, ny: 0` | `anchorX = E.x + E.width * 0.5`, `anchorY = E.y` |
| `"bottom"` | `nx: 0.5, ny: 1` | `anchorX = E.x + E.width * 0.5`, `anchorY = E.y + E.height` |
| `"left"` | `nx: 0, ny: 0.5` | `anchorX = E.x`, `anchorY = E.y + E.height * 0.5` |
| `"right"` | `nx: 1, ny: 0.5` | `anchorX = E.x + E.width`, `anchorY = E.y + E.height * 0.5` |
| General `(nx, ny)` | any `0..1` along `side` | `anchorX = E.x + E.width * nx`, `anchorY = E.y + E.height * ny` |

Given source anchor `(startX, startY)` on `S` and target anchor `(endX, endY)` on `T`:
- `arrow.x = startX`
- `arrow.y = startY`
- `arrow.width = endX - startX` (signed — negative when target is to the left of source)
- `arrow.height = endY - startY` (signed — negative when target is above source)

A binding object without a string `elementId` is dropped. In a file, reference ids that exist in the same `elements` array. On paste, a binding to an element inside the same payload is remapped to its clone; a binding to an element outside the payload keeps referencing the original element in the scene.

### 3.6 Text and label layout

#### Quick Label Placement Decision Table by Element Type

| Element Type | Field | Default Placement | Native UI Presets | Sizing & Non-Overflow Rule |
|---|---|---|---|---|
| `rectangle`, `diamond`, `ellipse`, `polygon` | `label` | Inside box (`center`, `middle`) | `fontSize: 14` (`S`) or `20` (`M`), `strokeWidth: 2`, `textColor: ""` (`Auto`) | **Use `"fontSize": 14` (`S`) or `20` (`M`) and size the box to fit**: `width >= Math.max(230, Math.ceil(maxLineChars * fontSize * 0.62) + 48)` (`240 × 90` for `fontSize: 14` up to `19` chars/line; `260 × 96` for `fontSize: 20` up to `17` chars/line); split lines with `\n` |
| `component` (catalog icon) | `label` | Outside icon (`bottom`) | `fontSize: 12` (or `14` `S`), `strokeWidth: 0`, `fillOpacity: 0`, `borderRadius: 20`, `textColor: ""` (`Auto`) | Only type that reads `captionPosition`; stacked icons need `Δy >= 160` (`100 px` arrow run); side-by-side icons need `Δx >= 240` (`180 px` clear gap) |
| `context` (boundary) | `label` | Corner (`top-left`, `internal`) | `fontSize: 14` (`S`), `strokeWidth: 1`, `borderRadius: 10`, `strokeColor: "#c4c7ca"`, `textColor: "#26292c"` | Set dark palette `textColor` (`#26292c` `Grey · 5`) when `strokeColor` is `#c4c7ca` |
| `line`, `arrow` (edges) | `label` | Centered on stroke (`labelT: 0.5`) | `fontSize: 14` (`S`), `strokeWidth: 1` (or `2`), `textColor: ""` (`Auto`), `labelT` (`0..1`) | **Always set `"fontSize": 14` (`S`) and `"textColor": ""` (`Auto`)**; keep `label <= 14` chars; use `labelT: 0.62` below `component` captions and `0.25`/`0.78` in Z-bend gutters; **do not set `details` on arrows**; only set `animated: true` when `strokeStyle !== "solid"` |
| `text` (free text) | `text` | Inside box (`left`, `middle`) | `fontSize: 28` (`L`) or `36` (`XL`) for titles, `14` (`S`) or `20` (`M`) for notes | Uses `text` (never `label`); size `width >= Math.ceil(maxLineChars * fontSize * 0.62) + 16` and `height >= Math.ceil(fontSize * 1.3)` |

Text elements align inside their own box: `textAlign` picks the horizontal anchor (default `left`), `textVAlign` the vertical one (default `middle`), then `textOffset*` values nudge the block in pixels. A free text box starts flush with its measured content, so its `textOffsetGlobal` defaults to 0; only the side named by the alignment contributes its per-side offset, and a `center`/`middle` alignment ignores the offsets. Multi-line text uses embedded newline characters and `lineSpacing` as the line height multiplier. `textColor` empty or missing falls back to `strokeColor`.

Label placement depends on the type: on `rectangle`, `diamond` and `ellipse` the label sits inside the box, anchored by `textAlign` (default `center`) and `textVAlign` (default `middle`) and inset by the `textOffset*` values — here `textOffsetGlobal` defaults to 8, and, as with text elements, the base inset and the per-side offset are read only on the side the label is aligned to (`center`/`middle` ignore them); on `line` and `arrow` it is centred on the edge point given by `labelT` (midpoint by default) while `textAlign` is `center` (the default) — a non-centre `textAlign` or a `textVAlign` other than `middle` shifts the text block, and its opaque plate, off the stroke, and the `textOffset*` values do not apply to edge labels; the text is painted over an opaque plate of the canvas background padded by `max(2, fontSize × 0.3)`, which masks the stroke under it — a label wider than the clear run of the stroke therefore hides the line it belongs to, so keep it short, move it with `labelT`, or write a separate `text` element where it must sit clear of the stroke; on `component` it sits outside the icon on the `captionPosition` side (default `bottom`), spaced by `captionGap` and the `captionOffset*` values — the only place `captionPosition` applies; on `context` it goes to the corner named by `labelPosition` (default `top-left`), drawn inside the box when `labelSide` is `internal` and outside when `external` (a missing `labelSide` reads as `external` — contexts the app creates start with `internal`), at a distance from the boundary set by `textOffsetGlobal` (default 8) plus the per-side `textOffset*` of the chosen corner.

The box never wraps: lines break only on `\n`, and `width`/`height` are just the anchor rectangle inside which `textAlign` and `textVAlign` position the block — a line longer than `width` keeps drawing past the box, nothing is clipped. Size the box to the content before you place anything next to it: in the default sans font a line is about `fontSize × 0.6 × text.length` pixels wide and `fontSize × 1.25` tall, which is the same estimate section 5.3 uses when it lays the caption of a library tile. Those metrics assume the sans stack; an element with `roughness` 1 or higher and no explicit `fontFamily` renders in the wider sketch font, so measure against the font you actually asked for.

### 3.8 Additional information (`details`)

Every element type accepts an optional `details` string. **Attach `details` to node elements (`rectangle`, `component`, `diamond`, `ellipse`) rather than `arrow`/`line` edges**: on node elements the `"i"` badge sits tucked inside the bottom-right corner with zero corridor footprint, whereas on edges the `"i"` badge hangs below the edge label inside routing corridors. Use `details` on nodes to add complementary information to the drawing when a reader needs more than the label can carry: request and response contracts, payload samples, p95 latency and SLOs, queue or table names, retry and backoff policy, replication lag, owner and on-call rotation, environment, a link to the runbook or ADR, the trade-off behind a component. It is free-form Markdown stored with the element, hidden by default, and rendered for human reading on the canvas on demand. The visible `label` (or a `text` element) carries the name; `details` carries the explanation, so the drawing stays clean at a glance without losing the operational detail.

How a reader reaches it:

- An element whose `details` is a non-empty string gets a small "i" badge. Shapes, text and components place it inset in the bottom-right corner; an unlabeled edge places it on the stroke midpoint; a labeled edge places it just below the label, following `labelT`. Unlike the component caption, the badge anchor does not follow `captionPosition`.
- Hovering the badge — not the element body — opens a read-only **Additional Information** card with the rendered Markdown. The card is scrollable, its links are clickable, and its bottom-right corner can be dragged to resize. Move the pointer away, press Escape, or click outside to dismiss.
- In the app the same text is edited through the element's context menu → Additional Information. Cmd/Ctrl+Enter saves, Escape cancels, and the change goes through undo/redo like any other edit.
- `details` is stored exactly as written by a file or paste. The in-app editor trims it before saving; an empty or whitespace-only value draws no badge and is treated as absent, and clearing the field removes it.

The renderer is a deliberately small, safe Markdown subset:

- Supported blocks: headings, paragraphs (hard-wrapped lines keep their breaks), bullet and ordered lists, blockquotes, thematic breaks, pipe tables and fenced code. Supported inline markup: **bold**, *emphasis*, ~~strikethrough~~, `inline code`, links and bare `https://` autolinks.
- Fenced `json` and `yaml` blocks are pretty-printed and syntax-highlighted (a YAML document the formatter cannot safely re-indent stays verbatim, still highlighted); any other language renders verbatim in a monospace block with no highlighting.
- Raw HTML is never interpreted: tags appear as literal text, so a note cannot inject markup. Only `http://`, `https://` and `mailto:` links become clickable; a bare domain such as `example.com/runbook` is upgraded to `https://`. Other protocols stay literal.
- `![alt](url)` does not load the image. The preview shows the alt text with the URL in its tooltip, so a screenshot or diagram cannot be embedded this way.
- Nested lists are not supported: a list item is one inline line.

Write for the card, not for a full page. It opens at most about 420 px wide, so use short headings, one fact per bullet and fenced code for payload samples instead of wide tables. Information that must be seen without interaction belongs in `label`, `text` or the drawing itself; `details` is supplementary by design.

`details` is a common field (section 3.2), so it survives the `.archidraw` file, the clipboard payload and native `.archidrawlib` items, and it works on all nine element types. A non-string value is dropped on paste. The Excalidraw dialect (section 5.2) has no equivalent field, so a foreign library item without `archidrawElements` cannot carry details. The badge and the card are canvas affordances: SVG and PNG exports contain the drawing only, not the note.

```json
{
  "id": "svc_orders",
  "type": "rectangle",
  "x": 120,
  "y": 140,
  "width": 240,
  "height": 90,
  "strokeColor": "#3d4248",
  "backgroundColor": "#dfe0e2",
  "strokeWidth": 2,
  "opacity": 1,
  "strokeOpacity": 1,
  "fillOpacity": 1,
  "strokeStyle": "solid",
  "fillStyle": "solid",
  "roughness": 0,
  "borderRadius": 8,
  "fontSize": 14,
  "textColor": "",
  "label": "Orders API",
  "details": "## Orders API\n\n- **Endpoint:** `GET /orders`\n- **p95 latency:** 120 ms\n- **Owner:** checkout team\n\nReads from the `orders` table and fans out to SQS. See the [runbook](https://example.com/runbooks/orders) before changing the retry policy."
}
```

The element above draws the label inside the box and an "i" badge at its bottom-right corner. Hovering that badge renders the note as a level-2 heading, a three-item bullet list with inline code, and a paragraph containing a link — exactly the Markdown encoded in the `details` string, with each newline written as `\n` in JSON.

### 3.9 Which fields take effect

Every field in section 3.2 is accepted on every element — the parser never rejects a known field — but the renderer only reads it on the types below. Write a field the type ignores and nothing happens (it is still stored and re-exported).

| Field group | Read by | Not read by |
|---|---|---|
| geometry `x`/`y`/`width`/`height` | all nine types (signed run on `line`/`arrow`) | — |
| `opacity`, `angle`, `groupId`, `locked`, `details` | all nine types | — |
| `strokeColor`, `strokeWidth`, `strokeStyle`, `strokeOpacity`, `roughness` | every type except `text`, which paints glyphs instead of a stroke: it uses a glyph colour from `textColor`/`strokeColor` and ignores `strokeStyle`, `strokeWidth` and `strokeOpacity`. `roughness` does not sketch the glyphs, but it still selects the default font family when `fontFamily` is missing | `text` |
| `backgroundColor`, `fillStyle`, `fillOpacity` | `rectangle`, `diamond`, `ellipse`, `polygon`, `component`, `context` | `line`, `arrow`, `text` |
| `borderRadius` | `rectangle`, `component`, `context` | `diamond`, `ellipse`, `polygon`, `line`, `arrow`, `text` |
| `fontFamily`, `bold`, `italic`, `underline`, `fontSize`, `textColor`, `lineSpacing` | `text` elements and every kind of label; a `context` caption accepts all of them except `underline` | — |
| `textAlign`, `textVAlign` | `text` elements, shape labels and edge labels | `component` and `context` captions, whose position comes from `captionPosition` / `labelPosition` |
| `textOffset*` | shape labels and `context` captions (base inset 8); `text` elements (base inset 0); **not** edge labels, which move with `labelT` and the alignment only | `line`, `arrow`, `component` |
| `captionPosition`, `captionGap`, `captionOffset*` | `component` only | every other type |
| `label` | `rectangle`, `diamond`, `ellipse`, `polygon`, `line`, `arrow`, `component`, `context` | `text` (use `text`) |

Two fill interactions are easy to get wrong:

- **Hachure over a transparent fill.** With `fillStyle: "hachure"` or `"cross-hachure"` and `backgroundColor: "transparent"`, the hachure lines are drawn in `strokeColor` — a transparent background means "no solid block", not "no hatch", so the shape still reads as filled.
- **Contexts always fill solid.** A `context` paints its interior as a flat block and ignores `fillStyle`: `hachure` on a context is silently a solid fill. Set `backgroundColor`/`fillOpacity` to control it.

`angle` is stored on every type and honoured by the canvas and the SVG export, but the UI rotate grip only appears for `rectangle`, `diamond`, `ellipse`, `polygon`, `text`, `component` and `context` — a `line` or `arrow` only rotates when the JSON sets `angle` itself.
