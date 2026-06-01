# Feature 10: Persistência & Export/Import

## 10.1 Auto-save

**Objetivo:** Não perder trabalho.

**Behavior:**
- Salva automaticamente a cada 5 segundos de inatividade
- Salva no IndexedDB do browser
- Indicador visual quando salvando (ícone spinning ou "Saving...")

**Trigger:**
- 5 segundos sem input do usuário
- Detecta mudanças (não salva se nada mudou)

---

## 10.2 Export `.archidraw` (JSON nativo)

**Objetivo:** Exportar projeto completo para re-edição.

**Formato:**
- Arquivo JSON contendo:
  - Todos os objetos (posição, tamanho, cores, propriedades)
  - Todas as abas (Feature 9.2)
  - Metadados (nome, data, modo hardline/sketchline)
  - 100% re-importável sem perda

**Interface:**
- File → Export (or Ctrl+S / Ctrl+Shift+E)
- Download como `.archidraw`

---

## 10.3 Import `.archidraw`

**Objetivo:** Carregar projeto previamente exportado.

**Métodos:**
- Drag-drop arquivo `.archidraw` na área de projetos
- File → Import
- Button na project manager

**Behavior:**
- Carrega projeto completo com estado restaurado
- Cria novo projeto em folder (Could Have: perguntar folder)
- Validação: rejeita arquivo inválido

---

## 10.4 Export SVG

**Objetivo:** Compartilhar/publicar diagrama como vetor padrão.

**Output:**
- Arquivo SVG limpo e re-editável em Inkscape, Adobe XD, etc.
- Resolve posicionamento, cores, textos
- Mantém aspect ratio do canvas

**Opcões:**
- Zoom level: export em current zoom ou fit-to-content
- Transparent background opcionalmente

---

## 10.5 Export PNG

**Objetivo:** Compartilhar/publicar como imagem raster.

**Output:**
- Arquivo PNG com opções de DPI:
  - 1x (1:1 pixels)
  - 2x (2x resolução)
  - 4x (4x resolução, high-DPI)

**Opcões:**
- Canvas size: current viewport ou full canvas
- Background: white, transparent, custom color

---

## 10.6 Import SVG

**Objetivo:** Importar diagramas de outras ferramentas.

**Behavior:**
- Parsa SVG e converte em objetos editáveis (best-effort)
- Limitações:
  - Elementos complexos (grouping, effects) podem não converter perfeitamente
  - Efeitos (shadows, gradients) são simplificados
  - Path elements são convertidos em linhas/shapes aproximadas

**Resultado:**
- Novos objetos no canvas, prontos para edição
- Cores e posições são preservadas
