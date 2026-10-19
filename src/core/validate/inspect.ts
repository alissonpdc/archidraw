// Inspeciona um elemento bruto (objeto) e produz diagnosticos granulares.
// Regra central (Seção 4.3 / 3.2): o parser real e tolerante — campos opcionais
// errados caem em default e NUNCA rejeitam. Rejeitam somente: item que nao e
// objeto, ou `type` fora dos oito ElementType. Entao aqui: type-invalido e
// ERROR (rejeita); todo o resto e WARNING (nao rejeita, mas sinaliza engano).
import type { ValidationIssue } from "./types.ts";
import {
  BASE_FIELDS,
  ELEMENT_TYPES,
  ENUMS,
  isNum,
  type EnumName,
} from "./enums.ts";
import { EDGE_TYPES, SHAPE_TYPES } from "./enums.ts";

type Raw = Record<string, unknown>;

export interface ElementInspection {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

const issue = (path: string, message: string, rule?: string): ValidationIssue => ({
  path,
  message,
  ...(rule ? { rule } : {}),
});

// ---- erros fatais (rejeitam o payload inteiro) --------------------------

function checkType(el: Raw, path: string): ValidationIssue | null {
  if (typeof el.type !== "string" || !ELEMENT_TYPES.includes(el.type)) {
    return issue(
      `${path}.type`,
      `type inválido: ${JSON.stringify(el.type)} — esperado um de [${ELEMENT_TYPES.join(", ")}]`,
      "3.4",
    );
  }
  return null;
}

// ---- advertencias (nao rejeitam, mas o agente deve corrigir) --------------

function checkBaseGeometry(el: Raw, path: string, out: ValidationIssue[]): void {
  // Seção 3.1/3.2: width/height positivos para shapes; assinados p/ line/arrow.
  for (const f of ["x", "y", "width", "height"] as const) {
    if (!isNum(el[f])) {
      out.push(issue(`${path}.${f}`, `${f} deve ser number finito, veio ${JSON.stringify(el[f])}`, "3.1"));
    }
  }
  const edge = EDGE_TYPES.includes(String(el.type));
  if (!edge && isNum(el.width) && el.width < 0) {
    out.push(issue(`${path}.width`, "width negativo só é válido em line/arrow", "3.1"));
  }
  if (!edge && isNum(el.height) && el.height < 0) {
    out.push(issue(`${path}.height`, "height negativo só é válido em line/arrow", "3.1"));
  }
}

function checkOpacity(el: Raw, path: string, out: ValidationIssue[]): void {
  // Seção 3.1: opacidades em 0..1 (arquivos .archidraw); 0..100 só na lib.
  for (const f of ["opacity", "strokeOpacity", "fillOpacity"] as const) {
    if (el[f] !== undefined && (!isNum(el[f]) || el[f] < 0 || el[f] > 1)) {
      out.push(issue(`${path}.${f}`, `${f} deve estar em 0..1 (arquivo/workspace), veio ${JSON.stringify(el[f])}`, "3.1"));
    }
  }
}

function checkEnumField(
  el: Raw,
  path: string,
  field: string,
  enumName: EnumName,
  out: ValidationIssue[],
): void {
  const v = el[field];
  if (v === undefined) return;
  const allowed = ENUMS[enumName];
  if (typeof v !== "string" || !allowed.includes(v)) {
    out.push(
      issue(
        `${path}.${field}`,
        `${field} inválido: ${JSON.stringify(v)} — esperado ${enumName} em [${allowed.join(", ")}] (vira default no paste, mas provável engano)`,
        "3.4",
      ),
    );
  }
}

function checkRoughness(el: Raw, path: string, out: ValidationIssue[]): void {
  const r = el.roughness;
  if (r === undefined) return;
  if (!isNum(r) || r < 0 || r > 3) {
    out.push(issue(`${path}.roughness`, `roughness deve ser inteiro 0..3, veio ${JSON.stringify(r)}`, "3.2"));
  }
}

function checkBorderRadius(el: Raw, path: string, out: ValidationIssue[]): void {
  const b = el.borderRadius;
  if (b === undefined) return;
  if (!isNum(b) || b < 0 || b > 100) {
    out.push(issue(`${path}.borderRadius`, `borderRadius é % do lado menor (0..100), veio ${JSON.stringify(b)}`, "3.1"));
  }
}

// ---- campos especificos por tipo (Seção 3.3) ------------------------------

function checkShapeLabel(el: Raw, path: string, out: ValidationIssue[]): void {
  if (el.label !== undefined && typeof el.label !== "string") {
    out.push(issue(`${path}.label`, "label de shape deve ser string", "3.3"));
  }
}

/** boolean-result polygons must carry their explicit ring set */
function checkPolygonRings(el: Raw, path: string, out: ValidationIssue[]): void {
  const rings = el.rings;
  if (!Array.isArray(rings) || rings.length === 0) {
    out.push(issue(`${path}.rings`, "polygon exige rings: array de anéis (outer primeiro)", "3.3"));
    return;
  }
  rings.forEach((ring, i) => {
    if (!Array.isArray(ring) || ring.length < 3) {
      out.push(issue(
        `${path}.rings[${i}]`,
        `anel precisa de >= 3 pontos {x,y}, veio ${JSON.stringify(ring)}`,
        "3.3",
      ));
      return;
    }
    ring.forEach((p, j) => checkPointObject(p, `${path}.rings[${i}][${j}]`, out));
  });
}

function checkEdgeFields(el: Raw, path: string, out: ValidationIssue[]): void {
  if (el.labelT !== undefined && (!isNum(el.labelT) || el.labelT < 0 || el.labelT > 1)) {
    out.push(issue(`${path}.labelT`, `labelT position the label de 0..1, veio ${JSON.stringify(el.labelT)}`, "3.3"));
  }
  checkEnumField(el, path, "lineType", "LineType", out);
  if (el.controlPoint !== undefined) checkPointObject(el.controlPoint, `${path}.controlPoint`, out);
  if (el.bendPoints !== undefined) {
    if (!Array.isArray(el.bendPoints)) {
      out.push(issue(`${path}.bendPoints`, "bendPoints deve ser array de pontos {x,y}", "3.3"));
    } else {
      el.bendPoints.forEach((p, i) => checkPointObject(p, `${path}.bendPoints[${i}]`, out));
    }
  }
  if (el.startBinding !== undefined) checkBinding(el.startBinding, `${path}.startBinding`, out);
  if (el.endBinding !== undefined) checkBinding(el.endBinding, `${path}.endBinding`, out);
  if (el.type === "arrow") {
    checkEnumField(el, path, "startArrowhead", "ArrowHeadType", out);
    checkEnumField(el, path, "endArrowhead", "ArrowHeadType", out);
    if (el.animated !== undefined && typeof el.animated !== "boolean") {
      out.push(issue(`${path}.animated`, "animated deve ser boolean", "3.3"));
    }
  }
}

function checkPointObject(v: unknown, path: string, out: ValidationIssue[]): void {
  if (typeof v !== "object" || v === null || Array.isArray(v) || !isNum((v as Raw).x) || !isNum((v as Raw).y)) {
    out.push(issue(path, "ponto inválido — esperado {x: number, y: number} finitos", "3.3"));
  }
}

function checkBinding(v: unknown, path: string, out: ValidationIssue[]): void {
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    out.push(issue(path, "binding inválido — esperado objeto {elementId, nx?, ny?, side?}", "3.5"));
    return;
  }
  const b = v as Raw;
  if (typeof b.elementId !== "string") {
    out.push(issue(`${path}.elementId`, "binding sem elementId string é descartado", "3.5"));
  }
  checkEnumField(b, path, "side", "BindingSide", out);
}

function checkTextField(el: Raw, path: string, out: ValidationIssue[]): void {
  if (el.type === "text") {
    if (el.text !== undefined && typeof el.text !== "string") {
      out.push(issue(`${path}.text`, "text deve ser string (usa \\n p/ multiline)", "3.3"));
    }
    if (el.fontSize !== undefined && !isNum(el.fontSize)) {
      out.push(issue(`${path}.fontSize`, "fontSize deve ser number", "3.3"));
    }
  }
  if (el.fontSize !== undefined && !isNum(el.fontSize)) {
    out.push(issue(`${path}.fontSize`, "fontSize deve ser number", "3.2"));
  }
  checkEnumField(el, path, "textAlign", "TextAlign", out);
  checkEnumField(el, path, "textVAlign", "TextVAlign", out);
}

function checkComponentFields(el: Raw, path: string, out: ValidationIssue[]): void {
  if (el.type !== "component") return;
  if (el.componentId !== undefined && typeof el.componentId !== "string") {
    out.push(issue(`${path}.componentId`, "componentId deve ser string (id do catálogo)", "3.3"));
  }
  if (el.src !== undefined && typeof el.src !== "string") {
    out.push(issue(`${path}.src`, "src deve ser data URL string (data:image/...)", "3.3"));
  }
  if (el.fill !== undefined && typeof el.fill !== "boolean") {
    out.push(issue(`${path}.fill`, "fill deve ser boolean", "3.3"));
  }
}

function checkContextFields(el: Raw, path: string, out: ValidationIssue[]): void {
  if (el.type !== "context") return;
  checkEnumField(el, path, "labelPosition", "LabelPosition", out);
  checkEnumField(el, path, "labelSide", "ContextLabelSide", out);
  if (el.childIds !== undefined) {
    if (!Array.isArray(el.childIds) || el.childIds.some((c) => typeof c !== "string")) {
      out.push(issue(`${path}.childIds`, "childIds deve ser array de strings (ids)", "3.3"));
    }
  }
}

/** inspeciona um elemento bruto: `type` invalido => error (rejeita); o resto => warnings */
export function inspectElement(raw: unknown, path: string): ElementInspection {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    errors.push(issue(path, "item não é um objeto elemento", "4.3"));
    return { errors, warnings };
  }
  const el = raw as Raw;
  const typeErr = checkType(el, path);
  if (typeErr) {
    errors.push(typeErr);
    return { errors, warnings }; // atomic: tipo invalido rejeita; nao adianta olhar o resto
  }
  // Campos base ausentes: em arquivo devem existir (2.2/3.2); no paste sao defaults.
  for (const f of BASE_FIELDS) {
    if (el[f] === undefined && f !== "id") {
      warnings.push(issue(`${path}.${f}`, `campo base ausente ${f} — em .archidraw escreva explicitamente; no paste vira default`, "3.2"));
    }
  }
  checkBaseGeometry(el, path, warnings);
  checkOpacity(el, path, warnings);
  checkRoughness(el, path, warnings);
  checkBorderRadius(el, path, warnings);
  checkTextField(el, path, warnings);
  const t = String(el.type);
  if (SHAPE_TYPES.includes(t)) checkShapeLabel(el, path, warnings);
  if (t === "polygon") checkPolygonRings(el, path, errors);
  if (EDGE_TYPES.includes(t)) checkEdgeFields(el, path, warnings);
  checkComponentFields(el, path, warnings);
  checkContextFields(el, path, warnings);
  for (const f of ["strokeStyle", "fillStyle"] as const) {
    checkEnumField(el, path, f, f === "strokeStyle" ? "StrokeStyle" : "FillStyle", warnings);
  }
  return { errors, warnings };
}
