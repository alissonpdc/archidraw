# System Design Native Components (`lib-native.md`)

Este documento ensina como utilizar componentes nativos de System Design em diagramas Archidraw e como descompactar seus elementos vetoriais diretamente a partir dos arquivos `.archidrawlib`.

> [!IMPORTANT]
> **Distinção Crítica: Ícones SVG vs Blocos de System Design (`sd-*`)**
> - **Ícones SVG (`aws-*`, `k8s-*`, `gcp-*`, `azure-*`)**: São ícones atômicos. O uso de `type: "component"` é o **formato oficial e permanente** tanto em arquivos `.archidraw` quanto na área de transferência (consulte [`/ai/lib-svg.md`](file:///root/GitHub/archidraw/src/ai/lib-svg.md)). Eles **não** devem ser descompactados.
> - **Blocos de System Design (prefixo `sd-*`)**: Já estão prontos e desenhados! **NUNCA tente recriar ou desenhar essas formas manualmente.** Em arquivos `.archidraw` (workspace), os componentes nativos (`sd-*`) **devem ser obtidos via `GET /ai/lib/<slug>.archidrawlib`**, copiando diretamente o array pronto `item.archidrawElements` e apenas aplicando o deslocamento para a coordenada `(x, y)` de destino. Não utilize `type: "component"` para itens `sd-*` em arquivos de workspace (o validador `window.archidrawValidate` emitirá um aviso).

---

## 1. Como Obter e Desempacotar Itens no Arquivo `.archidraw` (Passo a Passo)

**ATENÇÃO: Não invente nem tente desenhar as formas vetoriais.** Todos os 68 blocos de arquitetura já estão finalizados e empacotados nas 8 bibliotecas oficiais. O agente deve apenas fazer o download da biblioteca e copiar os elementos:

### Algoritmo de Extração e Inserção

1. **Identificar o Item e a Biblioteca**: Consulte a tabela da Seção 2 para localizar o `componentId` desejado e o respectivo `<slug>.archidrawlib` (ex: `sd-data-storage-relational-db` está em `data-storage.archidrawlib`).
2. **Consultar o Arquivo da Biblioteca**: Faça uma requisição HTTP `GET /ai/lib/<slug>.archidrawlib`.
3. **Localizar o Item**: No JSON retornado, busque em `libraryItems` o item cujo `id` seja igual ao `componentId` (`item.id === "sd-data-storage-relational-db"`).
4. **Extrair `archidrawElements`**: Copie o array de elementos do template contido em `item.archidrawElements`.
5. **Calcular o Deslocamento de Posição (`dx, dy`)**:
   - Calcule a origem do template: `minX = Math.min(...elements.map(e => e.x))`, `minY = Math.min(...elements.map(e => e.y))`.
   - Determine o deslocamento para a coordenada de destino `(targetX, targetY)` desejada no diagrama:
     `dx = targetX - minX`, `dy = targetY - minY`.
6. **Gerar Grupo e IDs Únicos**:
   - Crie um identificador de grupo compartilhado: `const groupId = "grp_" + Math.random().toString(36).slice(2, 9);`.
   - Atribua novos IDs únicos para cada forma (`el_<base36>_<counter>`) e defina `groupId: groupId` em todos eles.
7. **Aplicar Deslocamento**: Para cada elemento, atualize `x = el.x + dx` e `y = el.y + dy`.
8. **Atualizar Rótulo Customizado (se aplicável)**: Se você deseja um nome personalizado (ex: `"Users DB"` em vez do nome padrão `"Relational DB"`), localize o elemento do tipo `text` cujo `text` coincida com `item.name` e altere para o seu rótulo.
9. **Inserir no Workspace**: Adicione o conjunto de elementos descompactados diretamente no array `tabs[0].doc.elements` do arquivo `.archidraw`.

---

### Exemplo Comparativo: Incorreto vs Correto no `.archidraw`

#### ❌ INCORRETO no `.archidraw` (Gera aviso no validador):

```json
{
  "type": "component",
  "componentId": "sd-data-storage-relational-db",
  "x": 300,
  "y": 200,
  "label": "Users DB"
}
```

#### ✅ CORRETO no `.archidraw` (Elementos vetoriais descompactados e agrupados):

```json
[
  {
    "id": "el_sql_rect_1",
    "type": "rectangle",
    "groupId": "grp_users_db_1",
    "x": 300,
    "y": 215,
    "width": 80,
    "height": 55,
    "strokeColor": "#114c83",
    "backgroundColor": "#d3e1ed",
    "strokeWidth": 2,
    "roughness": 1,
    "borderRadius": 0
  },
  {
    "id": "el_sql_top_1",
    "type": "ellipse",
    "groupId": "grp_users_db_1",
    "x": 300,
    "y": 200,
    "width": 80,
    "height": 30,
    "strokeColor": "#114c83",
    "backgroundColor": "#d3e1ed",
    "strokeWidth": 2,
    "roughness": 1
  },
  {
    "id": "el_sql_txt_1",
    "type": "text",
    "groupId": "grp_users_db_1",
    "x": 300,
    "y": 280,
    "width": 80,
    "height": 20,
    "text": "Users DB",
    "fontSize": 14,
    "strokeColor": "#092a48",
    "backgroundColor": "transparent",
    "textAlign": "center"
  }
]
```

---

## 2. Catálogo de Componentes Nativos & Arquivos `.archidrawlib`

Abaixo estão todos os itens disponíveis organizados por categoria. Para obter os vetores exatos de qualquer item, acesse:

```http
GET /ai/lib/<slug>.archidrawlib
```

### Clients & Devices (`clients-devices.archidrawlib`)

| componentId | Descrição visual | <slug>.archidrawlib |
|---|---|---|
| `sd-clients-devices-user` | A green person silhouette with an ellipse head and curved torso with caption "User" | `clients-devices.archidrawlib` |
| `sd-clients-devices-users` | A group of three people silhouettes (two grey in background, one blue in front) with caption "Users" | `clients-devices.archidrawlib` |
| `sd-clients-devices-developer` | A blue person silhouette holding a display screen labeled "</>" with caption "Developer" | `clients-devices.archidrawlib` |
| `sd-clients-devices-admin` | A teal person silhouette holding a terminal console labeled ">_ admin" with caption "Admin" | `clients-devices.archidrawlib` |
| `sd-clients-devices-mobile-app` | A smartphone frame enclosing four colorful app tiles (blue, green, orange, purple) with caption "Mobile App" | `clients-devices.archidrawlib` |
| `sd-clients-devices-web-browser` | A cyan browser window with three traffic-light dots and an address bar with caption "Web Browser" | `clients-devices.archidrawlib` |
| `sd-clients-devices-browser` | A desktop browser window with colored top buttons and navigation bar with caption "Browser" | `clients-devices.archidrawlib` |
| `sd-clients-devices-smartphone` | A vertical mobile phone frame with screen and home indicator with caption "Smartphone" | `clients-devices.archidrawlib` |
| `sd-clients-devices-tablet` | A tablet device frame displaying article text columns with caption "Tablet" | `clients-devices.archidrawlib` |
| `sd-clients-devices-web-search` | A browser window displaying a search engine interface with search bar with caption "Web Search" | `clients-devices.archidrawlib` |
| `sd-clients-devices-iot-device` | A microchip circuit package labeled "IoT" with connecting side pin leads with caption "IoT Device" | `clients-devices.archidrawlib` |

### Infrastructure & Network (`infra-network.archidrawlib`)

| componentId | Descrição visual | <slug>.archidrawlib |
|---|---|---|
| `sd-infra-network-internet` | A blue cloud shape labeled "www" with caption "Internet" | `infra-network.archidrawlib` |
| `sd-infra-network-dns` | A blue network globe sphere labeled "DNS" with an orbital line with caption "DNS" | `infra-network.archidrawlib` |
| `sd-infra-network-cdn` | A central cyan node labeled "EDGE" connected to four distributed edge nodes with caption "CDN" | `infra-network.archidrawlib` |
| `sd-infra-network-load-balancer` | A blue distributor box splitting an incoming line into four directional arrows with caption "Load Balancer" | `infra-network.archidrawlib` |
| `sd-infra-network-api-gateway` | A purple gateway container routing requests through directional arrows with caption "API Gateway" | `infra-network.archidrawlib` |
| `sd-infra-network-reverse-proxy` | A blue server container labeled "proxy" intercepting bidirectional arrows with caption "Reverse Proxy" | `infra-network.archidrawlib` |
| `sd-infra-network-nat-gateway` | A blue network translator box labeled "NAT" with directional routing arrows with caption "NAT Gateway" | `infra-network.archidrawlib` |
| `sd-infra-network-vpn-tunnel` | A cyan cylindrical conduit tunnel enclosing secure network packets with caption "VPN Tunnel" | `infra-network.archidrawlib` |
| `sd-infra-network-router` | A network routing hub box dispatching crossed transmission lines with caption "Router" | `infra-network.archidrawlib` |
| `sd-infra-network-firewall` | A security network barrier deflecting unauthorized packets with caption "Firewall" | `infra-network.archidrawlib` |

### Compute & Services (`compute-services.archidrawlib`)

| componentId | Descrição visual | <slug>.archidrawlib |
|---|---|---|
| `sd-compute-services-application-server` | A server box with two ventilation slots, status LED, and caption "Application Server" | `compute-services.archidrawlib` |
| `sd-compute-services-microservice` | A modular hex-tile service node labeled "API" with caption "Microservice" | `compute-services.archidrawlib` |
| `sd-compute-services-worker` | A background worker box with gear cogwheel and execution gears with caption "Worker" | `compute-services.archidrawlib` |
| `sd-compute-services-serverless-function` | A serverless function card with lightning badge and parameter signature "f(x)" with caption "Serverless Function" | `compute-services.archidrawlib` |
| `sd-compute-services-cron-job` | A timed execution box displaying a clock face dial with caption "Cron Job" | `compute-services.archidrawlib` |
| `sd-compute-services-virtual-machine` | A rack-mount VM server frame with host indicator badges with caption "Virtual Machine" | `compute-services.archidrawlib` |
| `sd-compute-services-container` | A shipping cargo container box with vertical corrugated slats with caption "Container" | `compute-services.archidrawlib` |
| `sd-compute-services-kubernetes-pod` | A Kubernetes helm wheel containing container pod nodes with caption "Kubernetes Pod" | `compute-services.archidrawlib` |
| `sd-compute-services-service-registry` | A catalog cabinet with discovery index drawers and status lights with caption "Service Registry" | `compute-services.archidrawlib` |

### Data & Storage (`data-storage.archidrawlib`)

| componentId | Descrição visual | <slug>.archidrawlib |
|---|---|---|
| `sd-data-storage-relational-db` | A blue cylinder with label "SQL" with caption "Relational DB" | `data-storage.archidrawlib` |
| `sd-data-storage-database-cluster` | A primary database cylinder labeled "Writer" replicating via arrow to a replica cylinder labeled "Reader" with caption "Database Cluster" | `data-storage.archidrawlib` |
| `sd-data-storage-document-db` | An orange cylinder labeled "{ }" with caption "Document DB" | `data-storage.archidrawlib` |
| `sd-data-storage-key-value-store` | An indexed hash table with pairs of "K" and "V" slot blocks with caption "Key-Value Store" | `data-storage.archidrawlib` |
| `sd-data-storage-in-memory-cache` | A rounded cache block with a lightning bolt badge and memory slots with caption "In-Memory Cache" | `data-storage.archidrawlib` |
| `sd-data-storage-object-storage` | A bucket cylinder with an open top rim and drop handle with caption "Object Storage" | `data-storage.archidrawlib` |
| `sd-data-storage-blob-storage` | A binary file block labeled "0101" with caption "Blob Storage" | `data-storage.archidrawlib` |
| `sd-data-storage-file-storage` | A file folder icon containing nested filesystem documents with caption "File Storage" | `data-storage.archidrawlib` |
| `sd-data-storage-data-lake` | A deep multi-tier data reservoir structure with wave layer lines with caption "Data Lake" | `data-storage.archidrawlib` |
| `sd-data-storage-data-warehouse` | A warehouse structure containing schema tables labeled "DIM", "FACT", "AGG" with caption "Data Warehouse" | `data-storage.archidrawlib` |
| `sd-data-storage-graph-db` | A database cylinder connected to a network of graph nodes and vertex lines with caption "Graph DB" | `data-storage.archidrawlib` |
| `sd-data-storage-time-series-db` | A database cylinder displaying a fluctuating metric line chart on its front face with caption "Time-Series DB" | `data-storage.archidrawlib` |
| `sd-data-storage-vector-database` | A database cylinder overlaid with three-dimensional vector coordinate axes with caption "Vector Database" | `data-storage.archidrawlib` |
| `sd-data-storage-search-engine` | A document index catalog with a magnifying glass lens with caption "Search Engine" | `data-storage.archidrawlib` |

### Messaging & Events (`messaging-events.archidrawlib`)

| componentId | Descrição visual | <slug>.archidrawlib |
|---|---|---|
| `sd-messaging-events-message-queue` | A horizontal pipe queue containing three partitioned message packets with an entry arrow with caption "Message Queue" | `messaging-events.archidrawlib` |
| `sd-messaging-events-pub-sub-topic` | A central broadcast block labeled "Topic" emitting divergent fanned-out arrows with caption "Pub-Sub Topic" | `messaging-events.archidrawlib` |
| `sd-messaging-events-event` | A message payload card labeled with JSON data "{ json }" with caption "Event" | `messaging-events.archidrawlib` |
| `sd-messaging-events-stream-processor` | A continuous stream pipeline dividing events across parallel worker boxes "W1", "W2", "W3" with caption "Stream Processor" | `messaging-events.archidrawlib` |
| `sd-messaging-events-dead-letter-queue` | A quarantine queue holding a failed message "FAIL" with an alert badge "!" with caption "Dead Letter Queue" | `messaging-events.archidrawlib` |
| `sd-messaging-events-webhook-dispatcher` | An event dispatcher sending an HTTP "POST" arrow from an event block with caption "Webhook Dispatcher" | `messaging-events.archidrawlib` |
| `sd-messaging-events-data-pipeline` | A multi-stage processing pipeline connected by sequential flow arrows with caption "Data Pipeline" | `messaging-events.archidrawlib` |

### Security & Identity (`security-identity.archidrawlib`)

| componentId | Descrição visual | <slug>.archidrawlib |
|---|---|---|
| `sd-security-identity-identity-provider` | A directory console frame displaying a user profile silhouette with caption "Identity Provider" | `security-identity.archidrawlib` |
| `sd-security-identity-auth` | A security shield overlaid with a circular keyhole badge with caption "Auth" | `security-identity.archidrawlib` |
| `sd-security-identity-access-token-jwt` | An encoded JWT token bar divided into three colored segments labeled "H", "P", "S" with caption "Access Token (JWT)" | `security-identity.archidrawlib` |
| `sd-security-identity-secrets-vault` | A bank vault safe door with combination dial and security bolts with caption "Secrets Vault" | `security-identity.archidrawlib` |
| `sd-security-identity-key-management` | A key generation block paired with cryptographic encryption keys with caption "Key Management" | `security-identity.archidrawlib` |
| `sd-security-identity-tls-certificate` | A digital certificate document stamped with a security padlock seal with caption "TLS Certificate" | `security-identity.archidrawlib` |
| `sd-security-identity-firewall` | A protective red brick wall barrier with caption "Firewall" | `security-identity.archidrawlib` |
| `sd-security-identity-waf` | A security shield labeled "WAF" with caption "WAF" | `security-identity.archidrawlib` |
| `sd-security-identity-ddos-protection` | A defensive shield deflecting multiple incoming attack vector lines with caption "DDoS Protection" | `security-identity.archidrawlib` |

### Observability & Operations (`observability-ops.archidrawlib`)

| componentId | Descrição visual | <slug>.archidrawlib |
|---|---|---|
| `sd-observability-ops-monitoring` | A dashboard monitor display with telemetry gauge dials and status bars with caption "Monitoring" | `observability-ops.archidrawlib` |
| `sd-observability-ops-logs` | A log stream sheet with sequential text lines and a highlighted red error line with caption "Logs" | `observability-ops.archidrawlib` |
| `sd-observability-ops-metrics` | A telemetry panel displaying a multi-bar histogram chart with caption "Metrics" | `observability-ops.archidrawlib` |
| `sd-observability-ops-distributed-tracing` | A waterfall trace view displaying span execution latencies across staggered colored bars with caption "Distributed Tracing" | `observability-ops.archidrawlib` |
| `sd-observability-ops-alerting` | An alert siren megaphone bell sounding an emergency badge "!" with caption "Alerting" | `observability-ops.archidrawlib` |

### Platform & Integrations (`platform-integrations.archidrawlib`)

| componentId | Descrição visual | <slug>.archidrawlib |
|---|---|---|
| `sd-platform-integrations-git-repository` | A version control Git commit tree with branching lines, commit nodes, and a merge point with caption "Git Repository" | `platform-integrations.archidrawlib` |
| `sd-platform-integrations-ci-cd-pipeline` | Three sequential chevron stages labeled "build", "test", "deploy" with caption "CI-CD Pipeline" | `platform-integrations.archidrawlib` |
| `sd-platform-integrations-container-registry` | A warehouse rack shelving unit holding multiple container image blocks with caption "Container Registry" | `platform-integrations.archidrawlib` |
| `sd-platform-integrations-ai-model` | A neural network processor block showing interconnected deep learning nodes with caption "AI Model" | `platform-integrations.archidrawlib` |
| `sd-platform-integrations-ai-agent` | An intelligent agent robot persona with sensor antennas and processor eye with caption "AI Agent" | `platform-integrations.archidrawlib` |
| `sd-platform-integrations-external-system` | A third-party integration block labeled "3rd party" with a communication arrow with caption "External System" | `platform-integrations.archidrawlib` |
| `sd-platform-integrations-email-service` | A folded postal letter envelope with crease lines with caption "Email Service" | `platform-integrations.archidrawlib` |
| `sd-platform-integrations-payment-gateway` | A point-of-sale card terminal processing a payment credit card with caption "Payment Gateway" | `platform-integrations.archidrawlib` |

---

## 3. Atalho de Conveniência para Área de Transferência (Ctrl+V Interativo)

Para conveniência de usuários humanos colando trechos rápidos de JSON diretamente na tela aberta do navegador, o mecanismo de paste (Ctrl+V) aceita um nó sintético do tipo:

```json
{
  "type": "component",
  "componentId": "sd-data-storage-relational-db",
  "x": 300,
  "y": 200,
  "label": "Users DB"
}
```

Ao colar via Ctrl+V no canvas interativo, a aplicação desempacota o item em tempo de execução. **Lembre-se:** Esse atalho existe apenas para colagem interativa na UI; ao gerar ou salvar arquivos `.archidraw` programaticamente, execute o algoritmo da Seção 1 para que o arquivo persista os elementos vetoriais reais.
