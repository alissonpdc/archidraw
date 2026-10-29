## 3.2 (cont.) Color Palette & 3.7 Component Catalog

**Color note.** The canvas only draws a color exactly as written when it belongs to the app palette below; any other color is stepped in lightness until it reaches a 3:1 contrast ratio against the canvas background, so an off-palette pastel such as `#ffe8cc` lands visibly darker on a white canvas, and an off-palette near-black is lightened on a dark one. The SVG export and the library tile thumbnails do **not** clamp: they keep the color as written. A generated library that uses off-palette pastels therefore shows pale pastel tiles and much darker elements once inserted on the canvas. Here is the whole palette, one row per hue, lightest shade first:

| Hue | Lightest | Lighter | Base | Darker | Darkest |
|---|---|---|---|---|---|
| Grey | #dfe0e2 | #b3b8bc | #868e96 | #545c63 | #26292c |
| Red | #edd4d4 | #de8c8c | #e03131 | #9b1717 | #470b0b |
| Pink | #ecd5dd | #d98ca7 | #d6336c | #901d45 | #440e21 |
| Grape | #e6d7ea | #c692d3 | #ae3ec9 | #752687 | #371240 |
| Purple | #dbd5ec | #a694db | #6741d9 | #3d1f99 | #1b0e44 |
| Indigo | #d1d7ef | #94a6ea | #4c6ef5 | #0b2ebc | #04134d |
| Blue | #d3e1ed | #72a8d9 | #1971c2 | #114c83 | #092a48 |
| Cyan | #d4e9ec | #81ced9 | #22b8cf | #177d8c | #0c3e46 |
| Teal | #d4ede5 | #7dd9be | #20c997 | #168866 | #0b4635 |
| Green | #d7eadb | #7ec88c | #2f9e44 | #216e2f | #133f1b |
| Lime | #e3ecd5 | #bbda8b | #94d82d | #63921b | #2f450d |
| Yellow | #f0e9d1 | #e7d07e | #f5c518 | #a68407 | #4e3e03 |
| Orange | #f1e3d0 | #ebb870 | #f08c00 | #a35f00 | #523000 |
| Coral | #f0ddd0 | #e8a578 | #f76707 | #a44405 | #4f2102 |
| Brown | #e8ddd9 | #c69d8b | #a65e3f | #6f3f2a | #3b2116 |

The two lightest columns carry fills, the three darkest columns carry strokes; a color from another hue's row is fine, a color outside the table is not. Four values are special-cased instead of clamped: `transparent`, `#c4c7ca` (the context-boundary stroke, drawn `#3b3835` on dark canvases) and the two sentinels of the default columns above — `#3d4248` is *replaced* by the active theme stroke (near-black `#26292c` on light canvases) and `#dfe0e2` by the theme fill (near-black on dark canvases). The sentinels therefore follow the theme instead of the tile: a shape stroked `#3d4248` shows the theme colour on the canvas, while the tile thumbnail and the SVG export keep the literal `#3d4248`. Use them for documents, which the app itself writes with them; for a library tile that must match the canvas, take an explicit colour from the table.

#### Recommended Native UI Presets & Semantic Color Pairings for Architecture Diagrams

In the Properties Panel color picker, the 5 columns above correspond to **Intensity 1..5** (`Lightest` = 1, `Lighter` = 2, `Base` = 3, `Darker` = 4, `Darkest` = 5), and **`textColor: ""`** selects the native **`Auto`** button (inheriting `strokeColor` and automatically adapting to light/dark themes). Every row below uses **100% native UI presets** (`fontSize` in `{14, 20, 28, 36}` + `12`, `strokeWidth` in `{0, 1, 2, 4, 8}`, palette hexes, and `animated: true` only on non-solid strokes):

| Architectural Role | `strokeColor` (Intensity 4/5) | `backgroundColor` (Intensity 1) | `textColor` (`Auto` or Intensity 5) | `strokeWidth` & `borderRadius` | `fontSize` & `width × height` | `strokeStyle` & `animated` |
|---|---|---|---|---|---|---|
| Sync API / Core Microservice (`rectangle`) | `"#114c83"` (Blue · 4) | `"#d3e1ed"` (Blue · 1) | `""` (`Auto`) or `"#092a48"` | `strokeWidth: 2, borderRadius: 8` | `fontSize: 14` (`S`), `240 × 90` | `"solid", animated: false` |
| Async Worker / Event Consumer (`rectangle`) | `"#a35f00"` (Orange · 4) | `"#f1e3d0"` (Orange · 1) | `""` (`Auto`) or `"#523000"` | `strokeWidth: 2, borderRadius: 8` | `fontSize: 14` (`S`), `240 × 90` | `"dashed"` (or `"solid"`), `animated: false` |
| Sync Request Flow (`arrow`) | `"#114c83"` (Blue · 4) | `"transparent"` | `""` (`Auto`) | `strokeWidth: 2, borderRadius: 0` | `fontSize: 14` (`S`), `label <= 14 chars` | `"solid", animated: false` |
| Async Event / Stream Flow (`arrow`) | `"#a35f00"` (Orange · 4) | `"transparent"` | `""` (`Auto`) | `strokeWidth: 2, borderRadius: 0` | `fontSize: 14` (`S`), `label <= 14 chars` | `"dashed", animated: true` |
| Data Store / Replication Flow (`arrow`) | `"#216e2f"` (Green · 4) | `"transparent"` | `""` (`Auto`) | `strokeWidth: 2, borderRadius: 0` | `fontSize: 14` (`S`), `label <= 14 chars` | `"dotted", animated: true` |
| Security / Auth Flow (`arrow` / `rectangle`) | `"#3d1f99"` (Purple · 4) | `"#dbd5ec"` (Purple · 1) | `""` (`Auto`) or `"#1b0e44"` | `strokeWidth: 1` (or `2`) | `fontSize: 14` (`S`) | `"dashed", animated: false` |
| Dead-Letter Queue / Error / Alert (`arrow`) | `"#9b1717"` (Red · 4) | `"#edd4d4"` (Red · 1) | `""` (`Auto`) or `"#470b0b"` | `strokeWidth: 2, borderRadius: 0` | `fontSize: 14` (`S`), `label <= 14 chars` | `"dashed", animated: false` |
| Context Boundary (`context`) | `"#c4c7ca"` (Context sentinel) | `"transparent"` (or Intensity 1) | `"#26292c"` (Grey · 5) | `strokeWidth: 1, borderRadius: 10` | `fontSize: 14` (`S`) | `"solid"` (or `"dashed"`) |

### 3.7 Component catalog

`component` is the element that paints one of the app's built-in architecture icons, and it is the right element whenever a figure has a well-known logo: a cloud service, a Kubernetes object. The icon is looked up by `componentId` and drawn as a square of `min(width, height)` centred in the box, so a square box keeps the icon at full size — and an icon drawn at full size covers the whole box, fill included, which is why a tinted card only shows its fill when the box is larger than the icon on at least one axis. The box itself only paints if you ask it to: to get the icon and nothing else, copy what the panel inserts — `strokeWidth: 0` and `fillOpacity: 0` — and put the name in `label`, drawn outside the icon on the `captionPosition` side (section 3.6). Give the box a visible outline or fill only when the icon should sit inside a container.

#### Canonical `component` Element Template

- Dimensions: `width: 60, height: 60` (or `64 × 64`)
- Invisible bounding box (native UI defaults): `strokeWidth: 0, fillOpacity: 0, backgroundColor: "transparent", borderRadius: 20, fill: false`
- Caption outside icon: `label: "<Service Name>", captionPosition: "bottom", captionGap: 4, fontSize: 12` (or `"fontSize": 14` `S`), `textColor: ""` (`Auto`)

The whole catalog, each id with its official bundled icon:

| `componentId` | Renders as | Category |
|---|---|---|
| `aws-ec2` | EC2 | Compute |
| `aws-lambda` | Lambda | Compute |
| `aws-ecs` | ECS | Compute |
| `aws-eks` | EKS | Compute |
| `aws-api-gateway` | API Gateway | Network |
| `aws-elb` | Load Balancer | Network |
| `aws-route53` | Route 53 | Network |
| `aws-cloudfront` | CloudFront | Network |
| `aws-vpc` | VPC | Network |
| `aws-dynamodb` | DynamoDB | Database |
| `aws-rds` | RDS | Database |
| `aws-elasticache` | ElastiCache | Database |
| `aws-s3` | S3 | Storage |
| `aws-sqs` | SQS | Messaging |
| `aws-sns` | SNS | Messaging |
| `aws-eventbridge` | EventBridge | Messaging |
| `aws-step-functions` | Step Functions | Messaging |
| `aws-kinesis` | Kinesis | Messaging |
| `aws-cognito` | Cognito | Security |
| `aws-iam` | IAM | Security |
| `aws-cloudwatch` | CloudWatch | Monitoring |
| `gcp-compute-engine` | Compute Engine | Compute |
| `gcp-cloud-run` | Cloud Run | Compute |
| `gcp-gke` | GKE | Compute |
| `gcp-cloud-functions` | Cloud Functions | Compute |
| `gcp-vpc` | VPC | Network |
| `gcp-bigquery` | BigQuery | Database |
| `gcp-spanner` | Cloud Spanner | Database |
| `gcp-cloud-storage` | Cloud Storage | Storage |
| `gcp-pubsub` | Pub/Sub | Messaging |
| `gcp-cloud-armor` | Cloud Armor | Security |
| `azure-vm` | Virtual Machines | Compute |
| `azure-app-service` | App Service | Compute |
| `azure-aks` | AKS | Compute |
| `azure-functions` | Azure Functions | Compute |
| `azure-vnet` | Virtual Network | Network |
| `azure-cosmos-db` | Cosmos DB | Database |
| `azure-sql` | Azure SQL | Database |
| `azure-blob-storage` | Blob Storage | Storage |
| `azure-service-bus` | Service Bus | Messaging |
| `azure-event-grid` | Event Grid | Messaging |
| `k8s-pod` | Pod | Compute |
| `k8s-deployment` | Deployment | Compute |
| `k8s-statefulset` | StatefulSet | Compute |
| `k8s-daemonset` | DaemonSet | Compute |
| `k8s-job` | Job | Compute |
| `k8s-cronjob` | CronJob | Compute |
| `k8s-replicaset` | ReplicaSet | Compute |
| `k8s-service` | Service | Networking |
| `k8s-ingress` | Ingress | Networking |
| `k8s-networkpolicy` | NetworkPolicy | Networking |
| `k8s-endpoint` | Endpoint | Networking |
| `k8s-persistentvolume` | PersistentVolume | Storage |
| `k8s-persistentvolumeclaim` | PersistentVolumeClaim | Storage |
| `k8s-storageclass` | StorageClass | Storage |
| `k8s-configmap` | ConfigMap | Config |
| `k8s-secret` | Secret | Config |
| `k8s-namespace` | Namespace | Cluster |
| `k8s-node` | Node | Cluster |
| `k8s-rbac` | RBAC | Cluster |
| `k8s-serviceaccount` | ServiceAccount | Cluster |
| `k8s-hpa` | HorizontalPodAutoscaler | Cluster |

An id outside this table is still a valid element: it draws a generic placeholder icon with a short caption of the id, which is what a pasted or generated diagram gets for a logo the app does not know. `fill: true` is for raster assets only (`src`, section 3.3): it stretches the image over the whole box instead of squaring it in the middle, and it is ignored for a catalog id.

### 3.7.1 System Design Native Components (Auto-expanding items)

While the cloud icons in section 3.7 render official vector logos inside a single `component` box, the **System Design** catalog items below represent generic architecture building blocks (databases, queues, caches, servers, actors). When pasted or imported as a `component` with an `sd-` prefix, Archidraw automatically expands the element into its underlying **native editable elements** (`polygon`, `rectangle`, `ellipse`, `line`, `text`) joined in a shared `groupId`.

To place one, emit a `component` with the target `sd-*` id:

```json
{
  "type": "component",
  "componentId": "sd-data-storage-relational-db",
  "x": 300,
  "y": 200,
  "label": "Users DB"
}
```

- **Coordinates (`x`, `y`):** Sets the top-left origin for the expanded native element group.
- **Label (`label`):** Replaces the component's default caption (e.g. replacing `"Relational DB"` with `"Users DB"`).
- **Bindings:** Arrows bound to the component's `id` automatically rebind to the primary shape of the expanded native group and have their endpoints automatically snapped to its anchor points.
- **Stroke Style (`roughness: 1`):** All native library items default to `"roughness": 1` (`Draft` hand-drawn style). Author surrounding shapes, contexts, and arrows with `"roughness": 1` to match the native library style seamlessly.
- **Background & Fill (`backgroundColor: "transparent"`, `fillOpacity: 0`):** Native library items carry their own individual element shapes, fills, and colors (or transparent backgrounds). Always author components with `"backgroundColor": "transparent"`, `"fillOpacity": 0`, and `"strokeWidth": 0` (or omit fill), so no artificial gray bounding card/tile is drawn behind the native elements.

| `componentId` | Name | Category | Description |
|---|---|---|---|
| `sd-clients-devices-user` | User | Clients & Devices | A green person silhouette with an ellipse head and curved torso with caption "User" |
| `sd-clients-devices-users` | Users | Clients & Devices | A group of three people silhouettes (two grey in background, one blue in front) with caption "Users" |
| `sd-clients-devices-developer` | Developer | Clients & Devices | A blue person silhouette holding a display screen labeled "</>" with caption "Developer" |
| `sd-clients-devices-admin` | Admin | Clients & Devices | A teal person silhouette holding a terminal console labeled ">_ admin" with caption "Admin" |
| `sd-clients-devices-mobile-app` | Mobile App | Clients & Devices | A smartphone frame enclosing four colorful app tiles (blue, green, orange, purple) with caption "Mobile App" |
| `sd-clients-devices-web-browser` | Web Browser | Clients & Devices | A cyan browser window with three traffic-light dots and an address bar with caption "Web Browser" |
| `sd-clients-devices-browser` | Browser | Clients & Devices | A desktop browser window with colored top buttons and navigation bar with caption "Browser" |
| `sd-clients-devices-smartphone` | Smartphone | Clients & Devices | A vertical mobile phone frame with screen and home indicator with caption "Smartphone" |
| `sd-clients-devices-tablet` | Tablet | Clients & Devices | A tablet device frame displaying article text columns with caption "Tablet" |
| `sd-clients-devices-web-search` | Web Search | Clients & Devices | A browser window displaying a search engine interface with search bar with caption "Web Search" |
| `sd-clients-devices-iot-device` | IoT Device | Clients & Devices | A microchip circuit package labeled "IoT" with connecting side pin leads with caption "IoT Device" |
| `sd-infra-network-internet` | Internet | Infrastructure & Network | A blue cloud shape labeled "www" with caption "Internet" |
| `sd-infra-network-dns` | DNS | Infrastructure & Network | A blue network globe sphere labeled "DNS" with an orbital line with caption "DNS" |
| `sd-infra-network-cdn` | CDN | Infrastructure & Network | A central cyan node labeled "EDGE" connected to four distributed edge nodes with caption "CDN" |
| `sd-infra-network-load-balancer` | Load Balancer | Infrastructure & Network | A blue distributor box splitting an incoming line into four directional arrows with caption "Load Balancer" |
| `sd-infra-network-api-gateway` | API Gateway | Infrastructure & Network | A purple gateway container routing requests through directional arrows with caption "API Gateway" |
| `sd-infra-network-reverse-proxy` | Reverse Proxy | Infrastructure & Network | A blue server container labeled "proxy" intercepting bidirectional arrows with caption "Reverse Proxy" |
| `sd-infra-network-nat-gateway` | NAT Gateway | Infrastructure & Network | A blue network translator box labeled "NAT" with directional routing arrows with caption "NAT Gateway" |
| `sd-infra-network-vpn-tunnel` | VPN Tunnel | Infrastructure & Network | A cyan cylindrical conduit tunnel enclosing secure network packets with caption "VPN Tunnel" |
| `sd-infra-network-websocket-gateway` | WebSocket Gateway | Infrastructure & Network | A gateway block labeled "WSS ://" with bidirectional real-time communication arrows with caption "WebSocket Gateway" |
| `sd-compute-services-server` | Server | Compute & Services | A server rack enclosure with horizontal trays and status indicator lights with caption "Server" |
| `sd-compute-services-virtual-machine` | Virtual Machine | Compute & Services | A computer box enclosing an internal virtual slice labeled "VM" with caption "Virtual Machine" |
| `sd-compute-services-container` | Container | Compute & Services | A shipping container box with vertical corrugated slats with caption "Container" |
| `sd-compute-services-microservice` | Microservice | Compute & Services | A hexagonal microservice node labeled "μS" with caption "Microservice" |
| `sd-compute-services-serverless-function` | Serverless Function | Compute & Services | A hexagonal serverless badge labeled with lambda symbol "λ" with caption "Serverless Function" |
| `sd-compute-services-api` | API | Compute & Services | A hexagonal interface node labeled "API" with caption "API" |
| `sd-compute-services-worker-pool` | Worker Pool | Compute & Services | A Master coordinator node connected via bus lines to three worker boxes labeled "W-1", "W-2", "W-3" with caption "Worker Pool" |
| `sd-compute-services-scheduler` | Scheduler | Compute & Services | A clock face with hour marks and scheduling hands with caption "Scheduler" |
| `sd-compute-services-batch-job` | Batch Job | Compute & Services | A stack of three layered rectangular job sheets with data lines with caption "Batch Job" |
| `sd-compute-services-service-mesh` | Service Mesh | Compute & Services | A service block pairing an "App" container with an attached sidecar "Proxy" container with caption "Service Mesh" |
| `sd-compute-services-rate-limiter` | Rate Limiter | Compute & Services | A funnel-shaped nozzle throttling circular traffic tokens into a single flow arrow with caption "Rate Limiter" |
| `sd-compute-services-circuit-breaker` | Circuit Breaker | Compute & Services | An electrical circuit diagram showing an open switch contact lever between terminals with caption "Circuit Breaker" |
| `sd-compute-services-distributed-lock` | Distributed Lock | Compute & Services | A padlock with shackle securing an underlying resource block with caption "Distributed Lock" |
| `sd-compute-services-service-registry` | Service Registry | Compute & Services | A catalog cabinet with discovery index drawers and status lights with caption "Service Registry" |
| `sd-data-storage-relational-db` | Relational DB | Data & Storage | A blue cylinder with label "SQL" with caption "Relational DB" |
| `sd-data-storage-database-cluster` | Database Cluster | Data & Storage | A primary database cylinder labeled "Writer" replicating via arrow to a replica cylinder labeled "Reader" with caption "Database Cluster" |
| `sd-data-storage-document-db` | Document DB | Data & Storage | An orange cylinder labeled "{ }" with caption "Document DB" |
| `sd-data-storage-key-value-store` | Key-Value Store | Data & Storage | An indexed hash table with pairs of "K" and "V" slot blocks with caption "Key-Value Store" |
| `sd-data-storage-in-memory-cache` | In-Memory Cache | Data & Storage | A rounded cache block with a lightning bolt badge and memory slots with caption "In-Memory Cache" |
| `sd-data-storage-object-storage` | Object Storage | Data & Storage | A bucket cylinder with an open top rim and drop handle with caption "Object Storage" |
| `sd-data-storage-blob-storage` | Blob Storage | Data & Storage | A binary file block labeled "0101" with caption "Blob Storage" |
| `sd-data-storage-file-storage` | File Storage | Data & Storage | A file folder icon containing nested filesystem documents with caption "File Storage" |
| `sd-data-storage-data-lake` | Data Lake | Data & Storage | A deep multi-tier data reservoir structure with wave layer lines with caption "Data Lake" |
| `sd-data-storage-data-warehouse` | Data Warehouse | Data & Storage | A warehouse structure containing schema tables labeled "DIM", "FACT", "AGG" with caption "Data Warehouse" |
| `sd-data-storage-graph-db` | Graph DB | Data & Storage | A database cylinder connected to a network of graph nodes and vertex lines with caption "Graph DB" |
| `sd-data-storage-time-series-db` | Time-Series DB | Data & Storage | A database cylinder displaying a fluctuating metric line chart on its front face with caption "Time-Series DB" |
| `sd-data-storage-vector-database` | Vector Database | Data & Storage | A database cylinder overlaid with three-dimensional vector coordinate axes with caption "Vector Database" |
| `sd-data-storage-search-engine` | Search Engine | Data & Storage | A document index catalog with a magnifying glass lens with caption "Search Engine" |
| `sd-messaging-events-message-queue` | Message Queue | Messaging & Events | A horizontal pipe queue containing three partitioned message packets with an entry arrow with caption "Message Queue" |
| `sd-messaging-events-pub-sub-topic` | Pub-Sub Topic | Messaging & Events | A central broadcast block labeled "Topic" emitting divergent fanned-out arrows with caption "Pub-Sub Topic" |
| `sd-messaging-events-event` | Event | Messaging & Events | A message payload card labeled with JSON data "{ json }" with caption "Event" |
| `sd-messaging-events-stream-processor` | Stream Processor | Messaging & Events | A continuous stream pipeline dividing events across parallel worker boxes "W1", "W2", "W3" with caption "Stream Processor" |
| `sd-messaging-events-dead-letter-queue` | Dead Letter Queue | Messaging & Events | A quarantine queue holding a failed message "FAIL" with an alert badge "!" with caption "Dead Letter Queue" |
| `sd-messaging-events-webhook-dispatcher` | Webhook Dispatcher | Messaging & Events | An event dispatcher sending an HTTP "POST" arrow from an event block with caption "Webhook Dispatcher" |
| `sd-messaging-events-data-pipeline` | Data Pipeline | Messaging & Events | A multi-stage processing pipeline connected by sequential flow arrows with caption "Data Pipeline" |
| `sd-security-identity-identity-provider` | Identity Provider | Security & Identity | A directory console frame displaying a user profile silhouette with caption "Identity Provider" |
| `sd-security-identity-auth` | Auth | Security & Identity | A security shield overlaid with a circular keyhole badge with caption "Auth" |
| `sd-security-identity-access-token-jwt` | Access Token (JWT) | Security & Identity | An encoded JWT token bar divided into three colored segments labeled "H", "P", "S" with caption "Access Token (JWT)" |
| `sd-security-identity-secrets-vault` | Secrets Vault | Security & Identity | A bank vault safe door with combination dial and security bolts with caption "Secrets Vault" |
| `sd-security-identity-key-management` | Key Management | Security & Identity | A key generation block paired with cryptographic encryption keys with caption "Key Management" |
| `sd-security-identity-tls-certificate` | TLS Certificate | Security & Identity | A digital certificate document stamped with a security padlock seal with caption "TLS Certificate" |
| `sd-security-identity-firewall` | Firewall | Security & Identity | A protective red brick wall barrier with caption "Firewall" |
| `sd-security-identity-waf` | WAF | Security & Identity | A security shield labeled "WAF" with caption "WAF" |
| `sd-security-identity-ddos-protection` | DDoS Protection | Security & Identity | A defensive shield deflecting multiple incoming attack vector lines with caption "DDoS Protection" |
| `sd-observability-ops-monitoring` | Monitoring | Observability & Operations | A dashboard monitor display with telemetry gauge dials and status bars with caption "Monitoring" |
| `sd-observability-ops-logs` | Logs | Observability & Operations | A log stream sheet with sequential text lines and a highlighted red error line with caption "Logs" |
| `sd-observability-ops-metrics` | Metrics | Observability & Operations | A telemetry panel displaying a multi-bar histogram chart with caption "Metrics" |
| `sd-observability-ops-distributed-tracing` | Distributed Tracing | Observability & Operations | A waterfall trace view displaying span execution latencies across staggered colored bars with caption "Distributed Tracing" |
| `sd-observability-ops-alerting` | Alerting | Observability & Operations | An alert siren megaphone bell sounding an emergency badge "!" with caption "Alerting" |
| `sd-platform-integrations-git-repository` | Git Repository | Platform & Integrations | A version control Git commit tree with branching lines, commit nodes, and a merge point with caption "Git Repository" |
| `sd-platform-integrations-ci-cd-pipeline` | CI-CD Pipeline | Platform & Integrations | Three sequential chevron stages labeled "build", "test", "deploy" with caption "CI-CD Pipeline" |
| `sd-platform-integrations-container-registry` | Container Registry | Platform & Integrations | A warehouse rack shelving unit holding multiple container image blocks with caption "Container Registry" |
| `sd-platform-integrations-ai-model` | AI Model | Platform & Integrations | A neural network processor block showing interconnected deep learning nodes with caption "AI Model" |
| `sd-platform-integrations-ai-agent` | AI Agent | Platform & Integrations | An intelligent agent robot persona with sensor antennas and processor eye with caption "AI Agent" |
| `sd-platform-integrations-external-system` | External System | Platform & Integrations | A third-party integration block labeled "3rd party" with a communication arrow with caption "External System" |
| `sd-platform-integrations-email-service` | Email Service | Platform & Integrations | A folded postal letter envelope with crease lines with caption "Email Service" |
| `sd-platform-integrations-payment-gateway` | Payment Gateway | Platform & Integrations | A point-of-sale card terminal processing a payment credit card with caption "Payment Gateway" |
