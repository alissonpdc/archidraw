import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { validateApiPlugin } from "./vite.validate-plugin.ts";

const AI_DOCS_DIR = fileURLToPath(new URL("./src/ai", import.meta.url));

const AI_DOC_SLUGS = [
  "index",
  "workspace",
  "elements",
  "catalog",
  "clipboard",
  "library",
  "recipes",
  "validate",
] as const;

const NOT_FOUND_MD = `# 404 — Unknown /ai route

Use \`GET /ai\` for the full compiled reference or one of the modular \`GET /ai/<slug>.md\` routes:

${AI_DOC_SLUGS.map((s) => `- \`/ai/${s}.md\``).join("\n")}
`;

function serveDocsMarkdown(): Plugin {
  const readModule = (slug: string) =>
    readFileSync(join(AI_DOCS_DIR, `${slug}.md`), "utf8");
  const readCompiled = () =>
    AI_DOC_SLUGS.map((slug) => readModule(slug).trimEnd()).join("\n\n") + "\n";

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
    if (path.startsWith("/ai/")) {
      const sub = path.slice("/ai/".length);
      if (sub.endsWith(".md")) {
        const slug = sub.slice(0, -3);
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
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), serveDocsMarkdown(), validateApiPlugin()],
  build: {
    sourcemap: mode === "test",
  },
}));
