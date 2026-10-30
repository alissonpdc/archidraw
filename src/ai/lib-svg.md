# SVG Cloud & Kubernetes Icon Components (`lib-svg.md`)

This document explains how to use bundled SVG architecture icons (AWS, GCP, Azure, and Kubernetes) in Archidraw diagrams.

### 3.7 Component catalog

`component` is the element that paints one of the app's built-in architecture icons, and it is the right element whenever a figure has a well-known logo: a cloud service, a Kubernetes object. The icon is looked up by `componentId` and drawn as a square of `min(width, height)` centred in the box, so a square box keeps the icon at full size — and an icon drawn at full size covers the whole box, fill included, which is why a tinted card only shows its fill when the box is larger than the icon on at least one axis. The box itself only paints if you ask it to: to get the icon and nothing else, copy what the panel inserts — `strokeWidth: 0` and `fillOpacity: 0` — and put the name in `label`, drawn outside the icon on the `captionPosition` side. Give the box a visible outline or fill only when the icon should sit inside a container.

#### Canonical `component` Element Template

To place an official bundled icon without an unwanted card outline:

```json
{
  "type": "component",
  "componentId": "aws-api-gateway",
  "x": 200,
  "y": 140,
  "width": 60,
  "height": 60,
  "strokeWidth": 0,
  "fillOpacity": 0,
  "backgroundColor": "transparent",
  "borderRadius": 20,
  "label": "API Gateway",
  "captionPosition": "bottom",
  "captionGap": 4,
  "fontSize": 12,
  "textColor": ""
}
```

- **Dimensions**: `width: 60, height: 60` or `64 × 64`.
- **Bounding Box**: `strokeWidth: 0, fillOpacity: 0, backgroundColor: "transparent", fill: false`.
- **Label / Caption**: Rendered outside the icon on the side specified by `captionPosition: "bottom"`.
- **Theme Adaptation**: `textColor: ""` (`Auto`) adapts automatically to light and dark canvases.

#### Complete Catalog of Bundled SVG Icons

The whole catalog, each id with its official bundled icon:

| `componentId` | Renders as | Category | Provider |
|---|---|---|---|
| `aws-ec2` | EC2 | Compute | AWS |
| `aws-lambda` | Lambda | Compute | AWS |
| `aws-ecs` | ECS | Compute | AWS |
| `aws-eks` | EKS | Compute | AWS |
| `aws-api-gateway` | API Gateway | Network | AWS |
| `aws-elb` | Load Balancer | Network | AWS |
| `aws-route53` | Route 53 | Network | AWS |
| `aws-cloudfront` | CloudFront | Network | AWS |
| `aws-vpc` | VPC | Network | AWS |
| `aws-dynamodb` | DynamoDB | Database | AWS |
| `aws-rds` | RDS | Database | AWS |
| `aws-elasticache` | ElastiCache | Database | AWS |
| `aws-s3` | S3 | Storage | AWS |
| `aws-sqs` | SQS | Messaging | AWS |
| `aws-sns` | SNS | Messaging | AWS |
| `aws-eventbridge` | EventBridge | Messaging | AWS |
| `aws-step-functions` | Step Functions | Messaging | AWS |
| `aws-kinesis` | Kinesis | Messaging | AWS |
| `aws-cognito` | Cognito | Security | AWS |
| `aws-iam` | IAM | Security | AWS |
| `aws-cloudwatch` | CloudWatch | Monitoring | AWS |
| `gcp-compute-engine` | Compute Engine | Compute | GCP |
| `gcp-cloud-run` | Cloud Run | Compute | GCP |
| `gcp-gke` | GKE | Compute | GCP |
| `gcp-cloud-functions` | Cloud Functions | Compute | GCP |
| `gcp-vpc` | VPC | Network | GCP |
| `gcp-bigquery` | BigQuery | Database | GCP |
| `gcp-spanner` | Cloud Spanner | Database | GCP |
| `gcp-cloud-storage` | Cloud Storage | Storage | GCP |
| `gcp-pubsub` | Pub/Sub | Messaging | GCP |
| `gcp-cloud-armor` | Cloud Armor | Security | GCP |
| `azure-vm` | Virtual Machines | Compute | Azure |
| `azure-app-service` | App Service | Compute | Azure |
| `azure-aks` | AKS | Compute | Azure |
| `azure-functions` | Azure Functions | Compute | Azure |
| `azure-vnet` | Virtual Network | Network | Azure |
| `azure-cosmos-db` | Cosmos DB | Database | Azure |
| `azure-sql` | Azure SQL | Database | Azure |
| `azure-blob-storage` | Blob Storage | Storage | Azure |
| `azure-service-bus` | Service Bus | Messaging | Azure |
| `azure-event-grid` | Event Grid | Messaging | Azure |
| `k8s-pod` | Pod | Compute | Kubernetes |
| `k8s-deployment` | Deployment | Compute | Kubernetes |
| `k8s-statefulset` | StatefulSet | Compute | Kubernetes |
| `k8s-daemonset` | DaemonSet | Compute | Kubernetes |
| `k8s-job` | Job | Compute | Kubernetes |
| `k8s-cronjob` | CronJob | Compute | Kubernetes |
| `k8s-replicaset` | ReplicaSet | Compute | Kubernetes |
| `k8s-service` | Service | Networking | Kubernetes |
| `k8s-ingress` | Ingress | Networking | Kubernetes |
| `k8s-networkpolicy` | NetworkPolicy | Networking | Kubernetes |
| `k8s-endpoint` | Endpoint | Networking | Kubernetes |
| `k8s-persistentvolume` | PersistentVolume | Storage | Kubernetes |
| `k8s-persistentvolumeclaim` | PersistentVolumeClaim | Storage | Kubernetes |
| `k8s-storageclass` | StorageClass | Storage | Kubernetes |
| `k8s-configmap` | ConfigMap | Config | Kubernetes |
| `k8s-secret` | Secret | Config | Kubernetes |
| `k8s-namespace` | Namespace | Cluster | Kubernetes |
| `k8s-node` | Node | Cluster | Kubernetes |
| `k8s-rbac` | RBAC | Cluster | Kubernetes |
| `k8s-serviceaccount` | ServiceAccount | Cluster | Kubernetes |
| `k8s-hpa` | HorizontalPodAutoscaler | Cluster | Kubernetes |

#### Fallback Behavior

An id outside this table is still a valid element: it draws a generic placeholder icon with a short caption of the id, which is what a pasted or generated diagram gets for a logo the app does not know. `fill: true` is for raster assets only (`src`), and is ignored for a catalog id.
