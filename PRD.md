# archidraw — Product Requirements Document

**Version:** 1.0  
**Date:** 2026-05-31  
**Author:** Alisson Cruz  

---

## 1. Visão & Propósito

**archidraw** é um canvas web self-hosted para arquitetos e engenheiros de software desenharem soluções, arquiteturas e system designs. Ele une a leveza e velocidade do Excalidraw com recursos profissionais presentes em ferramentas como draw.io — sem a UX pesada dessas alternativas.

### Problema

Ferramentas existentes forçam uma escolha falsa:
- **Excalidraw:** rápida e leve, mas sem recursos profissionais (snapping, aligned distribution, icon libraries)
- **draw.io / Lucidchart:** completas, mas lentas e UI densa

### Solução

archidraw combina os dois. É uma SPA self-hosted rodando no browser do usuário, com dados persistidos localmente (IndexedDB) — sem backend, sem cloud, sem necessidade de criar contas.

### Usuário-alvo

- Engenheiro ou arquiteto individual
- Rodando em instância própria (localhost ou VPS privado)
- Sem necessidade de colaboração em tempo real
- Criando diagramas de arquitetura, system designs, fluxos de integração

### Modelo de Deployment

- SPA pura (HTML + JS + CSS)
- Roda em qualquer servidor estático ou `localhost`
- Dados no IndexedDB do browser (sem sincronização de rede)
- Exportação: formatos nativos (`.archidraw`) + SVG/PNG para compartilhamento

---

## 2. Features (MoSCoW)

### Must Have — v1 (MVP)

#### 1. Objetos & Formas

**1.1 Formas básicas** — [docs/feature/1.1-basic-shapes.md](docs/feature/1.1-basic-shapes.md)  
Criar formas (retângulo, círculo, losango, triângulo, linha, seta, texto) via toolbar ou atalho de teclado; cada forma aparece no canvas com posição/tamanho definido pelo arrastar do usuário.

**1.2 Seleção de objetos** — [docs/feature/1.2-object-selection.md](docs/feature/1.2-object-selection.md)  
Selecionar um objeto via clique; múltiplos via Shift+clique ou drag-box; visual feedback com highlight.

**1.3 Movimentação de objetos** — [docs/feature/1.3-object-movement.md](docs/feature/1.3-object-movement.md)  
Arrastar objetos selecionados para novas posições; multi-drag para mover todos os selecionados juntos.

**1.4 Redimensionamento com handles** — [docs/feature/1.4-object-resizing.md](docs/feature/1.4-object-resizing.md)  
8 handles (corners + midpoints); Shift+drag mantém aspecto; feedback visual de dimensões.

---

#### 2. Estilos

**2.1 Modo hardline e sketchline** — [docs/feature/2.1-hardline-sketchline.md](docs/feature/2.1-hardline-sketchline.md)  
Toggle global por diagrama (não por objeto); hardline = traços retos; sketchline = traços hand-drawn.

**2.2 Cores customizáveis (stroke e fill)** — [docs/feature/2.2-colors.md](docs/feature/2.2-colors.md)  
Color picker para stroke e fill; paleta comum + hex input; aplica à seleção ativa.

---

#### 3. Gerenciamento de Camadas (Z-Order)

**3.1 Painel de camadas** — [docs/feature/3.1-layers-panel.md](docs/feature/3.1-layers-panel.md)  
Painel lateral mostrando lista de objetos em ordem z-index; clique para selecionar; drag-drop para reordenar.

**3.2 Trazer à frente / Enviar atrás** — [docs/feature/3.2-bring-forward-send-back.md](docs/feature/3.2-bring-forward-send-back.md)  
Botões/hotkeys para mover seleção ao topo ou fundo da hierarquia visual.

---

#### 4. Conexões & Animação

**4.1 Magnetic snapping para setas** — [docs/feature/4.1-magnetic-snapping.md](docs/feature/4.1-magnetic-snapping.md)  
Setas detectam pontos de conexão em formas (topo/base/esquerda/direita); ao arrastar endpoint próximo, "gruda" automaticamente com visual feedback.

**4.2 Animated arrows** — [docs/feature/4.2-animated-arrows.md](docs/feature/4.2-animated-arrows.md)  
Animação contínua nas setas; toggle on/off global; controle de velocidade (lenta/normal/rápida).

---

#### 5. Alinhamento & Distribuição

**5.1 Alinhamento de objetos** — [docs/feature/5.1-alignment.md](docs/feature/5.1-alignment.md)  
6 operações (esquerda, centro horizontal, direita, topo, meio vertical, base); aplica a seleção múltipla.

**5.2 Distribuição uniforme** — [docs/feature/5.2-distribution.md](docs/feature/5.2-distribution.md)  
Distribuição horizontal e vertical com espaçamento equidistante; requer 3+ objetos selecionados.

---

#### 6. Agrupamento

**6.1 Agrupar / Desagrupar** — [docs/feature/6.1-grouping.md](docs/feature/6.1-grouping.md)  
Ctrl+G agrupa seleção em uma unidade (move/redimensiona coletivamente); Ctrl+Shift+G desagrupa; grupos podem conter grupos (hierarquia).

---

#### 7. Canvas & Navegação — [docs/feature/7-canvas-navigation.md](docs/feature/7-canvas-navigation.md)

**7.1 Pan (arrastar o canvas)**  
Right-click + drag (ou spacebar + drag) move a visualização; cursor muda para indicar pan mode.

**7.2 Zoom in/out**  
Scroll wheel para zoom; botões +/- na toolbar; preset "fit-to-screen"; valor de zoom visível.

**7.3 Minimap**  
Painel reduzido (corner inferior direito) mostrando todo o canvas com viewport atual; clique salta para região.

**7.4 Trackpad-friendly**  
Pinch zoom (dois dedos) e pan com dois dedos funcionam nativamente.

---

#### 8. Histórico

**8.1 Undo / Redo** — [docs/feature/8.1-undo-redo.md](docs/feature/8.1-undo-redo.md)  
Ctrl+Z/Ctrl+Y com stack de até 50 ações; todas as operações (criar, mover, deletar, cores, etc.) são reversíveis.

#### 9. Projetos & Organização — [docs/feature/9-projects-organization.md](docs/feature/9-projects-organization.md)

**9.1 Folders para agrupar projetos**  
Estrutura de pastas simples (sem limite de profundidade); criar/renomear/deletar folders; persistir em IndexedDB.

**9.2 Abas dentro de um projeto**  
Cada projeto pode ter N abas; trocar aba não perde estado; cada aba tem seu próprio set de objetos.

**9.3 Gerenciador de projetos**  
Lista com folders e projetos; ações: criar novo, renomear, deletar, abrir.

---

#### 10. Persistência & Export/Import — [docs/feature/10-persistence-export.md](docs/feature/10-persistence-export.md)

**10.1 Auto-save**  
Salva automaticamente a cada 5 segundos de inatividade; indicador visual.

**10.2 Export `.archidraw`**  
Download de arquivo JSON com todas as propriedades (objetos, estilos, abas); 100% re-importável sem perda.

**10.3 Import `.archidraw`**  
Drag-drop ou input file para importar `.archidraw`; carrega projeto completo com estado restaurado.

**10.4 Export SVG**  
Gera SVG limpo (vetor padrão); resolve posicionamento, cores, textos.

**10.5 Export PNG**  
Gera PNG com opções de DPI (1x, 2x, 4x); ideal para documentação.

**10.6 Import SVG**  
Parsa SVG e converte em objetos editáveis (best-effort).

---

#### 11. Layout da Interface (UX) — [docs/feature/11-ui-layout.md](docs/feature/11-ui-layout.md)

**11.1 Toolbar superior**  
Barra horizontal no topo com botões para cada forma (retângulo, círculo, seta, texto, etc.); indicador visual da ferramenta ativa; atalhos visíveis em tooltip.

**11.2 Painel lateral esquerdo**  
Painel recolhível com abas: (1) estilos (hardline/sketchline, cores), (2) alinhamento/distribuição, (3) propriedades do objeto selecionado.

**11.3 Barra inferior**  
Controles de zoom (-, valor em %, +), fit-to-screen, minimap embarcado, indicador de status.

**11.4 Painel de camadas**  
Painel recolhível mostrando árvore de objetos e grupos; drag-drop para reordenar z-order.

**11.5 Canvas central**  
Espaço de trabalho responsivo com pan/zoom; feedback visual de seleção e hover.

---

### Should Have — Após v1

#### Icon Libraries
- **Built-in packs:** AWS, GCP, Kubernetes, C4 Model (diálogo de seleção, carrega sob demanda)
- **Pack customizado:** usuário importa ZIP contendo SVGs, app registra como "biblioteca local"
- Drag-drop de ícones para o canvas
- Ícones escaláveis (parte do sistema de redimensionamento)

#### UX & Acessibilidade
- **Atalhos de teclado:** documenta principais shortcuts (Ctrl+G, Ctrl+Z, Del para deletar, etc.)
- **Tema dark/light:** toggle nas settings, applica a toda a UI
- **Responsive:** UI funcional em 1024x768+, canvas adapta

### Could Have — v2

#### Recursos Avançados
- **Grid no canvas:** pontos ou linhas, snap-to-grid opcional
- **Smart guides / alinhamento magnético:** guias visuais ao arrastar próximo a outros objetos (tipo Figma)
- **Export PDF:** formato imprimível
- **Busca/filtro:** localizar projetos por nome na lista

### Won't Have — Fora de Escopo

- Colaboração em tempo real (múltiplos cursores, edição simultânea)
- Backend ou cloud storage
- Histórico de versões ou backups automáticos
- Comentários ou anotações
- Mobile/tablet (assume desktop)
- Integração com ferramentas externas (Jira, Slack, etc.)

---

## 3. Requisitos Não-Funcionais

- **Performance:** canvas responsivo com até ~1.000 elementos simultâneos, renderização > 30 FPS
- **Canvas size:** coordenadas de 32-bit, espaço virtual ilimitado (scroll infinito em qualquer direção)
- **Portabilidade:** SPA pura, roda em qualquer servidor estático (Nginx, Apache, Python SimpleHTTPServer) ou `localhost` sem configuração de backend
- **Storage:** projetos persistidos via IndexedDB; limite apenas do browser/disco do dispositivo
- **Export fidelidade:** `.archidraw` é 100% re-importável sem perda; SVG/PNG são formatos "flat" (saída final, sem edição)
- **Compatibilidade:** Chrome e Firefox modernos (últimas 2 versões a partir de 2026-05-31)
- **Bundle size:** JS principal < 500 KB gzipped (icon packs carregam lazy)
- **Latência de interação:** feedback visual < 100ms em operações de UI (pan, zoom, seleção)

---

## 4. Critérios de Sucesso (Validação)

Um engenheiro consegue, **sem tutorial ou documentação:**

1. **Criar um diagrama:** desenhar uma arquitetura com 10+ componentes conectados por setas animadas em < 5 minutos
2. **Exportar & re-importar:** salvar como `.archidraw`, fechar o browser, re-abrir o arquivo, continuar editando sem perda de dados
3. **Organizar projetos:** criar 3 projetos em folders separados, navegar entre eles fluidamente
4. **Alinhar componentes:** aplicar alinhamento uniforme (espaçamento) em um grupo de 5 elementos em 2 cliques

---

## 5. Out of Scope (Decidido não fazer na v1+)

- Elementos 3D ou isométricos
- Integração com code (import from git, sync schemas, etc.)
- Templates pré-feitos de arquiteturas comuns
- Validação de diagramas (ex: ciclos de dependência, cycles detection)
- Ferramentas de análise (ex: estatísticas da arquitetura)
- Inteligência artificial / sugestões automáticas

---

## 6. Notas Técnicas

### Stack & Padrões

- **React 18+** com TypeScript
- **Canvas2D** (HTML5 `<canvas>`) para renderização do diagrama
- **IndexedDB** para persistência (schema versionado para migrations futuras)
- **zustand** ou **Redux Toolkit** para state management (a decidir na implementação)
- **SVG.js** ou similar para geração/parse de SVG

### Arquitetura Proposta

- **Editor Core:** gerencia canvas, objetos, seleção, rendering
- **State:** serialização/desserialização de projetos
- **UI Layer:** React components para painéis, menus, toolbars
- **Export/Import:** conversão para/de formatos (JSON `.archidraw`, SVG, PNG)

---

## Histórico de Alterações

| Versão | Data | Mudanças |
|--------|------|----------|
| 1.0 | 2026-05-31 | Initial PRD (lean, MoSCoW) |
