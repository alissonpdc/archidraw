# ArchiDraw — Guia de Desenvolvimento

Webapp canvas (estilo Excalidraw/draw.io) para desenho de arquiteturas e system design. Ver `PRD.md` para visão de produto.

## Diretrizes (Knowledge Base)

Antes de implementar UI/interações, consulte **`.agents/knowledge/*.md`** — são lições registradas de bugs recorrentes, com regras obrigatórias e snippets prontos:

- `.agents/knowledge/tooltip-clipping.md` — tooltips cortados por contêineres com `overflow`/`transform`: quando usar tooltip portal/fixed em vez do pseudo-elemento CSS `[data-tip]::after`.

Ao corrigir um bug que enseje uma regra geral (algo que já deu problema mais de uma vez), registre uma nova entrada em `.agents/knowledge/` e referencie-a aqui.

## Comandos

```bash
npm run dev          # dev server (Vite)
npm run build        # typecheck + build de produção
npm run lint         # oxlint
npm run test:e2e     # testes Playwright (builda em modo test + preview + roda specs)
npm run test:e2e:ui  # UI interativa do Playwright
```

## Arquitetura

- **`src/core/`** — puro, sem React: modelo do documento (`types.ts`), câmera/transformações (`utils.ts`), hit-testing, histórico undo/redo (`history.ts`), renderer Canvas 2D (`renderer.ts`) e máquina de estados/interações (`editor.ts`, classe `Editor`).
- **`src/ui/`** — casca fina React. O estado flui via `useSyncExternalStore(editor.subscribe, editor.getSnapshot)`.
- **Regra crítica:** o `Editor.getSnapshot()` retorna referência **estável** (cache invalidado apenas no `emit()`). Criar objeto novo a cada chamada causa loop infinito de render no `useSyncExternalStore`.

## Testes E2E (Playwright)

- Config: `playwright.config.ts` — Chromium only; o `webServer` roda `npm run build:test && vite preview` (build real).
- **Fixture** (`e2e/fixtures.ts`): toda página é monitorada — qualquer `console.error/warning` ou `pageerror` **falha o teste** (teria pego o bug de render loop). Use a fixture `test` de `e2e/fixtures.ts`, nunca a do `@playwright/test` direto.
- Helper `open(page)`: navega e espera hidratação (`__appReady__`). Sempre use-o antes de interagir.
- Estado interno: `window.__editor__` exposto apenas em builds dev/test (`src/main.tsx`). Leia via fixture `editorState()`.
- Specs em `e2e/specs/`: smoke, tools, selection, history, viewport.

## Definition of Done (obrigatório)

Uma atividade só pode ser considerada **done** quando **ambas** as condições forem atendidas:

1. **GATE de testes:** a execução completa de `npm run lint && npm run build && npm run test:e2e` passou sem erros. Sem essa execução verde, a atividade NÃO está done — não relate conclusão, não pule etapas e não presuma que "deve funcionar".
2. **Commit local:** ao final da implementação validada, commitar localmente com mensagem no padrão **Conventional Commits** (ex.: `feat: adicionar zoom com ctrl+scroll`, `fix: corrigir tooltip cortado no toolbar`). Nunca commitar sem os testes terem passado antes.

### Ao adicionar features

1. Implemente em `src/core/` quando for estado/interação; `src/ui/` só para apresentação.
2. Adicione/ajuste spec cobrindo o novo comportamento.
3. Rode o GATE completo (`npm run lint && npm run build && npm run test:e2e`) — obrigatório.
4. Commite localmente com Conventional Commit — obrigatório.
