# Feature 7: Canvas & Navegação

## 7.1 Pan (Arrastar o Canvas)

**Objetivo:** Navegar por um canvas grande.

**Ativação:**
- Right-click + drag, ou
- Spacebar + drag

**Comportamento:**
- Cursor muda para "pan" cursor (↔ ou mão aberta)
- Canvas se move na direção oposta do drag
- Zoom level é mantido
- Objetos não se movem (apenas viewport muda)

---

## 7.2 Zoom in/out

**Objetivo:** Ajustar nível de detalhe.

**Métodos:**
- Scroll wheel: up = zoom in, down = zoom out
- Botões +/- na barra inferior (Feature 11.3)
- Preset "Fit to Screen" botão

**Range:** 10% a 500% (or user-defined limit)

**Visual:** Valor de zoom visível na barra inferior (ex: 100%, 150%)

**Comportamento:**
- Zoom é centralizado no cursor (zoom in expande ao redor do cursor)
- Objetos escalas proporcionalmente
- Texto pode ficar ilegível em zoom muito baixo (Could Have: escala dinâmica de texto)

---

## 7.3 Minimap

**Objetivo:** Visualizar todo o canvas e navegar rapidamente.

**Localização:** Corner inferior direito

**Conteúdo:**
- Representação reduzida de todo o canvas
- Todos os objetos visíveis (scaled down)
- Retângulo que indica viewport atual (viewport box)

**Interação:**
- Clique em minimap salta para aquela região
- Dragging no minimap move viewport em tempo real
- Minimap recolhível (Could Have)

---

## 7.4 Trackpad-friendly (Gestos)

**Objetivo:** Otimizar controles para usuários de trackpad.

**Gesto de Pinch (Dois dedos):** Zoom in/out
- Afastar dedos = zoom in
- Aproximar dedos = zoom out
- Velocidade proporcional ao movimento

**Gesto de Pan (Dois dedos):** Arrastar canvas
- Dois dedos + drag = pan
- Equivalente a spacebar + drag

**Behavior:**
- Gestos são nativos (não requerem hotkeys)
- Movimento é suave e responsivo
