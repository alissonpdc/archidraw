/**
 * Catálogo de componentes de arquitetura (foco AWS).
 * Ícones são paths SVG stroke-only no viewBox 24x24, desenhados
 * tanto no canvas (Path2D) quanto no DOM (inline svg) e no export SVG.
 */

export interface LibraryItem {
  id: string;
  name: string;
  category: string;
  keywords: string[];
  /** subpaths (stroke-only) no viewBox 0 0 24 24 */
  icon: string[];
}

export const LIBRARY_CATEGORIES = [
  "Computação",
  "Rede e entrega",
  "Banco de dados",
  "Armazenamento",
  "Mensageria e integração",
  "Segurança e identidade",
  "Monitoramento",
  "Clientes",
] as const;

export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number];

const circle = (cx: number, cy: number, r: number) =>
  `M${cx + r} ${cy} A${r} ${r} 0 1 1 ${cx - r} ${cy} A${r} ${r} 0 1 1 ${cx + r} ${cy}`;

export const LIBRARY: LibraryItem[] = [
  // ---- Computação -------------------------------------------------------
  {
    id: "ec2",
    name: "EC2",
    category: "Computação",
    keywords: ["instância", "servidor", "vm", "compute"],
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
    category: "Computação",
    keywords: ["serverless", "faas", "função", "lambda function"],
    icon: [
      "M14.5 4 C11 5.2 10.2 8 8.6 12.8 L6 20",
      "M10.3 9.3 C13 14 15.5 17.4 19 20",
    ],
  },
  {
    id: "ecs",
    name: "ECS",
    category: "Computação",
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
    category: "Computação",
    keywords: ["kubernetes", "k8s", "orquestração", "cluster"],
    icon: [
      "M12 3 L19.8 7.5 V16.5 L12 21 L4.2 16.5 V7.5 Z",
      circle(12, 12, 3.4),
      "M12 8.6 V5 M14.9 13.7 L18 15.5 M9.1 13.7 L6 15.5",
    ],
  },

  // ---- Rede e entrega -----------------------------------------------------
  {
    id: "api-gateway",
    name: "API Gateway",
    category: "Rede e entrega",
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
    category: "Rede e entrega",
    keywords: ["elb", "alb", "nlb", "balanceamento", "balancer"],
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
    category: "Rede e entrega",
    keywords: ["dns", "rota", "domínio", "route"],
    icon: [circle(12, 12, 8), "M4 12 H20", "M12 4 C15 7 15 17 12 20 C9 17 9 7 12 4 Z"],
  },
  {
    id: "cloudfront",
    name: "CloudFront",
    category: "Rede e entrega",
    keywords: ["cdn", "edge", "cache de borda"],
    icon: [
      circle(12, 12, 5.5),
      "M3.5 10 A 9 9 0 0 1 9 3.8 M20.5 14 A 9 9 0 0 1 15 20.2",
      "M3.5 10 L2.5 7.5 M3.5 10 L6 10.5 M20.5 14 L21.5 16.5 M20.5 14 L18 13.5",
    ],
  },
  {
    id: "vpc",
    name: "VPC",
    category: "Rede e entrega",
    keywords: ["rede", "network", "subrede", "subnet", "boundary"],
    icon: [
      "M4 8 V4 H8 M16 4 H20 V8 M20 16 V20 H16 M8 20 H4 V16",
      "M8.5 12 H15.5 M12 8.5 V15.5",
    ],
  },

  // ---- Banco de dados ---------------------------------------------------
  {
    id: "dynamodb",
    name: "DynamoDB",
    category: "Banco de dados",
    keywords: ["nosql", "banco", "database", "tabela"],
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
    category: "Banco de dados",
    keywords: ["sql", "mysql", "postgres", "aurora", "banco relacional"],
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
    category: "Banco de dados",
    keywords: ["redis", "memcached", "cache"],
    icon: [
      "M6 6 H18 V18 H6 Z",
      "M13.5 7.5 L9.5 12.5 H12 L10.5 16.5 L14.5 11.5 H12 Z",
    ],
  },

  // ---- Armazenamento ----------------------------------------------------
  {
    id: "s3",
    name: "S3",
    category: "Armazenamento",
    keywords: ["bucket", "storage", "objeto", "arquivo"],
    icon: [
      "M5.5 6.5 H18.5 L16.8 18.3 A6.8 3.4 0 0 1 7.2 18.3 Z",
      "M5.5 6.5 A6.5 2.6 0 0 0 18.5 6.5",
    ],
  },

  // ---- Mensageria e integração -------------------------------------------
  {
    id: "sqs",
    name: "SQS",
    category: "Mensageria e integração",
    keywords: ["fila", "queue", "mensagens", "broker"],
    icon: [
      "M5 5 H19 V8.5 H5 Z",
      "M5 10.25 H19 V13.75 H5 Z",
      "M5 15.5 H19 V19 H5 Z",
    ],
  },
  {
    id: "sns",
    name: "SNS",
    category: "Mensageria e integração",
    keywords: ["notificação", "pub/sub", "tópico", "push"],
    icon: ["M4 12 L20 4 L12.5 20 L11 13.5 Z", "M20 4 L11 13.5"],
  },
  {
    id: "eventbridge",
    name: "EventBridge",
    category: "Mensageria e integração",
    keywords: ["eventos", "events", "bus", "roteamento"],
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
    category: "Mensageria e integração",
    keywords: ["workflow", "orquestração", "máquina de estados"],
    icon: [
      "M6.5 8.5 L10 12 L6.5 15.5 L3 12 Z",
      "M10 12 H14",
      "M14 8.5 H21 V15.5 H14 Z",
    ],
  },
  {
    id: "kinesis",
    name: "Kinesis",
    category: "Mensageria e integração",
    keywords: ["streams", "streaming", "dados em tempo real"],
    icon: [
      "M4 6 C9 6 9 10 14 10 H20 M4 12 C9 12 9 16 14 16 H20",
      "M4 16 C7 16 8 18 11 18.5",
    ],
  },

  // ---- Segurança e identidade ----------------------------------------------
  {
    id: "cognito",
    name: "Cognito",
    category: "Segurança e identidade",
    keywords: ["autenticação", "login", "usuários", "identity"],
    icon: [
      circle(8.5, 8, 2.6),
      "M4 18.5 C4 15 13 15 13 18.5",
      "M15.5 7.5 L19.5 8.8 V12.2 C19.5 15 17.8 16.6 15.5 17.4 C13.2 16.6 11.5 15 11.5 12.2 V8.8 Z",
    ],
  },
  {
    id: "iam",
    name: "IAM",
    category: "Segurança e identidade",
    keywords: ["permissões", "roles", "políticas", "access"],
    icon: [
      "M4.5 5 H19.5 V19 H4.5 Z",
      circle(9.5, 10, 1.7),
      "M6.5 15.8 C6.5 13.2 12.5 13.2 12.5 15.8",
      "M15.5 9.5 H17.5 M15.5 12.5 H17.5",
    ],
  },

  // ---- Monitoramento ------------------------------------------------------
  {
    id: "cloudwatch",
    name: "CloudWatch",
    category: "Monitoramento",
    keywords: ["logs", "métricas", "alarmes", "monitoring"],
    icon: [
      "M3.5 5.5 H20.5 V18.5 H3.5 Z",
      "M6 12 H8.5 L10.5 8.5 L13.5 15.5 L15.5 12 H18",
    ],
  },

  // ---- Clientes -------------------------------------------------------------
  {
    id: "client",
    name: "Cliente / Browser",
    category: "Clientes",
    keywords: ["browser", "navegador", "usuário", "web", "spa"],
    icon: [
      "M3.5 5 H20.5 V19 H3.5 Z",
      "M3.5 9 H20.5",
      circle(6.2, 7, 0.9),
      circle(9, 7, 0.9),
    ],
  },
  {
    id: "mobile",
    name: "Mobile",
    category: "Clientes",
    keywords: ["celular", "app", "smartphone", "ios", "android"],
    icon: ["M8.5 3.5 H15.5 V20.5 H8.5 Z", "M11 17.8 H13"],
  },
];

export function getLibraryItem(id: string): LibraryItem | undefined {
  return LIBRARY.find((i) => i.id === id);
}

/** busca simples case-insensitive por nome, keywords e categoria */
export function searchLibrary(query: string): LibraryItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return LIBRARY;
  const terms = q.split(/\s+/);
  return LIBRARY.filter((item) => {
    const hay = `${item.name} ${item.category} ${item.keywords.join(" ")}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

// ---- recents ------------------------------------------------------------

const RECENTS_KEY = "archidraw:recentComponents";
const RECENTS_MAX = 8;

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
