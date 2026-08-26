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
