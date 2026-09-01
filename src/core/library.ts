/**
 * Architecture component catalog (AWS + Kubernetes).
 * Icons are SVG stroke-only paths in viewBox 24x24, drawn
 * on canvas (Path2D), in DOM (inline svg), and in SVG export.
 */

export interface LibraryItem {
  id: string;
  name: string;
  category: string;
  keywords: string[];
  /** subpaths (stroke-only) in viewBox 0 0 24 24 */
  icon?: string[];
  /** id da biblioteca importada de origem (arquivo .excalidrawlib) */
  group?: string;
  /** proporção largura/altura do ícone (bibliotecas importadas) */
  aspect?: number;
  /** asset (imagem raster) preenche o bounds inteiro do elemento em vez de
   *  um ícone quadrado centralizado — usado por imagens importadas/coladas */
  fill?: boolean;
  /** data URI do asset raster (imagens importadas/coladas). Embebido no
   *  elemento na inserção para que ele continue renderizando caso o item
   *  seja removido da biblioteca depois */
  src?: string;
}

export const LIBRARY_CATEGORIES = [
  "Compute",
  "Network",
  "Database",
  "Storage",
  "Messaging",
  "Security",
  "Monitoring",
] as const;

export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number];

const circle = (cx: number, cy: number, r: number) =>
  `M${cx + r} ${cy} A${r} ${r} 0 1 1 ${cx - r} ${cy} A${r} ${r} 0 1 1 ${cx + r} ${cy}`;

export const LIBRARY: LibraryItem[] = [
  // ---- Compute -------------------------------------------------------
  {
    id: "ec2",
    name: "EC2",
    category: "Compute",
    keywords: ["instance", "server", "vm", "compute"],
    icon: [
      "M7 7 H17 V17 H7 Z",
      "M10.5 10.5 H13.5 V13.5 H10.5 Z",
      "M9 4 V7 M12 4 V7 M15 4 V7",
      "M9 17 V20 M12 17 V20 M15 17 V20",
      "M4 9 H7 M4 12 H7 M4 15 H7",
      "M17 9 H20 M17 12 H20 M17 15 H20",
    ],
  },
  {
    id: "lambda",
    name: "Lambda",
    category: "Compute",
    keywords: ["serverless", "faas", "function", "lambda function"],
    icon: [
      "M14.5 4 C11 5.2 10.2 8 8.6 12.8 L6 20",
      "M10.3 9.3 C13 14 15.5 17.4 19 20",
    ],
  },
  {
    id: "ecs",
    name: "ECS",
    category: "Compute",
    keywords: ["container", "docker", "fargate"],
    icon: [
      "M5 8 L12 4 L19 8 V16 L12 20 L5 16 Z",
      "M8.8 10.2 H11 V13.8 H8.8 Z",
      "M13 10.2 H15.2 V13.8 H13 Z",
    ],
  },
  {
    id: "eks",
    name: "EKS",
    category: "Compute",
    keywords: ["kubernetes", "k8s", "orchestration", "cluster"],
    icon: [
      "M12 3 L19.8 7.5 V16.5 L12 21 L4.2 16.5 V7.5 Z",
      circle(12, 12, 3.4),
      "M12 8.6 V5 M14.9 13.7 L18 15.5 M9.1 13.7 L6 15.5",
    ],
  },

  // ---- Network & Delivery -----------------------------------------------------
  {
    id: "api-gateway",
    name: "API Gateway",
    category: "Network",
    keywords: ["api", "gateway", "rest", "endpoint"],
    icon: [
      "M8 5 L3 12 L8 19",
      "M16 5 L21 12 L16 19",
      circle(12, 12, 1.8),
    ],
  },
  {
    id: "elb",
    name: "Load Balancer",
    category: "Network",
    keywords: ["elb", "alb", "nlb", "load balancer", "balancer"],
    icon: [
      circle(6.5, 12, 2.6),
      "M9 10.5 L19 5.5 M9 12 H19 M9 13.5 L19 18.5",
      circle(20.2, 5, 1.3),
      circle(20.2, 12, 1.3),
      circle(20.2, 19, 1.3),
    ],
  },
  {
    id: "route53",
    name: "Route 53",
    category: "Network",
    keywords: ["dns", "route", "domain", "route53"],
    icon: [circle(12, 12, 8), "M4 12 H20", "M12 4 C15 7 15 17 12 20 C9 17 9 7 12 4 Z"],
  },
  {
    id: "cloudfront",
    name: "CloudFront",
    category: "Network",
    keywords: ["cdn", "edge", "edge cache"],
    icon: [
      circle(12, 12, 5.5),
      "M3.5 10 A 9 9 0 0 1 9 3.8 M20.5 14 A 9 9 0 0 1 15 20.2",
      "M3.5 10 L2.5 7.5 M3.5 10 L6 10.5 M20.5 14 L21.5 16.5 M20.5 14 L18 13.5",
    ],
  },
  {
    id: "vpc",
    name: "VPC",
    category: "Network",
    keywords: ["network", "network", "subnet", "subnet", "boundary"],
    icon: [
      "M4 8 V4 H8 M16 4 H20 V8 M20 16 V20 H16 M8 20 H4 V16",
      "M8.5 12 H15.5 M12 8.5 V15.5",
    ],
  },

  // ---- Database ---------------------------------------------------
  {
    id: "dynamodb",
    name: "DynamoDB",
    category: "Database",
    keywords: ["nosql", "database", "database", "table"],
    icon: [
      "M5 6 A7 2.8 0 0 0 19 6 A7 2.8 0 0 0 5 6 Z",
      "M5 6 V18 M19 6 V18",
      "M5 10 A7 2.8 0 0 0 19 10",
      "M5 14 A7 2.8 0 0 0 19 14",
      "M5 18 A7 2.8 0 0 0 19 18",
    ],
  },
  {
    id: "rds",
    name: "RDS",
    category: "Database",
    keywords: ["sql", "mysql", "postgres", "aurora", "relational database"],
    icon: [
      "M5 6 A7 2.8 0 0 0 19 6 A7 2.8 0 0 0 5 6 Z",
      "M5 6 V18 M19 6 V18",
      "M5 18 A7 2.8 0 0 0 19 18",
      "M5 12 A7 2.8 0 0 0 19 12",
    ],
  },
  {
    id: "elasticache",
    name: "ElastiCache",
    category: "Database",
    keywords: ["redis", "memcached", "cache"],
    icon: [
      "M6 6 H18 V18 H6 Z",
      "M13.5 7.5 L9.5 12.5 H12 L10.5 16.5 L14.5 11.5 H12 Z",
    ],
  },

  // ---- Storage ----------------------------------------------------
  {
    id: "s3",
    name: "S3",
    category: "Storage",
    keywords: ["bucket", "storage", "object", "file"],
    icon: [
      "M5.5 6.5 H18.5 L16.8 18.3 A6.8 3.4 0 0 1 7.2 18.3 Z",
      "M5.5 6.5 A6.5 2.6 0 0 0 18.5 6.5",
    ],
  },

  // ---- Messaging & Integration -------------------------------------------
  {
    id: "sqs",
    name: "SQS",
    category: "Messaging",
    keywords: ["queue", "queue", "messages", "broker"],
    icon: [
      "M5 5 H19 V8.5 H5 Z",
      "M5 10.25 H19 V13.75 H5 Z",
      "M5 15.5 H19 V19 H5 Z",
    ],
  },
  {
    id: "sns",
    name: "SNS",
    category: "Messaging",
    keywords: ["notification", "pub/sub", "topic", "push"],
    icon: ["M4 12 L20 4 L12.5 20 L11 13.5 Z", "M20 4 L11 13.5"],
  },
  {
    id: "eventbridge",
    name: "EventBridge",
    category: "Messaging",
    keywords: ["events", "events", "bus", "routing"],
    icon: [
      circle(12, 12, 2.6),
      "M9.8 9.8 L6 6 M14.2 9.8 L18 6 M9.8 14.2 L6 18 M14.2 14.2 L18 18",
      circle(5, 5, 1.9),
      circle(19, 5, 1.9),
      circle(5, 19, 1.9),
      circle(19, 19, 1.9),
    ],
  },
  {
    id: "step-functions",
    name: "Step Functions",
    category: "Messaging",
    keywords: ["workflow", "orchestration", "state machine"],
    icon: [
      "M6.5 8.5 L10 12 L6.5 15.5 L3 12 Z",
      "M10 12 H14",
      "M14 8.5 H21 V15.5 H14 Z",
    ],
  },
  {
    id: "kinesis",
    name: "Kinesis",
    category: "Messaging",
    keywords: ["streams", "streaming", "real-time data"],
    icon: [
      "M4 6 C9 6 9 10 14 10 H20 M4 12 C9 12 9 16 14 16 H20",
      "M4 16 C7 16 8 18 11 18.5",
    ],
  },

  // ---- Security & Identity ----------------------------------------------
  {
    id: "cognito",
    name: "Cognito",
    category: "Security",
    keywords: ["authentication", "login", "users", "identity"],
    icon: [
      circle(8.5, 8, 2.6),
      "M4 18.5 C4 15 13 15 13 18.5",
      "M15.5 7.5 L19.5 8.8 V12.2 C19.5 15 17.8 16.6 15.5 17.4 C13.2 16.6 11.5 15 11.5 12.2 V8.8 Z",
    ],
  },
  {
    id: "iam",
    name: "IAM",
    category: "Security",
    keywords: ["permissions", "roles", "policies", "access"],
    icon: [
      "M4.5 5 H19.5 V19 H4.5 Z",
      circle(9.5, 10, 1.7),
      "M6.5 15.8 C6.5 13.2 12.5 13.2 12.5 15.8",
      "M15.5 9.5 H17.5 M15.5 12.5 H17.5",
    ],
  },

  // ---- Monitoring ------------------------------------------------------
  {
    id: "cloudwatch",
    name: "CloudWatch",
    category: "Monitoring",
    keywords: ["logs", "metrics", "alarms", "monitoring"],
    icon: [
      "M3.5 5.5 H20.5 V18.5 H3.5 Z",
      "M6 12 H8.5 L10.5 8.5 L13.5 15.5 L15.5 12 H18",
    ],
  },

];

// ---- Kubernetes ----------------------------------------------------------

export const K8S_CATEGORIES = [
  "Compute",
  "Networking",
  "Storage",
  "Config",
  "Cluster",
] as const;

export type K8sCategory = (typeof K8S_CATEGORIES)[number];

export const LIBRARY_KUBERNETES: LibraryItem[] = [
  // ---- Compute ----------------------------------------------------------
  {
    id: "k8s-pod",
    name: "Pod",
    category: "Compute",
    keywords: ["pod", "container", "workload", "smallest", "deployable"],
  },
  {
    id: "k8s-deployment",
    name: "Deployment",
    category: "Compute",
    keywords: ["deployment", "rollout", "replica", "update", "workload"],
  },
  {
    id: "k8s-statefulset",
    name: "StatefulSet",
    category: "Compute",
    keywords: ["statefulset", "stateful", "ordered", "stable", "network", "workload"],
  },
  {
    id: "k8s-daemonset",
    name: "DaemonSet",
    category: "Compute",
    keywords: ["daemonset", "daemon", "node", "agent", "workload"],
  },
  {
    id: "k8s-job",
    name: "Job",
    category: "Compute",
    keywords: ["job", "batch", "one-off", "task", "workload"],
  },
  {
    id: "k8s-cronjob",
    name: "CronJob",
    category: "Compute",
    keywords: ["cronjob", "cron", "scheduled", "timer", "workload"],
  },
  {
    id: "k8s-replicaset",
    name: "ReplicaSet",
    category: "Compute",
    keywords: ["replicaset", "replica", "replication", "workload"],
  },

  // ---- Networking -------------------------------------------------------
  {
    id: "k8s-service",
    name: "Service",
    category: "Networking",
    keywords: ["service", "clusterip", "nodeport", "loadbalancer", "networking"],
  },
  {
    id: "k8s-ingress",
    name: "Ingress",
    category: "Networking",
    keywords: ["ingress", "http", "routing", "loadbalancer", "networking"],
  },
  {
    id: "k8s-networkpolicy",
    name: "NetworkPolicy",
    category: "Networking",
    keywords: ["networkpolicy", "firewall", "policy", "ingress", "egress", "networking"],
  },
  {
    id: "k8s-endpoint",
    name: "Endpoint",
    category: "Networking",
    keywords: ["endpoint", "endpoints", "networking"],
  },

  // ---- Storage ----------------------------------------------------------
  {
    id: "k8s-persistentvolume",
    name: "PersistentVolume",
    category: "Storage",
    keywords: ["persistentvolume", "pv", "volume", "storage"],
  },
  {
    id: "k8s-persistentvolumeclaim",
    name: "PersistentVolumeClaim",
    category: "Storage",
    keywords: ["persistentvolumeclaim", "pvc", "claim", "storage"],
  },
  {
    id: "k8s-storageclass",
    name: "StorageClass",
    category: "Storage",
    keywords: ["storageclass", "provisioning", "dynamic", "storage"],
  },

  // ---- Config -----------------------------------------------------------
  {
    id: "k8s-configmap",
    name: "ConfigMap",
    category: "Config",
    keywords: ["configmap", "config", "configuration", "env", "data"],
  },
  {
    id: "k8s-secret",
    name: "Secret",
    category: "Config",
    keywords: ["secret", "secrets", "credentials", "passwords", "tls", "config"],
  },

  // ---- Cluster ----------------------------------------------------------
  {
    id: "k8s-namespace",
    name: "Namespace",
    category: "Cluster",
    keywords: ["namespace", "ns", "isolation", "multi-tenancy", "cluster"],
  },
  {
    id: "k8s-node",
    name: "Node",
    category: "Cluster",
    keywords: ["node", "worker", "machine", "host", "cluster"],
  },
  {
    id: "k8s-rbac",
    name: "RBAC",
    category: "Cluster",
    keywords: ["rbac", "role", "clusterrole", "binding", "access", "authorization", "cluster"],
  },
  {
    id: "k8s-serviceaccount",
    name: "ServiceAccount",
    category: "Cluster",
    keywords: ["serviceaccount", "sa", "identity", "authentication", "cluster"],
  },
  {
    id: "k8s-hpa",
    name: "HorizontalPodAutoscaler",
    category: "Cluster",
    keywords: ["hpa", "autoscaler", "horizontal", "scale", "metrics", "cluster"],
  },
];

// ---- imported library items (.excalidrawlib) ------------------------------

const importedItems = new Map<string, LibraryItem>();

export function registerImportedLibraryItems(items: LibraryItem[]): void {
  for (const item of items) importedItems.set(item.id, item);
}

export function unregisterImportedLibraryItems(ids: string[]): void {
  for (const id of ids) importedItems.delete(id);
}

export function getLibraryItem(id: string): LibraryItem | undefined {
  return (
    LIBRARY.find((i) => i.id === id) ??
    LIBRARY_KUBERNETES.find((i) => i.id === id) ??
    importedItems.get(id)
  );
}

/** Simple case-insensitive search by name, keywords, and category */
export function searchLibrary(query: string): LibraryItem[] {
  const q = query.trim().toLowerCase();
  const pool = [...LIBRARY, ...LIBRARY_KUBERNETES, ...importedItems.values()];
  if (!q) return pool;
  const terms = q.split(/\s+/);
  return pool.filter((item) => {
    const hay = `${item.name} ${item.category} ${item.keywords.join(" ")}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

// ---- recents ------------------------------------------------------------

const RECENTS_KEY = "archidraw:recentComponents";
/** 3 rows of the 5-column recents grid */
const RECENTS_MAX = 15;

export function getRecentComponents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const ids: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(ids)) return [];
    return ids.filter(
      (id): id is string => typeof id === "string" && !!getLibraryItem(id),
    );
  } catch {
    return [];
  }
}

export function pushRecentComponent(id: string) {
  if (!getLibraryItem(id)) return;
  const next = [id, ...getRecentComponents().filter((r) => r !== id)].slice(
    0,
    RECENTS_MAX,
  );
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // best-effort
  }
}
