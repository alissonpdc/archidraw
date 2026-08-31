# KB — Colar com Cmd+V: não usar `navigator.clipboard.read()`; via única = evento `paste`

**Sintoma:**
- Cmd+V cola a imagem **e** abre um menu nativo "Paste" (Chrome/macOS) — ou abre
  só o menu "Paste" e não cola nada.
- O bug apareceu de novo mesmo após "corrigir" uma vez (vv. histórico do App.tsx
  de 2026-08-31: quatro tentativas seguidas).

**Causa raiz:**
- `navigator.clipboard.read()` chamado no `keydown` de Cmd+V faz o Chrome
  (macOS) exibir o **menu nativo "Paste"** como UI de consentimento/fallback do
  clipboard — a imagem chega (ou não), mas o menu aparece de todo jeito.
- `e.preventDefault()` no `keydown` de Cmd+V **suprime o evento `paste`** do
  browser (documentado no d156793), então a imagem externa deixa de chegar.
- Em alvos não-editáveis (canvas), o `paste` não tratado/preventDefault pode
  abrir o menu "Paste" nativo.

**Regra (sempre seguir):**

1. **Via única de colar = evento nativo `paste`** (`window.addEventListener("paste")`).
   No `keydown` de mod+V: NÃO chamar `navigator.clipboard.read()` e NÃO
   `preventDefault()` — apenas `return` (deixa o browser disparar `paste`).
2. No handler `paste`: sempre `e.preventDefault()` (kill do menu nativo e da
   inserção default), exceto quando o foco está em `TEXTAREA/INPUT`.
3. Prioridade no handler: imagem externa (`clipboardData.items` com
   `kind === "file"` e `type.startsWith("image/")`) → insert; senão clipboard
   interno do app (localStorage) → `editor.paste()`; senão nada.
4. Nunca reintroduzir fallback assíncrono via `navigator.clipboard.read()` para
   consertar o paste interno; se o `paste` nativo não disparar em headless, o
   teste deve despachar o evento manualmente via `page.evaluate` com
   `new ClipboardEvent("paste", { clipboardData: new DataTransfer() })`.
   **NÃO usar `Meta+v` em testes** — não dispara `paste` no Linux (CI);
   `Control+v` não dispara no macOS. O dispatch sintético é cross-platform.
5. Clipboard interno do app (elementos copiados) fica em localStorage — não é
   escrito no clipboard do SO; o `paste` nativo para ele vem com `items` vazio.

## Onde aconteceu (referência)

- `src/ui/App.tsx` — tratado no efeito que registra `window.addEventListener("paste")`.
- Testes: `e2e/fixtures.ts` exporta `pressPaste()` que despacha um
  `ClipboardEvent("paste")` sintético — cross-platform, funciona no CI Linux.
  Para imagens externas (`image.spec.ts`), o teste lê `navigator.clipboard.read()`
  e monta o `DataTransfer` com o arquivo antes de despachar.

## Checklist antes de mexer em clipboard/paste

- [ ] Nenhum `navigator.clipboard.read()`/`readText()` no keydown de Cmd+V?
- [ ] `preventDefault()` no keydown de Cmd+V está ausente?
- [ ] O evento nativo `paste` é a única via de inserção de imagem externa?
- [ ] `paste` handler faz `preventDefault()` em todo caminho tratado/ignorado?
- [ ] E2E usa `pressPaste()` (dispatch sintético) ou `Meta+v` (só macOS local), nunca `Control+v`?