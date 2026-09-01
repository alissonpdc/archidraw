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

## Implementação real

- `src/core/editor.ts` — guard `button === 2` no `pointerDown`; helpers
  `elementAt`, `badgeElementAt`, `selectElementAt`, `updateElementDetails`.
- `src/ui/components/ContextMenu.tsx` — listener `contextmenu` no documento +
  portal/fixed + clamp + fechamento.
- Componente a referenciar: `src/ui/components/ContextMenu.tsx`.