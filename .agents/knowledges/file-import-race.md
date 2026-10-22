# KB — input de arquivo é assíncrono; `setInputFiles` não espera o handler

**Sintoma:** E2E de import (`excalidraw-scene-legacy`, `excalidraw-scene-rich`,
`interactions`) falha **flaky** com o dado importado simplesmente **ausente**
(`expect(els).toHaveLength(1)` recebeu `[]`; tabs vieram só `["Diagram 1"]`).
Qual teste do arquivo falha **varia entre runs** — assinatura de timing, não de
lógica. Passa isolado, falha no `make test` com `E2E_WORKERS=15`.

**Causa raiz:** `src/ui/components/AppMenu.tsx:342-352` — o `<input type=file>`
tem `onChange={(e) => onImportFile(e.target.files?.[0])}`, e `onImportFile`
(`AppMenu.tsx:166`) é **`async`**, começando com `await file.text()`. O
`page.setInputFiles(...)` do Playwright resolve assim que o evento `change` foi
**disparado** — ele não espera o handler. Ler `editorState()` logo em seguida é
uma corrida com `await file.text()` (+ parse + mutação do editor). Com 15
browsers disputando CPU, o `file.text()` quase sempre perde.

**Não é bug de produto:** o handler termina corretamente nos 4 ramos
(sucesso `.excalidraw`, inválido `.excalidraw`, sucesso `.archidraw`, inválido
`.archidraw`) — todos chamam `toast(...)`. O produto está certo; o teste é que
assume um settle que não observou.

**Regra (sempre seguir):** nunca afirmar logo após
`page.setInputFiles('[data-testid="import-input"]', ...)`. Usar o helper
`importFile(page, file)` de `e2e/fixtures.ts`, que arma um `MutationObserver`
**antes** de anexar o arquivo e resolve quando um nó `.toast-stack .toast`
**novo** (ausente no snapshot inicial) entra no DOM:

```ts
import { importFile } from "../fixtures";
await importFile(page, { name: "x.excalidraw", mimeType: "application/json", buffer });
```

O helper também cobre o caso "import inválido não muda nada"
(`elementCount === 0`), onde polling por mudança de estado não serviria — o
sinal é o toast, não o estado.

**Variante relacionada:** o import da **biblioteca**
(`.library-import-input`, `LibraryPanel.tsx:277` → `importExcalidrawLibFile`)
**não** emite toast. `e2e/specs/library-import.spec.ts` espera o grupo
aparecer via locator — mantenha esse padrão ao mexer nesse input.

## Variante 2 — atalho de teclado que abre file picker nativo

**Sintoma:** `editor-flows.spec.ts` › *"img shortcut opens the image picker…"*
dá **timeout de 30s** em `page.waitForEvent("filechooser")` (3 de 4 runs).

**Causa raiz:** não é o app. Diagnóstico com listener de captura provou que o
keydown **chega** (`isTrusted: true`, `userActivation.isActive === true`) e o
handler chama `input.click()` — o clique no `<input>` acontece
(`inputClicks === 1`). O Chromium simplesmente **não emite o evento
filechooser** nesse caminho. Medido com 10 workers + 8 processos `yes`
disputando CPU:

| caminho                                      | taxa de sucesso |
| -------------------------------------------- | --------------- |
| `page.keyboard.press("i")` (evento via CDP)   | ~50%            |
| `page.keyboard.down("i")`                     | ~55%            |
| `dispatchEvent(new KeyboardEvent("keydown"))` in-page | **100% (20/20)** |
| clique real do mouse no botão da toolbar      | 100% (20/20)    |

**Regra:** para abrir file picker por atalho, use
`openFileChooserViaShortcut(page, key)` de `e2e/fixtures.ts` — mesma técnica
já usada por `pressPaste` para o evento `paste` nativo (KB `clipboard-paste.md`).
Nunca `page.keyboard.press` + `waitForEvent("filechooser")`.

## Variante 3 — governor de FPS não pode medir cadence de rAF

`performance.spec.ts` media o intervalo rAF-a-rAF e cobra `> PERF_MIN_FPS`
(45 local / 25 CI). Esse número é **capacidade de agendamento do SO**, não
trabalho do app: com 10 workers + 8 `yes` a cadence oscilou de **35 a 58 fps**
enquanto o custo real de `renderTo` com 500 elementos ficou em **0.3–0.8 ms
(mediana)**. Ou seja, o orçamento de 45 fps (22 ms/frame) tem folga de ~25x: o
teste media contenção, não performance.

**Regra:** o governor mede o **custo de render por frame**
(`performance.now()` em volta de `editor.renderTo(...)`, após warmup) e compara
com o orçamento `1000 / MIN_FPS`, em mediana e p95. O loop rAF de 60 frames
continua no teste, mas só como assert de **vivacidade** (`frameCount === 60`) e
para cobrir o pipeline real de pan.