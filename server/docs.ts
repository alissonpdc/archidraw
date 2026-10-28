import type { IncomingMessage, ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

const MISSING = "# ai/full.md não encontrado no build\n";
const NOT_FOUND_MD = `# 404 — Unknown /ai route

Use \`GET /ai\` for the full compiled reference or one of the modular \`GET /ai/<slug>.md\` routes:

${AI_DOC_SLUGS.map((s) => `- \`/ai/${s}.md\``).join("\n")}
`;

const cache = new Map<string, string>();

function readAsset(distRoot: string, relPath: string): string {
  const key = `${distRoot}:${relPath}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const file = join(distRoot, relPath);
  const content = existsSync(file) ? readFileSync(file, "utf8") : MISSING;
  cache.set(key, content);
  return content;
}

export function serveDocs(
  req: IncomingMessage,
  res: ServerResponse,
  distRoot: string,
): boolean {
  const path = (req.url ?? "").split("?")[0].replace(/\/+$/, "");
  if (path === "/ai") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(readAsset(distRoot, join("ai", "full.md")));
    return true;
  }
  if (path.startsWith("/ai/")) {
    const sub = path.slice("/ai/".length);
    if (sub.endsWith(".md")) {
      const slug = sub.slice(0, -3);
      if ((AI_DOC_SLUGS as readonly string[]).includes(slug)) {
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/markdown; charset=utf-8");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end(readAsset(distRoot, join("ai", `${slug}.md`)));
        return true;
      }
    }
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(NOT_FOUND_MD);
    return true;
  }
  return false;
}
