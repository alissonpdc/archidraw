# KB — Tooltips cortados por contêineres com overflow

**Sintoma:** tooltip (bolha de ajuda/hover) aparece cortada ou invisível perto das bordas
do painel/menu que a contém — em cima, embaixo, laterais ou todas.

**Causa raiz:** tooltips implementados como pseudo-elemento CSS (`[data-tip]::after`
com `position: absolute`) são **recortados por qualquer ancestral com
`overflow: hidden/auto/scroll`**. Painéis com `max-height` + `overflow-y: auto`
(como `.properties-panel`) sempre recortam o tooltip em alguma direção.
Agravante conhecido: `transform`/`filter`/`will-change` em ancestrais criam um
*containing block* adicional e prendem ainda mais o pseudo-elemento.

**Regra (sempre seguir):**

1. Tooltips CSS via `::after` só são permitidos em contêineres **sem overflow**
   e sem `transform` no ancestral (toolbar, widgets soltos).
2. Dentro de qualquer componente com `overflow-*` ou `transform` próprio,
   usar tooltip **portal + `position: fixed`** (renderizado fora da árvore de
   clipping, ex.: `createPortal(..., document.body)`), medindo o rect do
   elemento-âncora e fazendo *clamp* nas bordas da viewport.
3. Ao criar um novo painel/popover rolável, decidir a estratégia de tooltip
   **na hora da criação**, não depois do primeiro bug.
4. Nunca resolver com "empurrar o tooltip para cima/baixo" (`tip-up` etc.) —
   apenas troca o lado do corte.

## Snippet padrão (usar como referência)

Implementação real: `src/ui/components/PropertiesPanel.tsx` (`PanelTooltip`
+ delegação de eventos no root). Estrutura essencial:

```tsx
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function PanelTooltip({ tip }: { tip: { text: string; x: number; y: number } | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!tip || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    // clamp horizontal para nunca sair da viewport
    const left = Math.min(
      Math.max(8, tip.x - r.width / 2),
      window.innerWidth - r.width - 8,
    );
    setPos({ left, top: tip.y });
  }, [tip]);

  if (!tip) return null;
  return createPortal(
    <div
      ref={ref}
      className="panel-tooltip" // position: fixed; z-index alto; pointer-events: none
      style={{ left: pos?.left ?? tip.x, top: pos?.top ?? tip.y, visibility: pos ? "visible" : "hidden" }}
    >
      {tip.text}
    </div>,
    document.body,
  );
}
```

Ativação por delegação no root do painel (um handler para todos os `[data-tip]`):

```tsx
<div
  onMouseOver={(e) => {
    const el = (e.target as HTMLElement).closest("[data-tip]");
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTip({ text: el.getAttribute("data-tip") || "", x: r.left + r.width / 2, y: r.top });
  }}
  onMouseLeave={() => setTip(null)}
  onScroll={() => setTip(null)} // âncora move com o scroll: esconder
>
```

CSS obrigatório ao usar o portal (evita tooltip duplo dentro do contêiner):

```css
.properties-panel [data-tip]::after { display: none; }
.panel-tooltip {
  position: fixed;
  transform: translateY(calc(-100% - 8px));
  pointer-events: none;
  /* cores/borda/fonte iguais às do sistema [data-tip] */
}
```

## Checklist antes de aprovar UI nova

- [ ] O contêiner tem `overflow`, `max-height` ou `transform`?
- [ ] Se sim, os tooltips usam portal/fixed (não `::after`)?
- [ ] Tooltip é clampado nas bordas da viewport?
- [ ] Testado hover nos itens das bordas superior/inferior/laterais do contêiner?

## KB — clamp com `width` dependente da posição (caixa "cresce" sozinha)

**Sintoma:** tooltip flutuante ancorado à direita/embaixo da viewport **transborda
a borda** mesmo com clamp aplicado — `right` dá igual a `innerWidth` (ou some
para fora), enquanto `left + width` parece correto no cálculo.

**Causa raiz:** uma caixa `position: fixed` com **apenas `left` definido** e
`width: auto` usa *shrink-to-fit*: a largura usada é
`min(max-content, espaço disponível até a borda da viewport)`. Como o clamp
depende da largura medida **e** a largura depende do `left` que o clamp escolhe,
o cálculo se realimenta: o `getBoundingClientRect()` mede uma caixa estreita
(porque ela ainda está encostada na borda), o clamp acha que cabe, posiciona
pela direita, e a caixa então **re-estreita** — ou pior, transborda.

**Regra:** qualquer tooltip com clamp **precisa** de uma largura que não
dependa da posição. Use `width: max-content` (mais `max-width` para o teto):

```css
.tooltip-float {
  position: fixed;
  width: max-content;              /* <- essencial: independe do `left` */
  max-width: min(420px, calc(100vw - 32px));
}
```

Com `width: max-content` o `max-width` continua sendo o teto e a largura real
fica estável entre "antes do clamp" e "depois do clamp", então o
`useLayoutEffect` que mede e posiciona mede o valor certo.

**Sintoma equivalente (irmão):** `max-height` + `overflow: auto` numa caixa
ancorada no topo faz o `useLayoutEffect` ler a altura **já limitada** e
posicionar rápido demais. Meça `scrollHeight` quando o teto de altura importa.

Implementação real: `src/ui/components/HoverInfoBox.tsx` (clamp em
`useLayoutEffect`) + `.hover-info-box` em `src/ui/styles/app.css`.
Spec que pega a regressão: `e2e/specs/hover-markdown.spec.ts`
("a long preview stays clamped inside the viewport").
