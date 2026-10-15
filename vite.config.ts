import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { validateApiPlugin } from "./vite.validate-plugin.ts";

// Caminho do markdown-fonte servido cru em /docs (e /docs.md). Nao ha render
// de SPA para docs: agentes de IA leem o markdown direto, sem executar JS.
const DOCS_SOURCE = fileURLToPath(
  new URL("./src/docs/archidraw-syntax.md", import.meta.url),
);

const DOCS_ROUTES = ["/docs", "/docs.md"];

// Intercepta /docs (e /docs.md) e devolve o markdown cru como text/markdown.
// Assim agentes de IA conseguem ler a referencia sem executar nenhum JS.
function serveDocsMarkdown(): Plugin {
  const readSource = () => readFileSync(DOCS_SOURCE, "utf8");

  // Connect middleware compartilhado entre dev e preview.
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
    if (!DOCS_ROUTES.includes(path)) return next();
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.end(readSource());
  };

  return {
    name: "archidraw-docs-markdown",
    // dev server
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    // preview server (usado pelo e2e)
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
    // build: emite docs.md, que o servidor Node serve em /docs e /docs.md
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "docs.md",
        source: readSource(),
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), serveDocsMarkdown(), validateApiPlugin()],
  build: {
    sourcemap: mode === "test",
  },
}));
