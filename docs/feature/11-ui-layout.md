# Feature 11: Layout da Interface (UX)

## 11.1 Toolbar Superior (Top Toolbar)

**Objetivo:** Acesso rápido às ferramentas de desenho.

**Conteúdo:**
- Barra horizontal no topo
- Botões para cada forma (Retângulo, Círculo, Losango, Triângulo, Linha, Seta, Texto)
- Indicador visual da ferramenta selecionada (highlight/active state)
- Atalhos visíveis em tooltip (ex: "Rectangle (R)")

**Layout sugerido:**
```
[≡] [▭] [●] [◇] [△] [━] [→] [T] | File Edit View ...
```

---

## 11.2 Painel Lateral Esquerdo (Properties Panel)

**Objetivo:** Controlar propriedades visuais e layout dos objetos.

**Conteúdo com Abas:**
1. **Estilos**
   - Toggle: Hardline / Sketchline (Feature 2.1)
   - Color picker: Stroke (Feature 2.2)
   - Color picker: Fill (Feature 2.2)
   - Stroke width (Could Have)

2. **Alinhamento**
   - Botões: Align Left, Center, Right, Top, Middle, Bottom (Feature 5.1)
   - Botões: Distribute H, Distribute V (Feature 5.2)

3. **Propriedades do Objeto**
   - Dimensões (Width, Height)
   - Posição (X, Y)
   - Rotation (Could Have)
   - Editable quando objeto selecionado

**Behavior:**
- Recolhível (toggleable)
- Painel grayed-out quando nenhum objeto selecionado
- Real-time update conforme arrasta no canvas

---

## 11.3 Barra Inferior (Bottom Bar)

**Objetivo:** Navegação rápida e feedback visual.

**Conteúdo:**
```
[Zoom: - | 100% | +] [Fit] [Minimap (embedded)]  | Saving... | Undo/Redo
```

- Controles de zoom (-, valor em %, +)
- Fit-to-screen botão
- Minimap embarcado (Feature 7.3)
- Status indicator (Saving, Saved, Error - Could Have)
- Undo/Redo botões (Could Have, ou hotkeys only)

**Styling:**
- Subtle background, não intruso
- Compacto e legível

---

## 11.4 Painel de Camadas (Layers Panel)

**Objetivo:** Visualizar e gerenciar hierarquia de objetos.

**Conteúdo:**
- Painel recolhível (lado direito ou esquerdo)
- Árvore de objetos em ordem de z-index
- Grupos expandíveis (Feature 6.1)
- Clique para selecionar objeto no canvas
- Drag-drop para reordenar z-order (Feature 3.2)

**Could Have:**
- Visibility toggle (eye icon)
- Lock toggle (lock icon)
- Rename object (duplo-clique)

**Layout:**
```
Layers
├── Rectangle 1
├── Group (2)
│   ├── Circle 1
│   └── Text 1
└── Arrow 1
```

---

## 11.5 Canvas Central (Main Canvas)

**Objetivo:** Área principal de edição.

**Behavior:**
- Espaço de trabalho responsivo
- Suporta pan/zoom (Feature 7.1, 7.2)
- Renderização suave (>30 FPS)
- Feedback visual de seleção (handles, outline)
- Feedback visual de hover (Could Have: subtle highlight)

**Background:**
- Branco puro (#FFFFFF)
- Sem grid (minimalista)
- Gridlines Could Have para Feature futura

**Responsiveness:**
- Adapta ao tamanho da janela
- Flexível (não quebra em telas pequenas)
- Scrollbars aparecem conforme necessário

**Cursor Feedback:**
- Normal: seta padrão
- Hover objeto: pointer (clicável)
- Tool ativo: ícone da ferramenta
- Pan mode: mão aberta
- Redimensionar: setas direcionais (↔, ↕, ↖, etc.)
