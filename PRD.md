# PRD — ArchiDraw

**Produto:** ArchiDraw
**Tipo:** Webapp de desenho em canvas (estilo Excalidraw/draw.io), self-hosted via container Docker local
**Foco:** Engenheiros e arquitetos de software para criação de arquiteturas e system design
**Versão do documento:** 0.3
**Data:** 2026-08-24
**Status:** Rascunho

---

## 1. Visão

O ArchiDraw é um canvas visual para desenhar arquiteturas de software, diagramas C4 e fluxos de system design, executado como **container Docker local** para uso pessoal. Diferente de ferramentas genéricas de desenho, ele entende **o domínio de engenharia de software**: componentes (APIs, filas, bancos, caches, CDNs), notação padronizada e metadados técnicos.

> **Proposta central:** "Desenhe arquitetura na velocidade do pensamento" — com inteligência de domínio (templates, componentes prontos, numeração de eventos) que ferramentas genéricas não oferecem.

**Modelo de execução:**
- Aplicação self-hosted em **container Docker local** (uso individual, sem contas de usuário)
- **Sem colaboração em tempo real** — uma pessoa, uma instância
- Persistência **automática via localStorage** do navegador

## 2. Problema

- Ferramentas genéricas (Excalidraw, draw.io) exigem trabalho manual excessivo: buscar ícones, alinhar, manter consistência visual.
- Falta de notação padrão leva a diagramas ambíguos.
- Diagramas de system design precisam comunicar **cronologia de eventos**, o que as ferramentas atuais não suportam nativamente.
- Serviços em nuvem exigem login/sync; para uso pessoal, um container local é mais simples, privado e sem custo recorrente.

## 3. Persona

| Persona | Descrição | Necessidades principais |
|---|---|---|
| **Engenheiro/Arquiteto (você)** | Uso pessoal: propostas técnicas, RFCs/ADRs, preparação para entrevistas de system design, documentação | Rapidez, atalhos de teclado, biblioteca AWS, detalhamento sob demanda, exportação limpa |

## 4. Features

### 4.1 MVP (v0.1)

#### Canvas & Desenho
- [ ] **Canvas infinito** com pan (espaço + drag / scroll) e zoom (scroll/pinch, fit-to-screen, zoom to selection)
- [ ] **Formas básicas:** retângulo, elipse, losango, linha/seta (reta, ortogonal/elbow, curva)
- [ ] **Texto livre** e texto dentro de formas
- [ ] **Edição inline** (duplo clique para editar)
- [ ] **Estilização:** cor de preenchimento, stroke, espessura, estilo de linha (contínua, tracejada), opacidade
- [ ] **Snap e guias inteligentes** (alinhamento, distribuição, snap em grade opcional)
- [ ] **Undo/Redo**
- [ ] **Seleção múltipla** (marquee, shift+click), agrupar/desagrupar
- [ ] **Ordem de camadas** (trazer para frente/enviar para trás)
- [ ] **Copiar/colar/duplicar**

#### Abas de Canvas
- [ ] **Múltiplas abas de canvas** por workspace (estilo abas de navegador/editor)
- [ ] **Nomeação de abas** (renomear via duplo clique ou menu de contexto)
- [ ] Criar, fechar e alternar entre abas; cada aba é um diagrama independente com estado próprio

#### Elementos de Arquitetura (diferencial de domínio)
- [ ] **Biblioteca de componentes de software:** API Gateway, Load Balancer, Service, Database (SQL/NoSQL), Cache, Message Queue/Broker, Storage/Bucket, CDN, Auth Service, Client/Browser/Mobile, Lambda/FaaS, Container/Docker, Kubernetes cluster, etc.
- [ ] **Ícones AWS** (biblioteca oficial — único provedor cloud suportado)
- [ ] **Conexões semânticas:** setas com labels de protocolo (HTTP/gRPC/WebSocket/TCP/AMQP), direção (sync/async), estilo por tipo
- [ ] **Grupos semânticos:** boundary/context boxes (ex.: "VPC", "Cluster K8s", "Bounded Context") com label e cor
- [ ] **Animação de setas tracejadas** (marching ants / dash animation) indicando fluxo/direção — ativável por seta

#### Detalhamento sob demanda (hover info box)
- [ ] **Infos complementares em setas e elementos:** campo de texto estendido (descrição técnica, observações, payload exemplo, latência esperada etc.)
- [ ] Box de detalhes **oculto por padrão**, exibido ao posicionar o mouse sobre o elemento (tooltip rico/popup)
- [ ] Indicador visual discreto quando elemento possui detalhes (ex.: pequeno ícone "i")

#### Numeração automática de setas
- [ ] **Numeração incremental automática** em setas (badge "1", "2", "3"...) para identificar a cronologia dos eventos do fluxo
- [ ] Ativação por seleção de setas; reordenação manual da sequência (via painel de fluxo)
- [ ] Renumerar automaticamente ao remover/inserir seta na sequência

#### UX Básica
- [ ] **Toolbar** lateral superior (estilo Excalidraw): seleção, mão, formas, seta, texto, biblioteca
- [ ] **Painel de propriedades** contextual à esquerda
- [ ] **Atalhos de teclado** completos (V=seleção, H=mão, R=retângulo, A=seta, T=texto, Cmd+Z/Y, Cmd+D, Delete, etc.)
- [ ] **Menu de contexto** (botão direito): duplicar, trazer para frente, travar, etc.
- [ ] **Persistência automática via localStorage** — todo estado (abas, diagramas, viewport) salvo automaticamente, sem botão "salvar"
- [ ] **Exportação:**
  - Imagem: **PNG** e **SVG**
  - **JSON padrão**: formato serializável e estável, importável em qualquer outra instância do ArchiDraw (*.archidraw)
- [ ] **Importação de JSON** (restaurar diagrama exportado de outra instância)
- [ ] **Compatibilidade Excalidraw:**
  - Import: carregar arquivos `.excalidraw` (formas, setas, textos, bindings → schema nativo)
  - Export: gerar `.excalidraw` (*best-effort*; campos de domínio como numeração e hover info não são representados e são descartados)

### 4.2 v0.2 — Produtividade

- [ ] **Auto-layout automático** de grafos (dagre/ELK) para topologias e fluxos
- [ ] **Templates prontos:** monólito → microsserviços, event-driven, serverless, arquitetura de entrevista de system design
- [ ] **Duplicar aba** (variação de um diagrama existente)
- [ ] **Painel de fluxo** lateral listando as setas numeradas em ordem cronológica, com navegação (clicar → destaca no canvas)

### 4.3 v0.3 — Refinamento

- [ ] **Notação C4 estruturada** (context, container, component) com templates
- [ ] **Diagram-as-code:** gerar diagrama a partir de DSL textual (tipo Structurizr/D2/Mermaid subset) e vice-versa
- [ ] **Biblioteca customizada** (importar ícones SVG próprios)
- [ ] **Backup/exportação de workspace completo** (todas as abas em um único JSON)
- [ ] **Exportação adicional:** PDF

### 4.4 Futuro (backlog exploratório)

- Geração de rascunho de arquitetura a partir de descrição textual
- Geração de diagrama a partir de IaC (Terraform plan) ou OpenAPI specs
- Modo apresentação (frames dentro do canvas)
- Sync opcional com arquivo/repositório (diagrama vivo versionado em git)

## 5. Requisitos Não-Funcionais

| Categoria | Requisito |
|---|---|
| **Execução** | Empacotado como imagem Docker única (frontend + API leve se necessário); subir com `docker run` / docker-compose |
| **Performance** | Canvas fluido a 60fps com ≥ 500 elementos; renderização virtualizada (só viewport) |
| **Offline** | Funciona 100% local, sem chamadas externas |
| **Privacidade** | Dados nunca saem da máquina local; persistência apenas em localStorage do navegador |
| **Portabilidade** | Export/import JSON entre instâncias deve ser estável (schema versionado) |
| **Acessibilidade** | Contraste WCAG AA, navegação por teclado nos controles |
| **i18n** | Strings externalizadas desde o início (pt-BR/en) |

## 6. Stack Técnica (proposta)

| Camada | Escolha proposta | Justificativa |
|---|---|---|
| Framework | React + TypeScript + Vite | Ecossistema, tipagem, DX |
| Canvas | Custom sobre HTML5 Canvas (inspirado na arquitetura do Excalidraw) ou Konva.js | Performance em canvas infinito; animação de dash nativa no Canvas 2D (`setLineDash` + `lineDashOffset`) |
| Estado | Zustand + Immer (mutações/history) | Simples, performático |
| Persistência | localStorage (com debounce de autosave); IndexedDB como fallback futuro se volume exigir | Requisito definido: localStorage automático |
| Auto-layout (v0.2) | dagre ou ELK.js | Layout de grafos |
| Entrega | Dockerfile multi-stage (build estático servido por nginx) | Container local simples |
| Testes | Vitest + Testing Library; Playwright (E2E) | Padrão do ecossistema |

## 7. Riscos & Mitigações

| Risco | Mitigação |
|---|---|
| Complexidade do canvas custom (gestos, hit-testing, performance) | Começar com escopo mínimo de formas; considerar Konva se velocidade exigir; testes E2E cedo |
| localStorage limitado (~5MB) para muitos diagramas grandes | Comprimir payloads; monitorar uso; migrar para IndexedDB mantendo mesma interface se necessário |
| Perda de dados se usuário limpar dados do navegador | Export JSON como mecanismo oficial de backup; workspace completo exportável em v0.3 |
| Escopo inflando antes do MVP | Congelar MVP nas features da seção 4.1 |

## 8. Decisões Técnicas

| # | Decisão | Escolha | Racional |
|---|---|---|---|
| 1 | Canvas engine | **Custom (HTML5 Canvas puro)**, inspirado na arquitetura do Excalidraw | Features de domínio (hover box, numeração, animação de dash) brigariam com a abstração do Konva; escopo mínimo no início (retângulo + seta + texto antes de qualquer feature de domínio) |
| 2 | Formato do documento | **Schema próprio versionado** (`schemaVersion`) com compatibilidade Excalidraw: import completo, export best-effort (campos de domínio descartados) | Suporte nativo a numbering/hover info/abas; round-trip tests obrigatórios para o JSON nativo |
| 3 | Dark mode | **Sim, no MVP**, via design tokens (CSS variables) desde o 1º componente | Custo ~zero se tokens forem definidos cedo |
| 4 | Estrutura do repositório | **App único (Vite)** com `src/core` isolado — modelo, geometria, serialização e history sem dependência de React | Extração para package/monorepo depois é mecânica se as fronteiras forem respeitadas; extraímos quando o diagram-as-code (v0.3) pedir |
| 5 | Render loop das setas animadas | **rAF condicional**: loop roda apenas quando há setas animadas visíveis no viewport; caso contrário, render sob demanda (dirty flag) | Evita repaint constante a 60fps em tela parada (economia de CPU/bateria) |

---

## Changelog do documento

- **0.3 (2026-08-24):** Decisões técnicas fechadas (seção 8) — canvas custom, schema próprio + compatibilidade Excalidraw (import/export), dark mode via tokens no MVP, app único com core isolado, rAF condicional para setas animadas. Adicionada compatibilidade Excalidraw ao MVP.
- **0.2 (2026-08-24):** Ajustes de escopo — self-hosted Docker local, sem multiplayer; abas de canvas nomeáveis; hover info box em elementos/setas; numeração incremental automática de setas; animação de setas tracejadas; ícones somente AWS; export PNG/SVG/JSON portável; persistência automática via localStorage; removidas validações de arquitetura e métricas de sucesso.
- **0.1 (2026-08-24):** Versão inicial.
