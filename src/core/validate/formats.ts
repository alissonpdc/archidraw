// Validadores por envelope. Cada um devolve um ValidationResult seguindo as
// regras de rejeicao da Seção correspondente dos /docs, com o veredicto `valid`
// espelhando o parser real (storage.parse / parseExcalidrawLib / parseElementsClipboard).
import type { ValidationResult } from "./types.ts";
import { addError, addWarning, emptyResult } from "./types.ts";
import { inspectElement } from "./inspect.ts";
import { isNum } from "./enums.ts";

type Raw = Record<string, unknown>;

/** funde os diagnosticos de um elemento no resultado */
function absorb(r: ValidationResult, raw: unknown, path: string): void {
  const { errors, warnings } = inspectElement(raw, path);
  for (const e of errors) addError(r, e.path, e.message, e.rule);
  for (const w of warnings) addWarning(r, w.path, w.message, w.rule);
}

// ---- workspace schema 2 (Seção 2.2) ---------------------------------------

function validateCamera(cam: unknown, path: string, r: ValidationResult): void {
  if (typeof cam !== "object" || cam === null) {
    addError(r, path, "camera ausente ou não-objeto — precisa de {scrollX, scrollY, zoom} numéricos", "2.1");
    return;
  }
  const c = cam as Raw;
  for (const f of ["scrollX", "scrollY", "zoom"] as const) {
    if (!isNum(c[f])) addError(r, `${path}.${f}`, `camera.${f} deve ser number finito`, "2.1");
  }
}

function validateDoc(doc: unknown, path: string, r: ValidationResult): void {
  if (typeof doc !== "object" || doc === null) {
    addError(r, path, "doc ausente ou não-objeto — precisa de {schemaVersion:1, elements:[]}", "2.1");
    return;
  }
  const d = doc as Raw;
  if (!Array.isArray(d.elements)) {
    addError(r, `${path}.elements`, "doc.elements deve ser array", "2.1");
    return;
  }
  r.summary.elements = (r.summary.elements ?? 0) + d.elements.length;
  d.elements.forEach((el, i) => {
    const elPath = `${path}.elements[${i}]`;
    absorb(r, el, elPath);
    if (
      typeof el === "object" &&
      el !== null &&
      (el as Raw).type === "component" &&
      typeof (el as Raw).componentId === "string" &&
      ((el as Raw).componentId as string).startsWith("sd-")
    ) {
      addWarning(
        r,
        `${elPath}.componentId`,
        `elemento '${(el as Raw).componentId}' como component em workspace — descompacte os archidrawElements nativos da biblioteca em /ai/lib/<slug>.archidrawlib (consulte /ai/lib-native.md)`,
        "lib-native",
      );
    }
  });
}

export function validateWorkspace(data: Raw): ValidationResult {
  const r = emptyResult("workspace");
  if (typeof data.activeTabId !== "string") {
    addError(r, "activeTabId", "activeTabId deve ser string", "2.1");
  }
  if (!Array.isArray(data.tabs) || data.tabs.length === 0) {
    addError(r, "tabs", "tabs deve ser array não-vazio", "2.1");
    return r;
  }
  r.summary.tabs = data.tabs.length;
  data.tabs.forEach((t, i) => {
    const p = `tabs[${i}]`;
    if (typeof t !== "object" || t === null) {
      addError(r, p, "tab deve ser objeto {id, name, doc, camera}", "2.1");
      return;
    }
    const tab = t as Raw;
    if (typeof tab.id !== "string") addError(r, `${p}.id`, "tab.id deve ser string", "2.1");
    if (typeof tab.name !== "string") addError(r, `${p}.name`, "tab.name deve ser string", "2.1");
    validateDoc(tab.doc, `${p}.doc`, r);
    validateCamera(tab.camera, `${p}.camera`, r);
  });
  // activeTabId deve apontar para uma tab existente (o loader nao exige, mas e engano)
  if (typeof data.activeTabId === "string" && Array.isArray(data.tabs)) {
    const ids = data.tabs.map((t) => (t as Raw)?.id);
    if (!ids.includes(data.activeTabId)) {
      addWarning(r, "activeTabId", `activeTabId "${data.activeTabId}" não corresponde a nenhuma tab.id`, "2.1");
    }
  }
  return r;
}

// ---- workspace legado schema 1 (Seção 2.3) --------------------------------

export function validateWorkspaceLegacy(data: Raw): ValidationResult {
  const r = emptyResult("workspace-legacy");
  validateDoc(data.doc, "doc", r);
  validateCamera(data.camera, "camera", r);
  addWarning(r, "schemaVersion", "schemaVersion 1 é legado — migrado para tabs na carga; prefira schema 2", "2.3");
  return r;
}

// ---- biblioteca .archidrawlib (Seção 5.4) ---------------------------------

// regra 5.4: opacity da lib e 0..100 (diferente do workspace, 0..1)
function inspectLibElement(raw: unknown, path: string, r: ValidationResult): void {
  const { errors, warnings } = inspectElement(raw, path);
  for (const e of errors) {
    // na lib, tipo invalido so DESCARTA o elemento (nao rejeita o arquivo) — 5.4
    addWarning(r, e.path, `${e.message} — na biblioteca isso descarta o elemento (não rejeita o arquivo)`, "5.4");
  }
  for (const w of warnings) addWarning(r, w.path, w.message, w.rule);
  // geometria finita e obrigatoria na lib (5.4: NaN cai no SVG)
  if (raw && typeof raw === "object") {
    const el = raw as Raw;
    for (const f of ["x", "y", "width", "height"] as const) {
      if (!isNum(el[f])) addWarning(r, `${path}.${f}`, `${f} não-finito vira NaN no SVG da biblioteca`, "5.4");
    }
    if (["line", "arrow", "draw"].includes(String(el.type))) {
      if (!Array.isArray(el.points) || el.points.length < 2) {
        addWarning(r, `${path}.points`, `${el.type} precisa de points[] com >=2 entradas; menos descarta o elemento`, "5.2");
      }
    }
    if (el.opacity !== undefined && (!isNum(el.opacity) || el.opacity < 0 || el.opacity > 100)) {
      addWarning(r, `${path}.opacity`, `opacity de biblioteca vai de 0..100 (não 0..1), veio ${JSON.stringify(el.opacity)}`, "5.2");
    }
  }
}

function libItems(data: Raw): { items: unknown[]; key: string } | null {
  for (const key of ["libraryItems", "library"] as const) {
    if (Array.isArray(data[key])) return { items: data[key] as unknown[], key };
  }
  return null;
}

export function validateLibrary(data: unknown): ValidationResult {
  const r = emptyResult("library");
  // regra 5.4: raiz precisa ser array ou objeto com libraryItems/library
  let items: unknown[];
  let basePath: string;
  if (Array.isArray(data)) {
    items = data;
    basePath = "";
  } else {
    const found = libItems(data as Raw);
    if (!found) {
      addError(r, "", "raiz sem 'libraryItems' (nem 'library') array — envelope de biblioteca inválido", "5.4");
      return r;
    }
    items = found.items;
    basePath = found.key;
  }
  if (items.length === 0) {
    addError(r, basePath, "libraryItems vazio — arquivo seria rejeitado (nenhum item resta)", "5.4");
    return r;
  }
  r.summary.items = items.length;
  let keptElements = 0;
  items.forEach((it, i) => {
    const p = basePath ? `${basePath}[${i}]` : `[${i}]`;
    let elements: unknown[];
    let natives: unknown[] = [];
    if (Array.isArray(it)) elements = it;
    else if (it && typeof it === "object") {
      const rec = it as Raw;
      natives = Array.isArray(rec.archidrawElements) ? (rec.archidrawElements as unknown[]) : [];
      elements = Array.isArray(rec.elements) ? (rec.elements as unknown[]) : [];
      if (natives.length === 0 && elements.length === 0) {
        addWarning(r, p, "item sem archidrawElements nem elements[] — seria pulado", "5.4");
        return;
      }
    } else {
      addWarning(r, p, "item nem array nem objeto com elements[] — seria pulado", "5.4");
      return;
    }
    if (natives.length > 0) {
      keptElements += natives.length;
      natives.forEach((el, j) => absorb(r, el, `${p}.archidrawElements[${j}]`));
      return;
    }
    addWarning(
      r,
      p,
      "item sem archidrawElements — entra como imagem estática e o estilo de linha/rascunho não tem efeito; gere os elementos nativos (seção 3)",
      "5.1",
    );
    keptElements += elements.length;
    elements.forEach((el, j) => inspectLibElement(el, `${p}.elements[${j}]`, r));
  });
  r.summary.elements = keptElements;
  if (keptElements === 0) {
    addError(r, basePath, "nenhum elemento sobrevive em nenhum item — arquivo rejeitado (5.4)", "5.4");
  }
  return r;
}

// ---- clipboard archidraw/elements (Seção 4.3) -----------------------------

export function validateClipboard(data: unknown): ValidationResult {
  const r = emptyResult("clipboard");
  let raw: unknown[];
  if (Array.isArray(data)) {
    raw = data;
  } else if (Array.isArray((data as Raw).elements)) {
    raw = (data as Raw).elements as unknown[];
  } else {
    raw = [data]; // elemento solto (4.2)
  }
  if (raw.length === 0) {
    addError(r, "elements", "elements vazio — nada para colar", "4.3");
    return r;
  }
  // 4.3: validacao atomica — qualquer item invalido rejeita TUDO
  r.summary.elements = raw.length;
  raw.forEach((el, i) => absorb(r, el, `elements[${i}]`));
  return r;
}
