// Plugin Vite que expõe POST /validate no dev server (configureServer) e no
// preview/e2e (configurePreviewServer). A lógica em si vive em
// src/core/validate/httpHandler.ts, compartilhada com o servidor Node de
// produção (server/index.ts) — uma fonte só, sem drift entre dev e prod.
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { tryHandleValidate } from "./src/core/validate/httpHandler.ts";

function middleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
): void {
  if (!tryHandleValidate(req, res)) next();
}

export function validateApiPlugin(): Plugin {
  return {
    name: "archidraw-validate-api",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
