import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const AI_DOCS_DIR = fileURLToPath(new URL("./src/ai", import.meta.url));
const AI_LIB_DIR = fileURLToPath(new URL("./src/core/assets/libraries", import.meta.url));

const AI_DOC_SLUGS = [
  "index",
  "recomendations",
  "workspace",
  "elements",
  "clipboard",
  "library",
  "lib-svg",
  "lib-native",
  "validation",
] as const;

const AI_LIB_SLUGS = [
  "clients-devices",
  "infra-network",
  "compute-services",
  "data-storage",
  "messaging-events",
  "security-identity",
  "observability-ops",
  "platform-integrations",
] as const;

const NOT_FOUND_MD = `# 404 — Unknown /ai route

Use \`GET /ai\` for the full compiled reference, one of the modular \`GET /ai/<slug>.md\` routes, or native libraries at \`GET /ai/lib/<slug>.archidrawlib\`:

### Documentation Modules
${AI_DOC_SLUGS.map((s) => `- \`/ai/${s}.md\``).join("\n")}

### Native Libraries
${AI_LIB_SLUGS.map((s) => `- \`/ai/lib/${s}.archidrawlib\``).join("\n")}
`;

function serveDocsMarkdown(): Plugin {
  const readModule = (slug: string) =>
    readFileSync(join(AI_DOCS_DIR, `${slug}.md`), "utf8");
  const readCompiled = () =>
    AI_DOC_SLUGS.map((slug) => readModule(slug).trimEnd()).join("\n\n") + "\n";
  const readLibrary = (slug: string) =>
    readFileSync(join(AI_LIB_DIR, `${slug}.archidrawlib`), "utf8");

  const middleware = (
    req: { url?: string },
    res: {
      setHeader: (k: string, v: string) => void;
      end: (b: string) => void;
      statusCode: number;
    },
    next: () => void,
  ) => {
    const path = (req.url ?? "").split("?")[0].replace(/\/+$/, "");
    if (path === "/ai") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.end(readCompiled());
      return;
    }
    if (path.startsWith("/ai/lib/")) {
      const sub = path.slice("/ai/lib/".length);
      const slug = sub.endsWith(".archidrawlib")
        ? sub.slice(0, -".archidrawlib".length)
        : sub;
      if ((AI_LIB_SLUGS as readonly string[]).includes(slug)) {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(readLibrary(slug));
        return;
      }
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.end(NOT_FOUND_MD);
      return;
    }
    if (path.startsWith("/ai/")) {
      const sub = path.slice("/ai/".length);
      if (sub.endsWith(".md")) {
        let slug = sub.slice(0, -3);
        if (slug === "recommendations" || slug === "recipes") slug = "recomendations";
        if (slug === "validate") slug = "validation";
        if ((AI_DOC_SLUGS as readonly string[]).includes(slug)) {
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/markdown; charset=utf-8");
          res.end(readModule(slug));
          return;
        }
      }
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.end(NOT_FOUND_MD);
      return;
    }
    next();
  };

  return {
    name: "archidraw-ai-markdown",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "ai/full.md",
        source: readCompiled(),
      });
      for (const slug of AI_DOC_SLUGS) {
        this.emitFile({
          type: "asset",
          fileName: `ai/${slug}.md`,
          source: readModule(slug),
        });
      }
      for (const slug of AI_LIB_SLUGS) {
        this.emitFile({
          type: "asset",
          fileName: `ai/lib/${slug}.archidrawlib`,
          source: readLibrary(slug),
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), serveDocsMarkdown()],
  build: {
    sourcemap: mode === "test",
  },
}));
