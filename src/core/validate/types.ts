// Tipos compartilhados do validador de payloads do Archidraw.
// Um payload pode ser um workspace (.archidraw), uma biblioteca (.archidrawlib),
// um envelope de clipboard (archidraw/elements) ou um elemento solto.
// Inspirado nas regras documentadas em /docs (Seções 2 a 5).

/** qual formato o payload se parece ser, antes de validar */
export type PayloadFormat =
  | "workspace" // .archidraw schema 2 ({schemaVersion:2, tabs})
  | "workspace-legacy" // .archidraw schema 1 ({schemaVersion:1, doc, camera})
  | "library" // .archidrawlib ({libraryItems} / {library} / raiz array)
  | "clipboard" // archidraw/elements (envelope, array vazio ou solto)
  | "element" // um único elemento ElementType
  | "unknown"; // não corresponde a nenhum envelope conhecido

/** um problema encontrado; `severity` separa rejeição de advertência */
export interface ValidationIssue {
  /** caminho JSON aproximado, ex.: "tabs[0].doc.elements[2].type" */
  path: string;
  message: string;
  /** seção dos /docs que sustenta a regra (ex.: "2.2", "5.4") */
  rule?: string;
}

export interface ValidationResult {
  /** veredicto final: true somente se o parser real aceitaria o payload */
  valid: boolean;
  format: PayloadFormat;
  /** problemas que rejeitam o payload (o parser real recusaria) */
  errors: ValidationIssue[];
  /** coisas que o parser aceita mas que provavelmente são enganos do agente */
  warnings: ValidationIssue[];
  /** contagens úteis p/ o agente conferir o que gerou */
  summary: Record<string, number>;
}

/** constroi um resultado vazio (sem erros) para um formato */
export function emptyResult(format: PayloadFormat): ValidationResult {
  return { valid: true, format, errors: [], warnings: [], summary: {} };
}

/** acrescenta um erro de rejeicao e marca o resultado como invalido */
export function addError(
  r: ValidationResult,
  path: string,
  message: string,
  rule?: string,
): void {
  r.errors.push({ path, message, ...(rule ? { rule } : {}) });
  r.valid = false;
}

/** acrescenta uma advertencia (nao rejeita, mas o agente deve olhar) */
export function addWarning(
  r: ValidationResult,
  path: string,
  message: string,
  rule?: string,
): void {
  r.warnings.push({ path, message, ...(rule ? { rule } : {}) });
}
