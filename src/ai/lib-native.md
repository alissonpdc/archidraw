# System Design Native Components (`lib-native.md`)

This document explains how to use ArchiDraw's native System Design components in diagrams and how to unpack their vector elements straight from the `.archidrawlib` files.

> [!IMPORTANT]
> **Critical Distinction: SVG Icons vs System Design Blocks (`sd-*`)**
> - **SVG icons (`aws-*`, `k8s-*`, `gcp-*`, `azure-*`)**: these are atomic icons. Using `type: "component"` is the **official, permanent format** both in `.archidraw` files and in the clipboard (see [`/ai/lib-svg.md`](/ai/lib-svg.md)). They must **not** be unpacked.
> - **System Design blocks (prefix `sd-*`)**: already finished and drawn! **NEVER try to recreate or draw these shapes manually.** In `.archidraw` (workspace) files, native components (`sd-*`) **must be fetched via `GET /ai/lib/<slug>.archidrawlib`**, copying the ready-made `item.archidrawElements` array directly and only applying the offset to the target `(x, y)` coordinate. Do not use `type: "component"` for `sd-*` items in workspace files (the `window.archidrawValidate` validator will emit a warning).

---

## 1. How to Fetch and Unpack Items into a `.archidraw` File (Step by Step)

**WARNING: Do not invent or attempt to draw the vector shapes.** All 68 architecture blocks are already finished and packaged in the 8 official libraries. The agent only needs to download the library and copy the elements:

### Extraction and Insertion Algorithm

1. **Identify the Item and the Library**: See the Section 2 table to locate the desired `componentId` and its `<slug>.archidrawlib` file (e.g. `sd-data-storage-relational-db` lives in `data-storage.archidrawlib`).
2. **Fetch the Library File**: Issue an HTTP `GET /ai/lib/<slug>.archidrawlib` request.
3. **Locate the Item**: In the returned JSON, look up `libraryItems` for the item whose `id` equals the `componentId` (`item.id === "sd-data-storage-relational-db"`).
4. **Extract `archidrawElements`**: Copy the template element array held in `item.archidrawElements`.
5. **Compute the Position Offset (`dx, dy`)**:
   - Compute the template origin: `minX = Math.min(...elements.map(e => e.x))`, `minY = Math.min(...elements.map(e => e.y))`.
   - Determine the offset to the desired target coordinate `(targetX, targetY)` in the diagram:
     `dx = targetX - minX`, `dy = targetY - minY`.
6. **Generate Group and Unique IDs**:
   - Create a shared group identifier: `const groupId = "grp_" + Math.random().toString(36).slice(2, 9);`.
   - Assign fresh unique ids to every shape (`el_<base36>_<counter>`) and set `groupId: groupId` on all of them.
7. **Apply the Offset**: For each element, update `x = el.x + dx` and `y = el.y + dy`.
8. **Update the Custom Label (optional)**: If you want a custom name (e.g. `"Users DB"` instead of the default `"Relational DB"`), find the `text` element whose `text` matches `item.name` and change it to your label.
9. **Insert into the Workspace**: Add the unpacked element set directly to the `tabs[0].doc.elements` array of the `.archidraw` file.

---

### Comparative Example: Wrong vs Right in the `.archidraw`

#### ❌ WRONG in the `.archidraw` (triggers a validator warning):

```json
{
  "type": "component",
  "componentId": "sd-data-storage-relational-db",
  "x": 300,
  "y": 200,
  "label": "Users DB"
}
```

#### ✅ RIGHT in the `.archidraw` (vector elements unpacked and grouped):

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

## 2. Native Component Catalog & `.archidrawlib` Files

Below are all available items organized by category. To get the exact vectors of any item, fetch:

```http
GET /ai/lib/<slug>.archidrawlib
```

### Clients & Devices (`clients-devices.archidrawlib`)

| componentId | Visual description | <slug>.archidrawlib |
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

| componentId | Visual description | <slug>.archidrawlib |
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

| componentId | Visual description | <slug>.archidrawlib |
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

| componentId | Visual description | <slug>.archidrawlib |
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

| componentId | Visual description | <slug>.archidrawlib |
|---|---|---|
| `sd-messaging-events-message-queue` | A horizontal pipe queue containing three partitioned message packets with an entry arrow with caption "Message Queue" | `messaging-events.archidrawlib` |
| `sd-messaging-events-pub-sub-topic` | A central broadcast block labeled "Topic" emitting divergent fanned-out arrows with caption "Pub-Sub Topic" | `messaging-events.archidrawlib` |
| `sd-messaging-events-event` | A message payload card labeled with JSON data "{ json }" with caption "Event" | `messaging-events.archidrawlib` |
| `sd-messaging-events-stream-processor` | A continuous stream pipeline dividing events across parallel worker boxes "W1", "W2", "W3" with caption "Stream Processor" | `messaging-events.archidrawlib` |
| `sd-messaging-events-dead-letter-queue` | A quarantine queue holding a failed message "FAIL" with an alert badge "!" with caption "Dead Letter Queue" | `messaging-events.archidrawlib` |
| `sd-messaging-events-webhook-dispatcher` | An event dispatcher sending an HTTP "POST" arrow from an event block with caption "Webhook Dispatcher" | `messaging-events.archidrawlib` |
| `sd-messaging-events-data-pipeline` | A multi-stage processing pipeline connected by sequential flow arrows with caption "Data Pipeline" | `messaging-events.archidrawlib` |

### Security & Identity (`security-identity.archidrawlib`)

| componentId | Visual description | <slug>.archidrawlib |
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

| componentId | Visual description | <slug>.archidrawlib |
|---|---|---|
| `sd-observability-ops-monitoring` | A dashboard monitor display with telemetry gauge dials and status bars with caption "Monitoring" | `observability-ops.archidrawlib` |
| `sd-observability-ops-logs` | A log stream sheet with sequential text lines and a highlighted red error line with caption "Logs" | `observability-ops.archidrawlib` |
| `sd-observability-ops-metrics` | A telemetry panel displaying a multi-bar histogram chart with caption "Metrics" | `observability-ops.archidrawlib` |
| `sd-observability-ops-distributed-tracing` | A waterfall trace view displaying span execution latencies across staggered colored bars with caption "Distributed Tracing" | `observability-ops.archidrawlib` |
| `sd-observability-ops-alerting` | An alert siren megaphone bell sounding an emergency badge "!" with caption "Alerting" | `observability-ops.archidrawlib` |

### Platform & Integrations (`platform-integrations.archidrawlib`)

| componentId | Visual description | <slug>.archidrawlib |
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

## 3. Convenience Shortcut for the Clipboard (Interactive Ctrl+V)

For the convenience of human users pasting quick JSON snippets directly onto the open browser page, the paste mechanism (Ctrl+V) accepts a synthetic node of the type:

```json
{
  "type": "component",
  "componentId": "sd-data-storage-relational-db",
  "x": 300,
  "y": 200,
  "label": "Users DB"
}
```

Pasting via Ctrl+V on the interactive canvas unpacks the item at runtime. **Remember:** this shortcut exists only for interactive UI pasting; when generating or saving `.archidraw` files programmatically, run the Section 1 algorithm so the file persists the real vector elements.
