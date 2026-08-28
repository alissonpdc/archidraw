# Contribuindo para o ArchiDraw

Obrigado pelo interesse em contribuir! Este documento guia o setup e as convenções do projeto.

## Setup

Requisitos: **Node.js 20+** e **npm**.

```bash
git clone <repo-url> && cd archidraw
npm install
npx playwright install chromium   # necessário para os testes E2E
npm run dev
```

## Comandos

| Comando | Descrição |
|---|---|
| `npm run dev` | Dev server (Vite) |
| `npm run build` | Typecheck + build de produção |
| `npm run lint` | Linter (oxlint) |
| `npm run test:e2e` | Testes Playwright (build real + preview) |
| `npm run test:e2e:ui` | UI interativa do Playwright |

## Arquitetura

- **`src/core/`** — puro, sem React: modelo do documento (`types.ts`), câmera (`utils.ts`), hit-testing, histórico undo/redo (`history.ts`), renderer Canvas 2D (`renderer.ts`) e máquina de estados (`editor.ts`, classe `Editor`).
- **`src/ui/`** — casca fina React para apresentação. Estado flui via `useSyncExternalStore(editor.subscribe, editor.getSnapshot)`.

Regras críticas:

1. Estado/interação vivem em `src/core/`; `src/ui/` é apenas apresentação.
2. `Editor.getSnapshot()` deve retornar referência **estável** (cache invalidado só no `emit()`). Criar objeto novo a cada chamada causa loop infinito de render.
3. Antes de implementar UI/interações, consulte `.agents/knowledge/*.md` — lições de bugs recorrentes com regras obrigatórias.

## Fluxo de contribuição

1. Crie uma branch a partir de `main` (ex.: `feat/numeracao-setas`).
2. Implemente com testes cobrindo o novo comportamento (specs E2E em `e2e/specs/`).
3. Rode o GATE completo (obrigatório — veja abaixo).
4. Abra um Pull Request com descrição clara do que muda e por quê.

### Definition of Done (obrigatório)

Uma atividade só é **done** quando ambas as condições forem atendidas:

1. **GATE de testes:** `npm run lint && npm run build && npm run test:e2e` passou sem erros. Sem execução verde, não relate conclusão.
2. **Commit local** (ou PR) com mensagem no padrão **Conventional Commits**.

## Convenções

### Commits

Padrão **Conventional Commits**, em pt-BR ou inglês (seja consistente):

```
feat: adicionar zoom com ctrl+scroll
fix: corrigir tooltip cortado no toolbar
refactor: extrair hit-testing para utils
test: cobrir undo/redo em seleção múltipla
docs: atualizar README com instruções Docker
```

### Estilo de código

- Sem comentários no código, a menos que seja solicitado/extritamente necessário.
- Siga as convenções existentes dos arquivos vizinhos (imports, tipagem, naming).
- Sem segredos ou chaves no repositório.

### Testes E2E (Playwright)

- Use a fixture `test` de `e2e/fixtures.ts` — **nunca** a do `@playwright/test` direto. Toda página é monitorada: qualquer `console.error/warning` ou `pageerror` falha o teste.
- Use o helper `open(page)` para navegar e esperar hidratação (`__appReady__`).
- Estado interno: `window.__editor__` exposto em builds dev/test; leia via fixture `editorState()`.

### Bugs recorrentes

Ao corrigir um bug que enseje uma regra geral (problema que já ocorreu mais de uma vez), registre uma entrada em `.agents/knowledge/` e referencie-a no `AGENTS.md`.

## Reportando bugs

Abra uma issue com: passos para reproduzir, comportamento esperado vs. observado, e ambiente (SO, navegador, versão). Se possível, inclua um JSON exportado do diagrama (remova dados sensíveis).

## Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob a [Apache-2.0](LICENSE).
