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
| `ec2` | EC2 | Compute |
| `lambda` | Lambda | Compute |
| `ecs` | ECS | Compute |
| `eks` | EKS | Compute |
| `api-gateway` | API Gateway | Network |
| `elb` | Load Balancer | Network |
| `route53` | Route 53 | Network |
| `cloudfront` | CloudFront | Network |
| `vpc` | VPC | Network |
| `dynamodb` | DynamoDB | Database |
| `rds` | RDS | Database |
| `elasticache` | ElastiCache | Database |
| `s3` | S3 | Storage |
| `sqs` | SQS | Messaging |
| `sns` | SNS | Messaging |
| `eventbridge` | EventBridge | Messaging |
| `step-functions` | Step Functions | Messaging |
| `kinesis` | Kinesis | Messaging |
| `cognito` | Cognito | Security |
| `iam` | IAM | Security |
| `cloudwatch` | CloudWatch | Monitoring |
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
