/**
 * Pretty-printing and tokenizing for the structured languages that show up in
 * element details: JSON and YAML.
 *
 * The preview renders fences like ```` ```json ```` / ```` ```yaml ```` as
 * syntax-highlighted, re-indented blocks. Everything here is a pure function
 * over strings that returns either a formatted source or a token list — never
 * HTML — so the UI layer keeps rendering through React elements only.
 *
 * Reformatting is deliberately conservative: `formatYaml` returns `null`
 * (meaning "render the source verbatim") for any document it cannot prove is
 * safe to re-indent. Block scalars, multi-line quoted scalars, flow
 * collections spanning lines and tab indentation all change meaning when their
 * leading whitespace is rewritten, so a single one of them disables the
 * transformation for the whole block. Highlighting still applies.
 */

export type StructuredLang = "json" | "yaml";

export type CodeTokenKind =
  | "key"
  | "string"
  | "number"
  | "boolean"
  | "punct"
  | "comment"
  | "plain";

export interface CodeToken {
  text: string;
  kind: CodeTokenKind;
}

const LANG_MAP: Record<string, StructuredLang> = {
  json: "json",
  jsonc: "json",
  json5: "json",
  yaml: "yaml",
  yml: "yaml",
};

/** fence language → structured language, or null for everything else */
export function detectStructuredLang(lang?: string): StructuredLang | null {
  if (!lang) return null;
  return LANG_MAP[lang.trim().toLowerCase()] ?? null;
}

export function formatJson(src: string): string | null {
  try {
    return JSON.stringify(JSON.parse(src) as unknown, null, 2);
  } catch {
    return null;
  }
}

/** a line whose value is a `|` / `>` block scalar indicator */
const BLOCK_SCALAR_LIKE = /(?:^|\s)[|>][+-]?\d*\s*(?:#.*)?$/;

function scanYamlRisk(lines: string[]): boolean {
  let inDouble = false;
  let inSingle = false;
  let flow = 0;

  for (const line of lines) {
    if (/^[ ]*\t/.test(line)) return true;

    const indent = /^[ ]*/.exec(line)![0].length;
    const commentLine = !inDouble && !inSingle && flow === 0 && line[indent] === "#";
    if (commentLine) continue;
    if (!inDouble && !inSingle && flow === 0 && BLOCK_SCALAR_LIKE.test(line)) {
      return true;
    }

    let i = indent;
    while (i < line.length) {
      const ch = line[i];
      if (inDouble) {
        if (ch === "\\") {
          i += 2;
          continue;
        }
        if (ch === '"') inDouble = false;
        i++;
        continue;
      }
      if (inSingle) {
        if (ch === "'" && line[i + 1] === "'") {
          i += 2;
          continue;
        }
        if (ch === "'") inSingle = false;
        i++;
        continue;
      }
      if (ch === "#" && (i === indent || line[i - 1] === " ")) break;
      if (ch === '"') {
        inDouble = true;
        i++;
        continue;
      }
      if (ch === "'") {
        inSingle = true;
        i++;
        continue;
      }
      if (ch === "[" || ch === "{") flow++;
      else if (ch === "]" || ch === "}") flow = Math.max(0, flow - 1);
      i++;
    }

    if (inDouble || inSingle || flow > 0) return true;
  }

  return false;
}

/**
 * Rewrites the document so every distinct indentation level collapses onto
 * two spaces, preserving the relative nesting order. Blank lines are emptied
 * and trailing whitespace is dropped. Returns null when the document carries
 * anything whose meaning depends on the exact leading whitespace.
 */
export function formatYaml(src: string): string | null {
  const normalized = src.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  if (scanYamlRisk(lines)) return null;

  const indentOf = lines.map((l) =>
    l.trim() === "" ? -1 : /^[ ]*/.exec(l)![0].length,
  );
  const distinct = [...new Set(indentOf.filter((n) => n >= 0))].sort(
    (a, b) => a - b,
  );
  const level = new Map(distinct.map((n, idx) => [n, idx]));

  const out = lines
    .map((line, i) => {
      const indent = indentOf[i];
      if (indent < 0) return "";
      return "  ".repeat(level.get(indent)!) + line.slice(indent).trimEnd();
    })
    .join("\n");

  return out;
}

export function formatStructured(lang: StructuredLang, src: string): string {
  const formatted = lang === "json" ? formatJson(src) : formatYaml(src);
  return formatted ?? src;
}

export function tokenizeStructured(
  lang: StructuredLang,
  src: string,
): CodeToken[] {
  return lang === "json" ? tokenizeJson(src) : tokenizeYaml(src);
}

function pushToken(out: CodeToken[], text: string, kind: CodeTokenKind) {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.kind === kind) last.text += text;
  else out.push({ text, kind });
}

export function tokenizeJson(src: string): CodeToken[] {
  const out: CodeToken[] = [];
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    if (ch === '"') {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === "\\") {
          j += 2;
          continue;
        }
        if (src[j] === '"') break;
        j++;
      }
      const end = Math.min(j + 1, src.length);
      let k = end;
      while (k < src.length && /\s/.test(src[k])) k++;
      pushToken(out, src.slice(i, end), src[k] === ":" ? "key" : "string");
      i = end;
      continue;
    }

    if (/[0-9-]/.test(ch)) {
      const m = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(src.slice(i));
      if (m) {
        pushToken(out, m[0], "number");
        i += m[0].length;
        continue;
      }
    }

    const literal = /^(true|false|null)/.exec(src.slice(i));
    if (literal && !/[A-Za-z0-9_$]/.test(src[i + literal[0].length] ?? "")) {
      pushToken(out, literal[0], "boolean");
      i += literal[0].length;
      continue;
    }

    if ("{}[]:,".includes(ch)) {
      pushToken(out, ch, "punct");
      i++;
      continue;
    }

    pushToken(out, ch, "plain");
    i++;
  }

  return out;
}

const YAML_BOOL =
  /^(?:true|True|TRUE|false|False|FALSE|yes|Yes|YES|no|No|NO|on|On|ON|off|Off|OFF|null|Null|NULL|~)$/;

const YAML_NUM = /^[-+]?(?:0x[0-9a-fA-F]+|\d[\d_]*(?:\.\d+)?(?:[eE][-+]?\d+)?)$/;

function classifyBare(text: string): CodeTokenKind {
  if (YAML_BOOL.test(text)) return "boolean";
  if (YAML_NUM.test(text)) return "number";
  return "plain";
}

function scanQuoted(line: string, start: number): number {
  const quote = line[start];
  let i = start + 1;
  while (i < line.length) {
    if (quote === "'" && line[i] === "'" && line[i + 1] === "'") {
      i += 2;
      continue;
    }
    if (quote === '"' && line[i] === "\\") {
      i += 2;
      continue;
    }
    if (line[i] === quote) return i + 1;
    i++;
  }
  return line.length;
}

function skipSpaces(line: string, from: number): number {
  let i = from;
  while (i < line.length && line[i] === " ") i++;
  return i;
}

const VALUE_BREAK = " \t[]{},";

function tokenizeYamlLine(line: string): CodeToken[] {
  const out: CodeToken[] = [];
  const indent = /^[ ]*/.exec(line)![0];
  let i = indent.length;
  if (i > 0) out.push({ text: indent, kind: "plain" });
  if (i >= line.length) return out;

  if (line[i] === "#") {
    out.push({ text: line.slice(i), kind: "comment" });
    return out;
  }

  while (line[i] === "-" && (i + 1 >= line.length || line[i + 1] === " ")) {
    out.push({ text: "-", kind: "punct" });
    i++;
    if (line[i] === " ") {
      out.push({ text: " ", kind: "plain" });
      i++;
    }
  }

  while (i < line.length) {
    const ch = line[i];

    if (ch === " ") {
      let j = i;
      while (j < line.length && line[j] === " ") j++;
      pushToken(out, line.slice(i, j), "plain");
      i = j;
      continue;
    }

    if (ch === "#") {
      out.push({ text: line.slice(i), kind: "comment" });
      break;
    }

    if ("[]{},&*|>!%@`".includes(ch)) {
      out.push({ text: ch, kind: "punct" });
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const close = scanQuoted(line, i);
      const colonAt = skipSpaces(line, close);
      if (line[colonAt] === ":") {
        out.push({ text: line.slice(i, colonAt + 1), kind: "key" });
        i = colonAt + 1;
      } else {
        out.push({ text: line.slice(i, close), kind: "string" });
        i = close;
      }
      continue;
    }

    let j = i;
    while (j < line.length && !VALUE_BREAK.includes(line[j]) && line[j] !== ":") {
      j++;
    }

    if (j >= line.length) {
      out.push({ text: line.slice(i), kind: classifyBare(line.slice(i)) });
      break;
    }

    if (line[j] === ":") {
      const next = line[j + 1];
      if (next === undefined || next === " ") {
        out.push({ text: line.slice(i, j + 1), kind: "key" });
        i = j + 1;
        continue;
      }
      j++;
      while (j < line.length && !VALUE_BREAK.includes(line[j])) j++;
      out.push({ text: line.slice(i, j), kind: classifyBare(line.slice(i, j)) });
      i = j;
      continue;
    }

    out.push({ text: line.slice(i, j), kind: classifyBare(line.slice(i, j)) });
    i = j;
  }

  return out;
}

export function tokenizeYaml(src: string): CodeToken[] {
  const out: CodeToken[] = [];
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  for (let li = 0; li < lines.length; li++) {
    if (li > 0) out.push({ text: "\n", kind: "plain" });
    out.push(...tokenizeYamlLine(lines[li]));
  }
  return out;
}
