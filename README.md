# ArchiDraw

Canvas de desenho para **arquiteturas de software e system design** — estilo Excalidraw/draw.io, mas com inteligência de domínio: componentes prontos (APIs, filas, bancos, caches, CDNs), notação padronizada e numeração de eventos. Desenhe arquitetura na velocidade do pensamento.

## Objetivo

Ferramentas genéricas de desenho exigem trabalho manual demais: buscar ícones, alinhar, manter consistência. O ArchiDraw é feito para **engenheiros e arquitetos de software** que precisam de rapidez em propostas técnicas, RFCs/ADRs, documentação e preparação para entrevistas de system design — rodando **100% local**, sem contas, sem nuvem, sem custo recorrente.

## Features (macro)

- **Canvas infinito** com pan, zoom, snap e guias inteligentes
- **Formas e conexões:** retângulo, elipse, losango, setas (reta, elbow, curva), texto livre e inline
- **Biblioteca de componentes de software:** API Gateway, Load Balancer, Service, Database, Cache, Message Queue, CDN, Lambda e mais
- **Ícones AWS** (biblioteca oficial)
- **Conexões semânticas:** labels de protocolo (HTTP/gRPC/WebSocket/TCP/AMQP), direção sync/async
- **Animação de setas tracejadas** indicando fluxo/direção
- **Numeração automática de setas** para cronologia de eventos do fluxo
- **Hover info box:** detalhes técnicos complementares (payload, latência, observações) ocultos por padrão
- **Grupos semânticos:** boundary boxes (VPC, Cluster K8s, Bounded Context)
- **Múltiplas abas de canvas** por workspace
- **Undo/Redo, seleção múltipla, camadas, copiar/colar/duplicar**
- **Atalhos de teclado** completos
- **Persistência automática** via localStorage — sem botão "salvar"
- **Exportação:** PNG, SVG e JSON portável (`.archidraw`); **import/export compatível com Excalidraw** (best-effort)
- **Dark mode**
- **Privacidade total:** dados nunca saem da máquina

## Como usar

### Docker (recomendado)

```bash
docker build -t archidraw .
docker run -d --name archidraw -p 5000:5000 archidraw
```

Acesse **http://localhost:5000**.

A porta de origem é configurável via `-p` (ex.: `-p 8080:5000` expõe na 8080).

### Desenvolvimento local

Requisitos: Node.js 20+ e npm.

```bash
npm install
npm run dev          # dev server (Vite)
```

Outros comandos úteis:

```bash
npm run lint         # oxlint
npm run build        # typecheck + build de produção
npm run test:e2e     # testes Playwright (build real + preview)
npm run test:e2e:ui  # UI interativa do Playwright
```

### Fluxo básico de uso

1. Abra o app e desenhe no canvas: `R` retângulo, `A` seta, `T` texto, `V` seleção, `H` mão.
2. Adicione componentes da biblioteca de arquitetura e ícones AWS.
3. Numere as setas para indicar a cronologia do fluxo; adicione detalhes técnicos via hover info box.
4. Tudo é salvo automaticamente no navegador. Use export/import JSON para backup ou mover entre instâncias.

## Documentação

- [PRD.md](PRD.md) — visão de produto e roadmap
- [CONTRIBUTING.md](CONTRIBUTING.md) — guia para contribuidores
- [AGENTS.md](AGENTS.md) — diretrizes de desenvolvimento e knowledge base

## Licença

[Apache-2.0](LICENSE)
