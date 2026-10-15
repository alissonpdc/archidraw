// Adapter HTTP de POST /validate, compartilhado entre o middleware do Vite
// (dev/preview) e o servidor Node de produção (server/). Deliberadamente sem
// imports de Node (sem Buffer, sem node:http): lê o corpo como bytes crus e
// decodifica com TextDecoder, então compila tanto no projeto do app (lib DOM,
// sem types de Node) quanto no projeto de Node.
import { validatePayload } from "./index.ts";

export const VALIDATE_PATH = "/validate";
// limite p/ não travar o processo com payloads absurdos de um agente
const MAX_BODY_BYTES = 8 * 1024 * 1024;

/** subconjunto de http.IncomingMessage que usamos (estrutural, sem dep. de Node) */
export interface ReqLike {
  url?: string;
  method?: string;
  on: (event: string, cb: (chunk?: Uint8Array) => void) => void;
}

/** subconjunto de http.ServerResponse que usamos */
export interface ResLike {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body: string) => void;
}

function sendJson(res: ResLike, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(body, null, 2));
}

/** corpo de erro no mesmo shape de ValidationResult, para o agente parsear igual */
function errorBody(message: string, rule?: string) {
  return {
    valid: false,
    format: "unknown",
    errors: [{ path: "", message, ...(rule ? { rule } : {}) }],
    warnings: [],
    summary: {},
  };
}

function joinBytes(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function respond(res: ResLike, text: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    sendJson(res, 400, errorBody(`JSON inválido: ${(e as Error).message}`, "1"));
    return;
  }
  sendJson(res, 200, validatePayload(parsed));
}

function readBody(req: ReqLike, res: ResLike): void {
  const chunks: Uint8Array[] = [];
  let size = 0;
  let settled = false;
  req.on("data", (chunk) => {
    if (settled) return;
    const bytes = chunk ?? new Uint8Array();
    size += bytes.length;
    if (size > MAX_BODY_BYTES) {
      settled = true;
      sendJson(res, 413, errorBody(`payload > ${MAX_BODY_BYTES} bytes`));
      return;
    }
    chunks.push(bytes);
  });
  req.on("end", () => {
    if (settled) return;
    settled = true;
    respond(res, new TextDecoder().decode(joinBytes(chunks, size)));
  });
  req.on("error", () => {
    if (settled) return;
    settled = true;
    sendJson(res, 400, errorBody("erro ao ler o corpo da requisição", "1"));
  });
}

/** responde /validate; devolve true se tratou (senão o chamador segue o fluxo). */
export function tryHandleValidate(req: ReqLike, res: ResLike): boolean {
  const path = (req.url ?? "").split("?")[0].replace(/\/+$/, "");
  if (path !== VALIDATE_PATH) return false;
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.end("");
    return true;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, {
      error: "use POST /validate com o payload JSON no corpo",
      usage: {
        method: "POST",
        path: VALIDATE_PATH,
        body: "<workspace | library | clipboard | element>",
      },
    });
    return true;
  }
  readBody(req, res);
  return true;
}
