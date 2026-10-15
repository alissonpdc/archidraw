// Servidor de arquivos estáticos do build (dist/): MIME, gzip, cache longo para
// /assets/ (nomes com hash, imutáveis), fallback SPA para index.html e proteção
// contra path traversal. Substitui o papel que o nginx fazia.
import type { IncomingMessage, ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { createGzip } from "node:zlib";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const GZIP_EXTS = new Set([
  ".html",
  ".js",
  ".mjs",
  ".css",
  ".json",
  ".map",
  ".svg",
  ".txt",
  ".md",
]);
const GZIP_MIN_BYTES = 1024;
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** resolve a URL dentro de `root`; null se escapar (path traversal). */
function safeResolve(root: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const rootAbs = resolve(root);
  const rel = decoded.startsWith("/") ? decoded : `/${decoded}`;
  const full = resolve(rootAbs, `.${rel}`);
  if (full !== rootAbs && !full.startsWith(rootAbs + sep)) return null;
  return full;
}

/** /assets/ tem hash no nome → cache imutável de 1 ano; o resto revalida. */
function cacheControl(urlPath: string): string {
  return urlPath.startsWith("/assets/")
    ? `public, immutable, max-age=${ONE_YEAR_SECONDS}`
    : "no-cache";
}

function acceptsGzip(req: IncomingMessage): boolean {
  const header = req.headers["accept-encoding"];
  return /\bgzip\b/.test(Array.isArray(header) ? header.join(",") : (header ?? ""));
}

function sendFile(
  req: IncomingMessage,
  res: ServerResponse,
  file: string,
  urlPath: string,
): void {
  const stat = statSync(file);
  const ext = extname(file).toLowerCase();
  res.statusCode = 200;
  res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
  res.setHeader("Cache-Control", cacheControl(urlPath));
  res.setHeader("Vary", "Accept-Encoding");

  if (req.method === "HEAD") {
    res.setHeader("Content-Length", String(stat.size));
    res.end();
    return;
  }
  if (acceptsGzip(req) && GZIP_EXTS.has(ext) && stat.size >= GZIP_MIN_BYTES) {
    res.setHeader("Content-Encoding", "gzip");
    createReadStream(file).pipe(createGzip()).pipe(res);
    return;
  }
  res.setHeader("Content-Length", String(stat.size));
  createReadStream(file).pipe(res);
}

/** serve o caminho pedido do build, com fallback SPA para index.html. */
export function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  distRoot: string,
): void {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.end("Method Not Allowed");
    return;
  }
  const urlPath = (req.url ?? "/").split("?")[0];
  let file = safeResolve(distRoot, urlPath);
  if (file && existsSync(file) && statSync(file).isDirectory()) {
    file = join(file, "index.html");
  }
  if (!file || !existsSync(file) || statSync(file).isDirectory()) {
    file = join(resolve(distRoot), "index.html"); // fallback SPA
  }
  if (!existsSync(file)) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not found");
    return;
  }
  sendFile(req, res, file, urlPath);
}
