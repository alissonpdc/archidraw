# KB — import por caminho absoluto só existe na máquina de quem escreveu

**Sintoma:** a CI falha **só** no job E2E, logo na coleta, com

```
Error: EACCES: permission denied, stat '/root/GitHub/archidraw/e2e/fixtures'
```

Nenhum teste chega a rodar e o job inteiro cai (`Build` e `Criar PR` ficam
`skipped`). Lint, Typecheck e Security Audit passam **verdes** — é essa
combinação (todos os gates estruturais ok, E2E morto na largada) que assina o
problema.

**Causa raiz:** um spec importa fixtures pelo caminho absoluto do filesystem da
máquina onde foi escrito, em vez de relativo:

```ts
import { test, open } from "/root/GitHub/archidraw/e2e/fixtures"; // quebra
import { test, open } from "../fixtures";                          // certo
```

No runner o repo vive em `/home/runner/work/archidraw/archidraw`. O resolver
do Playwright faz `stat` no caminho literal e estoura `EACCES` — o processo nem
pode ler `/root`. É falha de **resolução de módulo**, não de comportamento do
teste: por isso o `--retries` do CI não muda nada e re-rodar a run sem mudar
nada reproduz 100%.

**Por que os outros gates não pegam:**

- `oxlint` ignora `e2e/**` e `playwright.config.ts`
- `tsc -b` (`npm run build`) só compila `src/` + `vite.config.ts`

Ou seja, **nada no `make gate` até a execução do Playwright lê os specs**.
Specs são verificados só em runtime. Caminho absoluto é literalmente invisível
para lint e typecheck.

**Regra (sempre seguir):**

1. Imports em `e2e/**` **sempre relativos**: `from "../fixtures"`,
   `from "./utils"`. Nunca `/root/...`, `/home/...`, `/Users/...` nem
   `~/...`.
2. Copiar o caminho que o editor/IDE mostra na barra de título ou na
   "copiar caminho do arquivo" é o gatilho habitual do bug — cole sempre o
   import relativo.
3. Antes de commitar um spec novo, varredura (tem que voltar vazio):

   ```bash
   grep -rn 'from "/' e2e/ | grep -v 'from "\.\.'
   ```

**Sintoma inverso (mesma causa):** teste que passa local e, na CI, falha com
`Cannot find module` / `EACCES` apontando um caminho que **existe** na sua
máquina — é esse caminho, não o teste.

## Regra relacionada — não commitar probe de medida

O arquivo que motivou essa KB (`e2e/specs/zz-shot.spec.ts`) não tinha um único
`expect()`: media o tamanho do hover box e imprimia no stdout
(`process.stdout.write("K ...")`). Um teste sem asserção não protege nada, só
custa tempo de suite — e o fluxo que ele cobria (hover no badge + resize por
teclado) já existia com asserções reais em `hover-markdown.spec.ts`.

Ao depurar um comportamento: escreva o `expect()` de verdade e delete o probe,
ou deixe o probe fora do stage. Debug temporário em `e2e/specs/` vira arquivo
de produção no primeiro commit.
