## 6. Recipes for agents

### 6.1 Deterministic layout math

Keep coordinates on a grid so shapes align. A column-major layout:

```
originX = 80, originY = 80
boxW = 200, boxH = 90, gutterX = 80, gutterY = 60

column(i) x = originX + i * (boxW + gutterX)
row(j)    y = originY + j * (boxH + gutterY)
```

An arrow between the right edge of box A and the left edge of box B:

```
x      = A.x + A.width
y      = A.y + A.height / 2
width  = B.x - (A.x + A.width)
height = 0
startBinding = { elementId: A.id, nx: 1, ny: 0.5, side: "right" }
endBinding   = { elementId: B.id, nx: 0, ny: 0.5, side: "left" }
```

#### Multi-Context Enterprise Architecture Recipe (Zero Overlaps & Clean Corridors)

When drawing a multi-layer architecture (e.g., Ingress → Microservices → Event Mesh → Data Layer + Bottom Observability/Security bar):

1. **Z-Order, Top Vertical Band Budget & Context Grid:**
   - List all `context` elements **first** in `elements[]` (after optional title/subtitle `text` elements), before any shapes, components or arrows.
   - Include in a context's `childIds` **only** the nodes and intra-context arrows whose bounding boxes fall 100% inside that context's `[x, y, x + width, y + height]`. Cross-context arrows connect two different contexts and must **not** be placed in either context's `childIds`.
   - **Strict Top Vertical Band Budget (Never Overlap Subtitle or Context Headers):**
     - **Title & Subtitle Band (`y = 20 .. 82`):** Place the main title at `y = 20` (`height: 36, fontSize: 28` — native UI `L`) and the subtitle at `y = 60` (`height: 22, fontSize: 16` — native UI `S`, bottom at `y = 82`). **Never route any horizontal arrow segment at `y < 100`**, or the arrow and its `16px` (`S`) label will slice directly through the subtitle text!
     - **Top Cross-Context Corridor Band (`y = 104 .. 148`, max 3 lanes):** Route at most **2–3** long horizontal cross-context arrows (e.g., `CloudFront → Kinesis`, `Order Service → RDS Primary`, `Order Service → RDS Replica`) in dedicated horizontal lanes at **`y = 104`, `y = 126`, and `y = 148`** (staggering their `"labelT"` values across `0.35`, `0.50`, `0.65` so their `fontSize: 16` labels never stack at the same X). Place the target components of those top-corridor arrows (`RDS Primary` and `RDS Read Replica`) in the **top row (`y = 230`)** of the `Data & Replication Layer` so the top-corridor arrows drop straight into their `side: "top"` (`nx: 0.5, ny: 0`) without long vertical drops through the context! Route lower-row cross-context connections (such as `Inventory Service → ElastiCache (Redis)`) through the **bottom inter-row corridor (`y = 815`)** into `ElastiCache`'s `side: "bottom"`, and set **`"labelT": 0.72`** on that bottom-corridor arrow so its `"Redis Cache"` label sits at `x ≈ 1450` (under `Data Layer`), completely clear of the vertical `Notification Worker → CloudWatch` arrow at `x ≈ 1110`!
     - **Main Context Row (`ctx.y = 175`):** Start all main layer `context` boxes at **`y = 175`** (leaving `>= 27 px` above `ctx.y` for the top corridors and keeping `ctx.y .. ctx.y + 40` inside each context 100% clear for its `top-left` `fontSize: 16` header label). Leave at least **`80 px` horizontal gap (`ctxGapX >= 80`)** between adjacent main contexts so vertical inter-context gutters have room for Z-bend arrows.
2. **Component vs. Rectangle Sizing, Two-Column Row Layout & `labelT: 0.62`:**
   - Every catalog `component` (`width: 60, height: 60, strokeWidth: 0, fillOpacity: 0, backgroundColor: "transparent", borderRadius: 20, captionPosition: "bottom", fontSize: 12, textColor: ""`) draws its caption **below** `y + 60` (`y + 62` to `y + 80`), centered horizontally at `x + 30` with a rendered width of `~130 px`.
   - **Vertical spacing (`Δy >= 160 px`) & `labelT: 0.62`:** Always leave at least **`160 px` vertical step** (`row_y(j+1) - row_y(j) >= 160`, giving a **`100 px` arrow run**) between vertically stacked `component` elements, and set **`"labelT": 0.62`** on every vertical `bottom -> top` arrow below a `component` so its native `fontSize: 16` (`S`) arrow label is centered in the open `y + 82 .. y + 160` gap below the upper component's bottom caption!
   - **Strict 2-Column Context Grid & Minimum `180 px` Horizontal Run (Never Put 3 Nodes in the Same Row):**
     - At `fontSize: 16` (`S`), an arrow label's opaque plate is **`plateW = label.length * 10 + 16` (`~116–146 px` wide)**. **Never squeeze 3 nodes into the same horizontal row inside a context** (for example, never put `SQS Orders Queue + Orders DLQ + Fraud Detection Consumer` at the same `y = 425` with only `60 px` between `SQS` and `Orders DLQ` — a `130 px` label like `"Max 3 Retries"` on a `60 px` arrow will completely overlap both icons, and the vertical drop of `EventBridge → Fraud Detection` will slice right over `Orders DLQ`!).
     - Instead, use **strictly 2 columns (`Col 1` and `Col 2`) with at least `180 px` of clear horizontal gap (`Col2.x - (Col1.x + Col1.width) >= 180`)**:
       - In **`Event Mesh & Async Consumers (EDA)`** (`x = 690, y = 175, width = 590, height = 595`), use **3 rows × 2 columns** with `Col 1 at x = 740` (`width: 60`, right edge `800`) and `Col 2 at x = 990` (`width: 240` for `rectangle` consumers or `60` for icons, left edge `990` → **`190 px` clear horizontal gap `x = 800..990`**!):
         - **Row 1 (`y = 230`):** Col 1 `comp_eventbridge` (`x = 740, y = 230`) | Col 2 `comp_kinesis` (`x = 1080, y = 230`).
         - **Row 2 (`y = 390`):** Col 1 `comp_sqs` (`x = 740, y = 390`) | Col 2 `consumer_fraud` (`x = 990, y = 375, width: 240, height: 90`).
           - Connect `comp_eventbridge → comp_sqs` vertically (`(770, 290) → (770, 390)`, `100 px` run, `"labelT": 0.62`, `"label": "Order Events"`).
           - Connect `comp_eventbridge → consumer_fraud` via a 3-segment Z-bend in the `190 px` wide gap (`(800, 260) → bendPoints: [{ "x": 895, "y": 260 }, { "x": 895, "y": 420 }] → (990, 420)`) with **`"labelT": 0.45`** — centering `"OrderPlaced"` at `(895, 330)` in the wide-open `190 px` corridor `x = 800..990` completely clear of every node!
         - **Row 3 (`y = 550`):** Col 1 `comp_sqs_dlq` (`x = 740, y = 550`) | Col 2 `comp_sns` (`x = 1080, y = 550`).
           - Connect `comp_sqs → comp_sqs_dlq` straight vertically (`(770, 450) → (770, 550)`, **`100 px` vertical run**, `"labelT": 0.62`, `"label": "Max 3 Retries"`) — **never use a C-bend around a column neighbor!**
           - Connect `comp_eventbridge` (`side: "bottom"`, `nx: 0.85, ny: 1` at `(791, 290)`) or `svc_payment` (`side: "right"`, `(590, 515)`) or `comp_sqs` (`side: "right"`, `(800, 420) → bendPoints: [{ "x": 895, "y": 420 }, { "x": 895, "y": 580 }] → (1080, 580)` with `"labelT": 0.55` at `(912, 580)`) into `comp_sns` (`side: "left"`, `(1080, 580)`)!
         - **Row 4 (`y = 700`) — OR keep 3 rows by placing `comp_sns` in Col 1 (`x = 740, y = 630`), `consumer_notification` in Col 2 (`x = 990, y = 615`), and `comp_sqs_dlq` in Col 2 (`x = 1080, y = 510` or `x = 990`):**
           - **Cleanest 100% Straight-Arrow Layout in `Event Mesh` (Zero C-Bends):**
             - **Row 1 (`y = 230`):** Col 1 `comp_eventbridge` (`x = 740, y = 230`) | Col 2 `comp_kinesis` (`x = 1080, y = 230`).
             - **Row 2 (`y = 390`):** Col 1 `comp_sqs` (`x = 740, y = 390`) | Col 2 `consumer_fraud` (`x = 990, y = 375, width: 240, height: 90`).
             - **Row 3 (`y = 550`):** Col 1 `comp_sqs_dlq` (`x = 740, y = 550`) — connected straight down from `comp_sqs` (`(770, 450) → (770, 550)`, `"label": "Max 3 Retries"`, `"labelT": 0.62`).
             - **Row 4 (`y = 660`):** Col 1 `comp_sns` (`x = 740, y = 660`) | Col 2 `consumer_notification` (`x = 990, y = 645, width: 240, height: 90`) — where **`svc_payment` (`x = 350, y = 450, width: 240, height: 90`) or `svc_order` publishes to `comp_sns` via the inter-context gutter `x = 645` (`(590, 495) → (645, 495) → (645, 690) → (740, 690)`, `"label": "Payment Event"`, `"labelT": 0.55`)**, and `comp_sns (800, 690) → consumer_notification (990, 690)` is a straight `190 px` horizontal arrow (`"label": "Send Alert"`, `"labelT": 0.5`)! That way **every single arrow inside `Event Mesh` has `>= 100 px` vertical or `>= 190 px` horizontal clear space and ZERO C-bends around `Orders DLQ`**!
       - In **`Data & Replication Layer`** (`x = 1360, y = 175, width = 480`), place `RDS Primary` (`x = 1420, y = 230`) and `RDS Read Replica` (`x = 1680, y = 230`, **`200 px` horizontal arrow run**) in Row 1, and place `DynamoDB` (`x = 1420, y = 510`) and `ElastiCache (Redis)` (`x = 1680, y = 510`) in Row 2.
   - Inside a `context` at `(ctx.x, ctx.y)`, start child elements at `y >= ctx.y + 55` (clearing the `top-left` internal context label) and keep `ctx.y + ctx.height >= maxChildBottom + 45` (clearing bottom component captions).
3. **100% Native UI Presets (`fontSize`, `strokeWidth`, `strokeStyle`, `animated`, `textColor`, Palette Colors) & `details` ONLY on Node Elements:**
   - **Never invent custom values outside the UI presets (`3.2.1`):**
     - **`fontSize`:** Use ONLY **`28` (`L`)** (or `36` `XL`) on the diagram Title, **`16` (`S`)** on the Subtitle, **`16` (`S`)** on `context` headers, **`16` (`S`)** (or `20` `M`) on `rectangle` cards, **`12`** (or `16` `S`) on `component` icons, and **`16` (`S`)** on every labeled `arrow` or `line`. Never use `11`, `13`, `14`, `18`, or `22`!
     - **`rectangle` Box Sizing for Native `fontSize: 16` (`S`) (Zero Text Overflow):** At `fontSize: 16` (`S`, `~9.6 px/char`), a 19-char line like `"Notification Worker"` is `182 px` wide. Always size `rectangle` service and consumer cards to **`width: 240, height: 90`** (`width >= Math.max(230, Math.ceil(maxLineChars * 10) + 48)`, `height >= 90`) and split labels with `\n` so no line exceeds `19` chars (leaving `>= 29 px` horizontal padding on each side and clearing the bottom-right `"i"` badge)!
     - **`strokeWidth`:** Use ONLY **`2`** on `rectangle`/`diamond`/`ellipse`, **`1` or `2`** on `arrow`/`line`, **`1`** on `context`, and **`0`** on `component`. Never use `1.5` or `3`.
     - **`strokeStyle` & `animated`:** In the UI, Animation is disabled on `"solid"` strokes. Only set `"animated": true` when `strokeStyle` is `"dashed"`, `"dotted"`, or `"dashdot"`; `"strokeStyle": "solid"` must always have `"animated": false`.
     - **Colors & `textColor: ""` (`Auto`):** Use only hex colors from the 15×5 UI palette in `/ai/catalog.md` (plus `#3d4248`, `#dfe0e2`, `#c4c7ca`, `transparent`). Set **`"textColor": ""`** (`Auto`) on all `rectangle`, `component`, and `arrow` elements so the UI's native **Auto** button is active; set `"textColor": "#26292c"` (`Grey · 5`) on `context` boundaries whose `strokeColor` is `"#c4c7ca"`.
     - **`fontFamily`:** Omit `fontFamily` (or use `'"Segoe UI", system-ui, sans-serif'`).
   - **Do NOT put `details` on `arrow` or `line` elements!** On an arrow, a `details` string spawns a floating `"i"` badge `~28 scene px` below the arrow `label` inside narrow routing corridors. Keep arrow `label` strings concise (**`<= 14` chars**, e.g., `"DNS Query"`, `"HTTPS"`, `"VPC Link"`, `"OrderPlaced"`, `"Async Binlog"`, `"Verify JWT"`, `"IAM Policy"`, `"Max 3 Retries"`) and attach all `details` (SLOs, payload schemas, replication lag, retry policies) exclusively to the **`rectangle` and `component` node elements**!
4. **Exact Endpoint Matching (Zero Drift Rule):**
   - For every arrow with `startBinding` on element `S` (`nx_s, ny_s`) and `endBinding` on element `T` (`nx_t, ny_t`), compute:
     - `startX = S.x + S.width * nx_s`, `startY = S.y + S.height * ny_s`
     - `endX   = T.x + T.width * nx_t`, `endY   = T.y + T.height * ny_t`
     - Set `x = startX`, `y = startY`, `width = endX - startX`, `height = endY - startY`.
   - Never guess or round arrow endpoints away from `(startX, startY)` and `(endX, endY)`.
5. **Bidirectional Orthogonal Corridor Routing (`lineType: "auto"` + `bendPoints` + `labelT` Staggering):**
   - Never route a straight or 2-segment arrow directly through an unrelated middle box or component — **neither vertically through a column neighbor nor horizontally through a 2-column row neighbor**!
   - **Two-Column Horizontal Non-Obstruction Rule:** In a 2-column context (like `Event Mesh` with `EventBridge` on the left and `SNS Topic` or `Fraud Detection` on the right), **never** exit a left-column node on `side: "right"` to cross rightwards into another context at the same `y` as a right-column neighbor (which would slice straight through `SNS Topic`), and **never** enter a right-column node on `side: "left"` through a left-column neighbor! Instead, connect from a right-column node (e.g., `Fraud Detection Consumer` `side: "right"` → `DynamoDB` `side: "left"`, where `DynamoDB` sits in the left column of `Data Layer`) or route through a clear horizontal inter-row gap (`y = row1Bottom + 45`) between the rows!
   - **Stacked-Column Side-Exit & Bottom-Row Alignment Rule:**
     - If `API Gateway` sits above `Application LB` in `Edge & Ingress` (`comp_apigw` at `x = 120`, `ctx_edge.x = 60`), exit `API Gateway` from **`side: "left"` (`nx: 0, ny: 0.5`)** into the **outer left gutter outside the context (`corridorX = 30`, i.e., `S.x - 90`)** so the `105 px` wide `"Verify JWT"` label centered on `x = 30` (`x = -22..82`) never touches `Application LB` (`x = 120`)!
     - Align the bottom node of `Edge` (`Application LB`, `y = 630..690`) with the bottom card of `Core Microservices` (`Inventory Service`, `y = 610..690`) so `ALB → Inventory Service` is a **straight horizontal arrow (`height = 0`)**, and connect `IAM & KMS` (in the bottom `Observability & Security` row) directly up into `Inventory Service` (`side: "bottom"`, `nx: 0.4, ny: 1`) so it never needs to climb the left gutter alongside `ALB → Order Service`!
   - **Bottom Context Header Protection (`corridorY <= bottomCtx.y - 22`):** Just like top contexts, a bottom full-width context (e.g., `Observability & Security` at `bottomCtx.y = 840` below main contexts ending at `y = 770`) has its `top-left` header label inside `y = bottomCtx.y .. bottomCtx.y + 38`. **Never** place a horizontal `bendPoints` segment inside `[bottomCtx.y, bottomCtx.y + 38]` (such as `y = 840`)! Make all horizontal turns in the **inter-row corridor ABOVE the bottom context (`corridorY = bottomCtx.y - 25`, e.g., `y = 795` and `y = 812`)** and then drop straight down vertically (`x = T.x + 30`) into the target component's top center (`nx: 0.5, ny: 0, side: "top"`).
   - **De-conflicting Z-Bend & Parallel Arrow Labels (`labelT` on the Longest Open Segment, Never on a Short Entry Leg):**
     - Remember that in `fontSize: 16` (`S`), an arrow label plate is `~120–145 px` wide horizontally. **Never set `labelT >= 0.65` on a Z-bend whose final horizontal leg `(midX, endY) → (endX, endY)` is shorter than `150 px`** (for example, on `Fraud Detection Consumer → DynamoDB`, a `100 px` entry leg `(1320, 540) → (1420, 540)` with `labelT: 0.78` puts the `136 px` `"Append Audit"` label right on top of `DynamoDB`!). Instead:
       - Either align `Fraud Detection Consumer` and `DynamoDB` so they connect with a **straight horizontal `200 px` arrow (`(1230, 420) → (1430, 420)`, `height: 0`, `labelT: 0.5`)**, **OR** place the label on the **first horizontal exit leg (`"labelT": 0.25`)** or in a wide vertical drop (`Δy >= 120 px`, `"labelT": 0.5`).
       - On `ALB → Order Service` (`(170, 670) → (255, 670) → (255, 275) → (340, 275)`), set **`"labelT": 0.25`** so `"Forward Req"` sits at `(255, 614)` in the vertical gap between `Payment Service` (`y = 425..515`) and `Inventory Service` (`y = 625..715`).
       - On `EventBridge → Fraud Detection Consumer`, either use a **2-segment L-bend across the top (`(800, 260) → (1110, 260) → (1110, 375)` entering `consumer_fraud` `side: "top"` with `"labelT": 0.35` at `(948, 260)`)**, or a Z-bend in the `190 px` wide gap `x = 800..990` (`(800, 260) → (895, 260) → (895, 420) → (990, 420)` with **`"labelT": 0.45`** centered at `(895, 330)` in the open corridor)!
6. **Camera Auto-Fit for Wide Diagrams:**
   - Compute overall scene bounds `minX, minY, maxX, maxY` across all elements (`spanX = maxX - minX`, `spanY = maxY - minY`).
   - Choose `zoom = Number(Math.min(1, 1180 / spanX, 560 / spanY).toFixed(2))` so the whole architecture fits inside the safe `1280 × 800` viewport band (`x: 50..1230`, `y: 110..670`, completely clear of the top toolbar `0..75` and bottom tab bar `710..800`).
   - Set `scrollX = Math.round(640 - ((minX + maxX) / 2) * zoom)` and `scrollY = Math.round(390 - ((minY + maxY) / 2) * zoom)`.

### 6.2 Operating the three channels

- Import channel: write the workspace JSON to a file named `<name>.archidraw` and open it through the app menu. Success adds one tab per file tab; failure adds nothing and shows an error toast.
- Paste channel: put the clipboard envelope, a bare array or a single element on the clipboard as plain text and trigger paste on the canvas. Success adds one element per array entry; failure is a silent no-op unless the internal store has content.
- Library channel: write the envelope of section 5.1 to a file named `<name>.archidrawlib` and import it through the Library panel. Success adds one group with one tile per item and inserts nothing on the canvas; failure adds nothing and shows `Invalid library file`. Give every item an `archidrawElements` array (section 5.1): that is what makes the tile insert an editable group. An item with only `elements` imports fine but lands as a static image, and the line-style toggle has no effect on it.
- The import and paste channels end with the new elements selected, so a follow-up move or style edit applies to them immediately.

## 8. Agent checklist

- The payload is valid JSON, UTF-8 encoded.
- A file uses `schemaVersion` 2 with a non-empty `tabs` array; every tab has `id`, `name`, `doc` and `camera`.
- A library file uses `version` 2 with a non-empty `libraryItems` array; it never carries `schemaVersion` or `tabs`.
- Every library item carries a non-empty `archidrawElements` array (section 5.1), spelled with the section 3 model: ids, `roughness`, `borderRadius`, `label` and bindings included. An item without it still imports, but it becomes a static image and the line-style / hand-drawn toggle has nothing to act on — `POST /validate` reports that as a warning on rule 5.1.
- Each channel rejects the other envelopes: a workspace file fails the Library import and a `libraryItems` file fails Open, both with a generic error (sections 2.2 and 5.4).
- A library item authored natively follows section 3, not section 5.2: write ids, `roughness`, `borderRadius` and `label`, and use signed `width`/`height` for line and arrow geometry instead of `points`. Section 5.2 is the raster dialect — `opacity` from 0 to 100, `roundness` instead of `borderRadius`, geometry in `points`, no ids, bindings or labels — and it applies only to items that have no `archidrawElements`.
- Every element uses one of the nine ElementType values, spelled exactly as in section 3.4.
- Files spell out all base fields explicitly; only clipboard payloads may rely on defaults.
- Element ids are unique inside their document, and bindings reference ids that exist in the same array or payload.
- Numbers are finite. Angles are radians, `borderRadius` is a percentage and opacities range from 0 to 1 (the section 5.2 raster dialect excepted: `opacity` there runs from 0 to 100).
- Enum values are lowercase strings from the tables above.
- Clipboard payloads are atomic: one invalid item rejects everything, so validate every element before writing the payload.
- Unknown fields are dropped silently, not errors.
- Text elements always carry `text` and `fontSize`.
- **Every element uses 100% native UI presets (section 3.2.1):** `fontSize` in `{16, 20, 28, 36}` (`S=16, M=20, L=28, XL=36`, plus `12` default on `component`), `strokeWidth` in `{0, 1, 2, 4, 8}`, palette hexes from `/ai/catalog.md` (`textColor: ""` `Auto` on shapes, components, and arrows; `"#26292c"` on `context` with `#c4c7ca`), and `animated: true` only when `strokeStyle !== "solid"`.
- **Every `rectangle` card is sized for its native `fontSize` without text overflow:** `width: 240, height: 90` for `fontSize: 16` (`S`) with lines `<= 19` chars (`width >= Math.max(230, Math.ceil(maxLineChars * fontSize * 0.62) + 48)`).
- **Every `arrow` or `line` with a `label` explicitly sets `"fontSize": 16` (`S`) and `"textColor": ""` (`Auto`)** with `label <= 14` chars, **omits `details` on edges** (putting `details` only on node elements `rectangle`/`component`), ensures **every horizontal labeled segment is `>= 180 px` long** (never squeezing 3 nodes in the same row of a 2-column context), uses `"labelT": 0.62` on vertical arrows below `component` captions (`Δy >= 160`), and places `"labelT"` (`0.25..0.45`) on the open leg of Z-bends/L-bends (never `>= 0.65` on a short `< 150 px` entry leg) so arrow label plates never overlap any node or neighboring label.
- Multi-context diagrams respect both vertical and horizontal non-obstruction: no horizontal `bendPoints` at `y < 100` (over title/subtitle), at most 3 top lanes (`y = 104, 126, 148` with `ctx.y = 175`), no horizontal `bendPoints` inside `[ctx.y, ctx.y + 40]` of any top or bottom `context` header, and no arrow slicing vertically through a column neighbor or horizontally through a 2-column row neighbor.
- Every field is accepted on every type, but only the types in section 3.9 read it: `borderRadius` rounds only `rectangle`/`component`/`context`, `line`/`arrow`/`text` ignore the fill fields, and a `context` always fills solid (its `fillStyle` is a no-op). Offset and alignment fields move `text` elements, shape labels and `context` captions as described there; edge labels move only with `labelT` and the alignment.
- Line and arrow geometry uses signed `width` and `height` from start to end.
- A well-known logo (cloud service, Kubernetes object) is a `component` with a `componentId` from the section 3.7 catalog, not a labelled box: the catalog draws the official icon, and a plain box draws only what you wrote. Use a labelled `rectangle`/`ellipse` for a concept the catalog does not cover.
- Complementary information goes in `details` (section 3.8): a Markdown string on any element, shown behind an "i" badge and rendered for humans on hover. Keep the label self-sufficient and put contracts, metrics, owners, policies and links in `details`; never hide something the reader must see without interacting in there.
- The drawing is inside the area the camera shows (section 2.1): with the default camera, keep every element inside roughly `x` 0..1280 and `y` 110..700 — the toolbar sits over the top of the window and the tab bar over the bottom, so a title at `y` < 110 opens hidden — or write a `camera` that centres the drawing.
- Before importing, `POST` the payload to `/validate` (section 7) and fix every returned `error`; a `warning` usually means a defaulted or dropped field you meant to set. In a library, a 5.1 warning means an item would import as a static image instead of an editable group.
