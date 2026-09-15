# ArchiDraw — Roadmap de Produto

> **Visão**: Tornar o ArchiDraw a ferramenta open-source e *local-first* de referência para modelagem, documentação e comunicação de arquitetura de software, unindo a fluidez do desenho manual à precisão semântica de engenharia.

---

## 1. Expansão do Catálogo de Componentes e Zonas Semânticas

Aumentar a cobertura de plataformas de nuvem, arquiteturas modernas e suporte a fronteiras de rede/isolamento para transformar o canvas em uma representação técnica fidedigna.

### 1.1 Provedores de Nuvem Expandidos (Multi-Cloud)
- ~~**1.1.1 Catálogo Oficial Google Cloud Platform (GCP)**~~
  - ~~Adicionar componentes vetoriais essenciais: Compute Engine, Cloud Run, GKE, Cloud Functions, BigQuery, Cloud Spanner, Cloud Storage, Pub/Sub, VPC e Cloud Armor.~~
  - ~~Categorização consistente com as seções já existentes (Compute, Network, Database, Storage, Messaging, Security, Monitoring).~~
- ~~**1.1.2 Catálogo Oficial Microsoft Azure**~~
  - ~~Adicionar componentes de referência: Azure Virtual Machines, App Service, AKS, Azure Functions, Cosmos DB, Azure SQL, Blob Storage, Service Bus, Event Grid e Virtual Network.~~
  - ~~Paleta de ícones vetoriais monocromáticos no mesmo padrão visual (viewBox 24x24, traço adaptável ao tema).~~

### 1.2 Tecnologias Modernas de Backend, Dados e DevOps
- **1.2.1 Bancos de Dados & Mensageria On-Premise/Agnósticos**
  - Componentes para PostgreSQL, MySQL, Redis, MongoDB, Apache Kafka, RabbitMQ, Elasticsearch, Cassandra e ClickHouse.
- **1.2.2 Ferramentas de Observabilidade, CI/CD e Segurança**
  - Componentes para Prometheus, Grafana, OpenTelemetry, HashiCorp Vault, Docker, NGINX, GitHub Actions e ArgoCD.

### 1.3 Zonas Semânticas e Contêineres de Isolamento (Boundaries)
- **1.3.1 Formas Estruturais com Semântica de Rede**
  - Introdução de contêineres pré-configurados com estilo tracejado e títulos identificadores: *VPC, Subnet Pública/Privada, Zona de Disponibilidade (AZ), Cluster Kubernetes, Namespace, Bounded Context (DDD)*.
- **1.3.2 Agrupamento Magnético por Contenção**
  - Capacidade do contêiner "capturar" logicamente os elementos posicionados em seu interior, permitindo mover ou redimensionar a zona arrastando todos os serviços internos sem desfazer alinhamentos e conexões.

---

## 2. Diagram-as-Code e Interoperabilidade Bidirecional

Permitir que desenvolvedores transitem fluidamente entre código declarativo e canvas visual, evitando bloqueio de fornecedor (vendor lock-in) e acelerando a adoção em equipes de engenharia.

### 2.1 Interoperabilidade com Mermaid.js
- **2.1.1 Importador de Mermaid para Canvas Nativo**
  - Parser de `flowchart` e `sequenceDiagram` em sintaxe Mermaid, convertendo nós e conexões em elementos editáveis no ArchiDraw.
- **2.1.2 Exportador de Canvas para Sintaxe Mermaid**
  - Geração de código Mermaid equivalente a partir do grafo de elementos e arestas do diagrama ativo, pronto para colar em PRs e wikis.

### 2.2 Suporte Nativo ao Modelo C4 (C4 Model)
- **2.2.1 Tipificação e Abstrações C4**
  - Suporte semântico aos níveis C4: *Pessoa/Usuário, Sistema de Software, Contêiner e Componente*.
  - Tags de estilo e metadados específicos para cada nível hierárquico.
- **2.2.2 Navegação Hierárquica Multi-Nível (Drill-Down)**
  - Associação de um elemento de alto nível (ex: um Contêiner) a uma aba secundária de diagrama (o detalhamento dos Componentes daquele contêiner), permitindo navegar entre níveis com um clique.

### 2.3 Automação CI/CD e Ferramenta de Linha de Comando (`archidraw-cli`)
- **2.3.1 Renderizador Headless (Zero-Browser CLI)**
  - Pacote CLI (`npx archidraw-cli render diagram.archidraw -o diagram.png|svg`) executável em ambientes Linux/CI sem interface gráfica.
- **2.3.2 GitHub Action Oficial para Sincronização de Imagens**
  - Action pré-configurada que recompila diagramas `.archidraw` para `.svg`/`.png` no commit, mantendo os diagramas de documentação dos repositórios sempre atualizados.

---

## 3. Arquitetura Viva, Metadados Técnicos e Governança

Elevar o valor do diagrama de um "desenho estático" para um artefato rico de engenharia, integrando documentação de decisões e especificações de sistemas.

### 3.1 Gestão de Metadados Técnicos Estruturados
- **3.1.1 Campos Específicos de Engenharia por Elemento e Aresta**
  - Expansão do campo `details` para metadados estruturados: protocolo de comunicação (gRPC, REST, Kafka Topic, WebSocket), porta, autenticação (mTLS, JWT, IAM), SLA/SLO de latência esperada e criticidade.
- **3.1.2 Modos de Visualização Alternáveis (Data Overlays)**
  - Alternância de visualização no canvas: modo padrão (limpo), modo segurança (destaque de autenticação e zonas de confiança), e modo volumetria (exibição de latências e vazão nas arestas).

### 3.2 Geração Automática de Documentação e Decisões de Arquitetura (ADRs)
- **3.2.1 Exportador de Design Doc / ADR em Markdown**
  - Botão de exportação que compila os componentes, conexões, anotações e decisões registradas no diagrama em um arquivo `ADR.md` ou template de RFC pronto para revisão de código.
- **3.2.2 Inventário de Ativos de Arquitetura (Software Bill of Materials - SBOM)**
  - Geração de relatório tabular com lista completa de serviços utilizados, dependências externas, protocolos de comunicação e integrações de terceiros.

### 3.3 Validador Arquitetural e Verificação de Boas Práticas (Architecture Lint)
- **3.3.1 Regras de Validação de Topologia**
  - Alertas não intrusivos no editor para anti-patterns comuns:
    - *3.3.1.1* Componentes de banco de dados posicionados diretamente em subnets públicas.
    - *3.3.1.2* Comunicações síncronas circulares entre microsserviços.
    - *3.3.1.3* Arestas órfãs ou sem direção de tráfego definida.

---

## 4. Produtividade de Desenho, Roteamento Inteligente e Ergonomia

Refinar a experiência de desenho para permitir a criação rápida de diagramas complexos com acabamento profissional e mínimo esforço de ajuste manual.

### 4.1 Guias Magnéticas Inteligentes (Smart Alignment & Spacing Guides)
- **4.1.1 Guias Visuais em Tempo Real**
  - Linhas guias temporárias que surgem ao arrastar elementos, indicando alinhamento centralizado ou por bordas em relação a vizinhos próximos.
- **4.1.2 Equalizador de Espaçamento Dinâmico**
  - Indicadores visuais de distância igual quando um elemento estiver sendo posicionado a distâncias equidistantes entre dois outros nós.

### 4.2 Roteamento Avançado de Arestas com Desvio de Obstáculos
- **4.2.1 Algoritmo de Desvio de Obstáculos (Obstacle-Aware Orthogonal Routing)**
  - Auto-routing que contorna caixas e componentes existentes no canvas sem cruzar sobre o meio de outras formas.
- **4.2.2 Saltos de Linha em Cruzamentos (Line Jumps / Bridges)**
  - Adição de pequenas pontes em formato de arco nos pontos de interseção de arestas, eliminando a ambiguidade visual sobre se duas linhas estão conectadas ou apenas se cruzando.

### 4.3 Ferramentas de Navegação em Grande Escala
- **4.3.1 Minimap de Navegação**
  - Widget retrátil no canto inferior exibindo a visão global da cena com retângulo indicador da viewport atual para pan rápido.
- **4.3.2 Busca e Filtro Global no Canvas**
  - Barra de busca rápida (`⌘F` / `Ctrl+F`) para localizar elementos no diagrama por nome, tipo de componente, rótulo ou conteúdo de notas técnicas.

---

## 5. Apresentação, Storytelling e Compartilhamento

Facilitar a apresentação de arquiteturas em reuniões de design review, gravações técnicas e documentos corporativos.

### 5.1 Modo Apresentação e Storytelling de Arquitetura
- **5.1.1 Criação de Passos e Quadros de Foco (Frames / Steps)**
  - Definição de sequência de passos na barra lateral, onde cada passo foca em uma região do diagrama ou revela partes da arquitetura progressivamente.
- **5.1.2 Destaque de Fluxo Guiado**
  - Reprodução animada que acende os caminhos de dados passo a passo para explicar um fluxo de requisição ponta a ponta.

### 5.2 Visualizador Interativo e Embed para Documentação
- **5.2.1 Modo Leitor Embebível (Interactive Web Component)**
  - Script ultraleve de visualização sem ferramentas de edição para incorporar diagramas em Notion, Confluence, Docusaurus ou sites estáticos, mantendo pan, zoom e visualização de detalhes em hover.
- **5.2.2 Hiperlinks Externos em Elementos**
  - Capacidade de vincular um elemento a uma URL externa (ex: repositório no GitHub, documentação de API OpenAPI/Swagger ou painel no Datadog).

### 5.3 Exportação em Massa e Formato Vetorial Multi-Página
- **5.3.1 Exportação de Espaço de Trabalho Completo**
  - Opção de exportar todas as abas de uma só vez para um documento PDF multipágina vetorial ou um arquivo ZIP contendo SVGs/PNGs nomeados por aba.

---

## 6. Colaboração Local-First e Integração com IDEs

Expandir o ecossistema mantendo o princípio fundacional de privacidade e independência de servidores em nuvem.

### 6.1 Colaboração P2P em Tempo Real (Local-First Sync)
- **6.1.1 Colaboração Peer-to-Peer sem Servidor Central**
  - Sincronização em tempo real via WebRTC e CRDTs (sem armazenamento de diagramas em servidor de terceiros), bastando compartilhar um link de sala efêmero.
- **6.1.2 Presença e Cursores Concorrentes**
  - Exibição de cursores de colegas de equipe com nomes ou avatares coloridos no canvas durante sessões colaborativas de design.

### 6.2 Extensões para IDEs e Editores de Texto
- **6.2.1 Extensão Oficial para VS Code e Cursor**
  - Editor visual embutido como Custom Editor no VS Code, permitindo abrir, editar e salvar arquivos `.archidraw` diretamente no repositório de código.
- **6.2.2 Plugin para Obsidian / Logseq**
  - Integração com ferramentas de gestão de conhecimento pessoal (PKM) com renderização direta no fluxo de notas em markdown.
