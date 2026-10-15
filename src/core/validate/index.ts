// Entrada do validador: detecta o formato de um payload e roteia para o
// validador certo. `validatePayload` aceita o objeto JÁ parseado (o middleware
// faz JSON.parse); isso mantém o módulo puro e testável sem I/O.
import type { PayloadFormat, ValidationResult } from "./types.ts";
import { emptyResult } from "./types.ts";
import {
  validateClipboard,
  validateLibrary,
  validateWorkspace,
  validateWorkspaceLegacy,
} from "./formats.ts";

type Raw = Record<string, unknown>;

const ELEMENT_TYPES = new Set([
  "rectangle", "diamond", "ellipse", "line", "arrow", "text", "component", "context",
]);

function detectLibraryShape(data: Raw): boolean {
  if (Array.isArray(data.libraryItems) || Array.isArray(data.library)) return true;
  return false;
}

// Ordem de detecção espelha a disjointness dos /docs (Seção 1): cada parser
// aceita só o próprio envelope. Workspace tem schemaVersion; biblioteca tem
// libraryItems/library; clipboard tem type archidraw/elements ou elements[].
export function detectFormat(data: unknown): PayloadFormat {
  if (typeof data !== "object" || data === null) return "unknown";
  const d = data as Raw;
  if (d.schemaVersion === 2 && (Array.isArray(d.tabs) || typeof d.activeTabId !== "undefined")) {
    return "workspace";
  }
  if (d.schemaVersion === 1 && ("doc" in d || "camera" in d)) return "workspace-legacy";
  if (detectLibraryShape(d)) return "library";
  // marcador de arquivo .archidrawlib/.excalidrawlib (o parser so checa
  // libraryItems, mas o type denuncia o intento e nos da o formato certo p/ 5.4)
  if (d.type === "archidrawlib" || d.type === "excalidrawlib") return "library";
  if (Array.isArray(data)) {
    // raiz array: de arrays => biblioteca (v1); de objetos => clipboard solto
    const allArrays = data.length > 0 && data.every((x) => Array.isArray(x));
    if (allArrays) return "library";
    return "clipboard";
  }
  if (d.type === "archidraw/elements" || Array.isArray(d.elements)) return "clipboard";
  if (typeof d.type === "string" && ELEMENT_TYPES.has(d.type)) return "element";
  return "unknown";
}

// um elemento solto segue as mesmas regras de um clipboard de 1 item (4.2),
// mas e reportado com o formato "element" p/ o agente saber o que mandou
function validateSingleElement(data: Raw): ValidationResult {
  const r = validateClipboard(data);
  r.format = "element";
  return r;
}

export function validatePayload(data: unknown): ValidationResult {
  const format = detectFormat(data);
  switch (format) {
    case "workspace":
      return validateWorkspace(data as Raw);
    case "workspace-legacy":
      return validateWorkspaceLegacy(data as Raw);
    case "library":
      return validateLibrary(data);
    case "clipboard":
      return validateClipboard(data);
    case "element":
      return validateSingleElement(data as Raw);
    default: {
      const r = emptyResult("unknown");
      r.valid = false;
      r.errors.push({
        path: "",
        message:
          "payload não corresponde a nenhum envelope conhecido " +
          "(workspace schema 2, workspace legado 1, biblioteca libraryItems, " +
          "clipboard archidraw/elements, ou um elemento ElementType)",
        rule: "1",
      });
      return r;
    }
  }
}
