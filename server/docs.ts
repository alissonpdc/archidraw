// Serve o markdown cru de /docs e /docs.md (fonte única emitida no build para
// dist/docs.md). Sem render de SPA: agentes de IA leem o markdown direto.
import type { IncomingMessage, ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DOCS_ROUTES = ["/docs", "/docs.md"];
const MISSING = "# docs.md não encontrado no build\n";

let cached: string | null = null;

function readDocs(distRoot: string): string {
  if (cached === null) {
    const file = join(distRoot, "docs.md");
    cached = existsSync(file) ? readFileSync(file, "utf8") : MISSING;
  }
  return cached;
}

/** responde /docs e /docs.md; devolve true se tratou a requisição. */
export function serveDocs(
  req: IncomingMessage,
  res: ServerResponse,
  distRoot: string,
): boolean {
  const path = (req.url ?? "").split("?")[0].replace(/\/+$/, "");
  if (!DOCS_ROUTES.includes(path)) return false;
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(readDocs(distRoot));
  return true;
}
