# KB — reload alterava cores de elementos (clara/escura): `mode-switch` falso no boot

**Sintoma:** pressionar Cmd+R (refresh) alternava as cores de alguns elementos
entre claro/escuro a cada reload (ex.: `#d3e1ed` ↔ `#092a48` — mesmo hue,
intensity trocada). Só afetava elementos com cores da paleta
(`BASE_COLORS` → `shadesOf`); `DEFAULT_STROKE`/`CONTEXT_STROKE`/custom hex
não mudavam — daí parecer "diferente do dark/light mode".

**Causa raiz:** ordem de avaliação de módulos no boot.

1. `main.tsx` importa `App` → (via `AppMenu`) **`bgPrefs.ts` avalia e instala
   o `MutationObserver` em `data-theme`**, capturando `lastDark` num documento
   recém-carregado (atributo ausente → valor do **sistema**).
2. Só depois `main.tsx:86` chama `applyThemePref(loadThemePref())` → seta
   `data-theme` da **preferência salva**.
3. Se pref contradiz o sistema (ex.: pref=dark, OS=light), o observer enxerga
   uma "troca" falsa → dispatch `archidraw:mode-switch` →
   `correlateColorsForTheme()` (`theme.ts` listener) roda e o **autosave
   persiste**.
4. `correlateIntensity` é uma **involução** (intensity i → 4−i). Rodando
   a cada reload: vira chaveamento A↔B para sempre.

Confirmado com instrumentação: `mode-switch` disparava 1× por reload a partir
do `MutationObserver` de `bgPrefs.ts`.

**Fix:**
- `bgPrefs.ts` inicializa com `applyThemePref(loadThemePref())` **antes** de
  capturar `lastDark` e instalar o observer — a aplicação inicial fica
  invisível para o observer, em qualquer ordem de import.
- `applyThemePref` (`theme.ts`) é idempotente: só toca o atributo se o valor
  alvo difere (`setAttribute` com valor idêntico também gera MutationRecord).

**Regra (sempre seguir):** qualquer observer de `data-theme`/`data-skin`
deve ser instalado **depois** de aplicar a preferência persistida, e
aplicadores de atributos observados devem ser idempotentes — `setAttribute`
dispara MutationObserver mesmo com valor igual. Handlers de
eventos de tema que **persistem via autosave** (`correlateColorsForTheme`)
não podem ser involuções sem idempotência por load.

**Regressão:** `e2e/specs/theme-reload-stability.spec.ts`
(pref dark + system light, pinta retângulo com shades extremos da paleta,
reload ×2, cores estáveis).
