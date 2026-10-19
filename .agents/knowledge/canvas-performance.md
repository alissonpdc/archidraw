# KB — Escalabilidade e performance de renderização/interação no Canvas 2D

**Sintoma:** queda de FPS ou "soquinhos" (*judder*) ao arrastar múltiplos elementos,
fazer *pan* no intervalo de zoom `50%–150%`, soltar elementos sobre `Context`
(`pointerUp`), dar *hover* ou acionar `undo`/`redo` em diagramas grandes
($N \ge 1.000$ elementos), além de uso contínuo de CPU/GPU com o canvas parado.

**Causa raiz:** combinação de (1) invalidação de `WeakMap<Element, Path2D>` ao
criar novas referências `{ ...el, x, y }` em todo frame do drag, (2) *resampling*
bilinear no Skia ao preencher `CanvasPattern` sob `ctx.scale(zoom, zoom)` ou
uso de `ctx.setLineDash` em centenas de linhas de grid na faixa `50%–150%` de
zoom, (3) `ctx.clip()` por forma a cada frame em preenchimentos `hachure`,
(4) buscas lineares `.find()` / `[...elements].reverse()` dentro de loops e
(5) `JSON.stringify` síncrono no `History`.

**Regra (sempre seguir):**

1. **Preservar identidade de origem em translações puras (`translatedOrigin`)**:
   Sempre que criar um elemento apenas transladado (`translateElement`,
   `snapEdgeEndpoints` quando ambos os extremos movem pelo mesmo `(dx, dy)`),
   propagar a raiz em `translatedOrigin.set(next, translatedOrigin.get(el) ?? el)`
   e deslocar `rotatedBoundsCache`. No renderer (`drawElement`, `drawLabel`,
   `getCachedBounds`, `elementVisualBounds`), delegar para a raiz aplicando
   `ctx.translate(el.x - root.x, el.y - root.y)` — mantendo 100% de cache hit
   dos `Path2D` (*sketch/hachure*) e *layouts* de texto durante o drag. No
   seletor do `PropertiesPanel`, comparar `(translatedOrigin.get(el) ?? el)`
   para não re-renderizar o DOM do painel a 60 Hz durante arrastes.
2. **Grid (`dots` e `lines`) sempre via `CanvasPattern` 1:1 em pixels físicos**:
   NUNCA preencher `CanvasPattern` sob `ctx.scale(cam.zoom, cam.zoom)` (força
   *resampling* bilinear por pixel no Skia em telas HiDPI) e NUNCA desenhar o
   micro-grid tracejado com `ctx.setLineDash` direto no canvas principal por
   frame. Pré-renderizar um bloco periódico (`GRID_CELLS = 10`) na resolução
   física atual (`scale = ctx.getTransform().a`) e fazer *blit* com
   `ctx.setTransform(1, 0, 0, 1, ox - tilePx, oy - tilePx)`.
3. **Zero `ctx.clip()` por elemento no loop de `render()`**:
   Para preenchimentos `hachure` / `cross-hachure`, recortar os segmentos
   algebricamente contra a geometria da forma (`clipHachureLine` para
   retângulo, elipse e diamante) uma única vez na construção do `Path2D`
   cacheado (`buildHachurePath`), usando `clampStart = true, clampEnd = true`
   no modo *sketch* e `ctx.lineCap = "butt"`.
4. **Renderização sob demanda via `editor.getRenderToken()`**:
   O loop `requestAnimationFrame` do `CanvasHost` só deve invocar
   `editor.renderTo` quando `editor.getRenderToken()` mudar (incremento de
   `renderVersion` em mutações de `doc`/`camera`/`emit`, incremento de
   `assetLoadVersion` no `onload` de imagens/SVGs em `componentAssets.ts`, ou
   presença de seta com `animated === true` em `getDocIndex(doc).hasAnimated`)
   ou quando as dimensões físicas do canvas mudarem.
5. **Indexação $O(1)$ por documento (`getDocIndex`) e rejeição rápida por AABB**:
   - Usar `getDocIndex(this.doc)` (`byId: Map<string, Element>`,
     `withDetails: Element[]`, `hasAnimated: boolean`) em vez de
     `this.doc.elements.find(...)` ou filtros lineares repetidos.
   - Em `hitTest` e `findNearestBinding`, descartar candidatos imediatamente
     pela AABB (`elementBounds` / `rotatedBounds` cacheado) antes de trigonometria
     ou distância a polilinhas.
   - Nunca usar `[...this.doc.elements].reverse()` em handlers de ponteiro;
     iterar com laço indexado reverso (`for (let i = list.length - 1; i >= 0; i--)`).
   - Processar contenção de contextos (`captureInContexts`,
     `refreshContextContainment`) em lote para conjuntos de IDs e manter o
     *fast-path* linear $O(N)$ em `ensureContextZOrder`.
6. **Histórico (`History`) por referência imutável de `Document` ($O(1)$)**:
   Como `this.doc` é imutável, `History` deve armazenar `Document` diretamente
   por referência — nunca serializar com `JSON.stringify` / `JSON.parse` no
   `commitHistory()`, `undo()` ou `redo()`.
