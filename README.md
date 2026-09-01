# ArchiDraw

Drawing canvas for **software architecture and system design** — Excalidraw/draw.io style, but with domain intelligence: ready-to-use components (APIs, queues, databases, caches, CDNs), standardized notation, and event sequence numbering. Draw architecture at the speed of thought.

## Objective

Generic drawing tools require too much manual work: searching for icons, aligning elements, maintaining consistency. ArchiDraw is built for **software engineers and architects** who need speed when creating technical proposals, RFCs/ADRs, documentation, and preparing for system design interviews — running **100% locally**, with no accounts, no cloud dependencies, and no recurring costs.

## Key Features

- **Infinite canvas** with pan, zoom, snapping, and smart alignment guides
- **Shapes and connections:** rectangle, ellipse, diamond, arrows (straight, elbow, curved), free text, and inline text
- **Software component library:** API Gateway, Load Balancer, Service, Database, Cache, Message Queue, CDN, Lambda, and more
- **AWS icons** (official library)
- **Semantic connections:** protocol labels (HTTP/gRPC/WebSocket/TCP/AMQP), sync/async direction
- **Dashed arrow animation** indicating flow/direction
- **Automatic arrow numbering** for event chronology in the flow
- **Hover info box:** technical details (payload, latency, notes) hidden by default
- **Semantic groups:** boundary boxes (VPC, K8s Cluster, Bounded Context)
- **Multiple canvas tabs** per workspace
- **Undo/Redo, multi-selection, layers, copy/paste/duplicate**
- **Full keyboard shortcuts**
- **Automatic persistence** via localStorage — no "save" button required
- **Export options:** PNG, SVG, and portable JSON (`.archidraw`); **Excalidraw compatible import/export** (best-effort)
- **Dark mode**
- **Total privacy:** data never leaves your machine

## How to Use

### Docker (Recommended)

```bash
docker build -t archidraw .
docker run -d --name archidraw -p 5000:5000 archidraw
```

Access **http://localhost:5000**.

The host port is configurable via `-p` (e.g., `-p 8080:5000` exposes it on port 8080).

### Local Development

Prerequisites: Node.js 20+ and npm.

```bash
npm install
npm run dev          # dev server (Vite)
```

Other useful commands:

```bash
npm run lint         # oxlint
npm run build        # typecheck + production build
npm run test:e2e     # Playwright tests (real build + preview)
npm run test:e2e:ui  # Playwright interactive UI
```

### Basic Workflow

1. Open the app and draw on the canvas: `R` rectangle, `A` arrow, `T` text, `V` select, `H` hand (pan).
2. Add components from the software architecture library and AWS icons.
3. Number arrows to indicate event flow chronology; add technical details via hover info boxes.
4. Everything is saved automatically in the browser. Use JSON export/import for backups or moving between instances.

## CI/CD

Automated pipeline via GitHub Actions:

1. **CI** (`.github/workflows/ci.yml`) — pushes to conventional branches (`feat/*`, `fix/*`, `chore/*`, etc.) or PRs targeting `main` run **lint + build + E2E tests**. Once the pipeline passes, a **PR to `main` is created automatically** (idempotent — one PR per branch).
2. **Release** (`.github/workflows/release.yml`) — merging into `main` triggers: full validation → **GitHub Release** with user-friendly notes (features, fixes, improvements, docs) and automated semantic versioning (`feat` → minor, `fix` → patch, breaking → major) → **Docker image build and push to Docker Hub** (tags `X.Y.Z`, `X.Y`, and `latest`).

The Docker job only runs if the secrets below are configured.

### Docker Hub Authentication

Configure two secrets in the repository (**Settings → Secrets and variables → Actions → New repository secret**):

| Secret | Value |
|---|---|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |

To generate the token: Docker Hub → **Account Settings → Security → Personal access tokens → Generate new token** with **Read & Write** permissions. Use the token (not your password) — it can be revoked at any time without exposing your account.

## Documentation

- [PRD.md](PRD.md) — product vision and roadmap
- [CONTRIBUTING.md](CONTRIBUTING.md) — guide for contributors
- [AGENTS.md](AGENTS.md) — development guidelines and knowledge base

## License

[Apache-2.0](LICENSE)

