# KB — Menu de contexto custom no canvas (botão direito)

**Sintoma:** clicar com botão direito em um elemento inicia um drag/marquee em
vez de abrir o menu custom; ou o menu nativo do navegador aparece por cima do
menu da aplicação.

**Causa raiz:** o editor de canvas trata `pointerdown` como início de
interação (draw/move/marquee). O evento `contextmenu` (onde o menu custom é
aberto) **dispara depois** do `pointerdown`, então sem um guard o right-click
já iniciou uma interação antes do menu existir. Além disso, cada elemento
precisa de `preventDefault` no `contextmenu` para suprimir o menu nativo.

**Regra (sempre seguir):**

1. No `pointerDown` do `Editor`, retornar cedo quando `button === 2` — o botão
   direito pertence exclusivamente ao menu de contexto, nunca a drag/draw:
   ```ts
   if (button === 2) return;
   ```
2. Menus e tooltips que pairam sobre o canvas **sempre** por `createPortal` +
   `position: fixed` com *clamp* na viewport (mesma regra do
   `tooltip-clipping.md`) — o canvas tem `transform` (zoom/pan) que vira
   containing block e recorta `position: absolute`.
3. Suprimir o menu nativo com `preventDefault` apenas quando o alvo do evento
   está dentro do host do canvas (`.canvas-host`), **nunca** quando há um
   `textarea` de edição de texto focado — aí o menu nativo é necessário para
   copy/paste.
4. Menus que precisam sobreviver ao fechamento do próprio gatilho (ex.: um
   modal aberto a partir de um item do menu) devem ser renderizados **fora**
   do bloco condicional do menu.
5. Fechar o menu em: clique fora, Escape, wheel/scroll, resize e blur da janela.
6. **Distância das bordas:** menu principal e submenus mantêm `EDGE_MARGIN = 8px`
   de TODA borda do viewport. Quem estouraria a borda direita abre à esquerda
   do item pai; quem estouraria a borda inferior sobe até caber.

## Medição: só caixa de layout (nunca `getBoundingClientRect` durante animação)

**Sintoma:** o menu encosta (ou passa) na borda inferior da tela mesmo com o
clamp existente; submenu abre cortado na borda direita.

**Causa raiz:** `menu-in` anima `transform: scale(0.97) translateY(-3px)` nos
primeiros 140ms. O `useLayoutEffect` de posicionamento roda nesse primeiro
frame, e `getBoundingClientRect()` devolve a caixa **já reduzida** pela
transformação. O clamp desloca menos do que o necessário e a caixa final
(escala 1) ultrapassa a borda — mede-se uma caixa menor que a que será
renderizada.

**Regra (sempre seguir):**

1. Tamanho de caixa sempre via `offsetWidth`/`offsetHeight` (caixa de layout,
   imune a `transform`), nunca via `getBoundingClientRect()`.
2. Posição absoluta em espaço de layout: `origemDoMenu + offsetParent.client* +
   offset*`. `offsetTop`/`offsetLeft` são medidos a partir da *padding edge* do
   `offsetParent`, por isso somam `clientTop`/`clientLeft` (a borda).
3. A origem do menu (`left`/`top` aplicados) vem do próprio estado de clamp —
   memoizada, senão um objeto novo por render re-dispara o efeito do submenu
   em loop (mesma armadilha do `getSnapshot()`).
4. Posicionar em `useLayoutEffect` (antes do paint): a caixa nunca pisca na
   posição padrão.

## Implementação real

- `src/core/editor.ts` — guard `button === 2` no `pointerDown`; helpers
  `elementAt`, `badgeElementAt`, `selectElementAt`, `updateElementDetails`.
- `src/ui/components/ContextMenu.tsx` — listener `contextmenu` no documento +
  portal/fixed + clamp + fechamento; `EDGE_MARGIN`, `clampEdge`, estado único
  de submenu `{ id, anchor }` e o componente `ContextSubmenu` (clamp do submenu).
- `e2e/specs/context-menu-viewport.spec.ts` — gaps do menu e dos submenus nas
  quatro bordas (o teste de submenu precisa existir: é o único que pega o
  clamp errado por transformação).
- Componente a referenciar: `src/ui/components/ContextMenu.tsx`.