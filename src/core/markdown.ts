/**
 * Minimal, dependency-free markdown parser used by the hover preview.
 *
 * Scope is deliberately a *safe subset*: headings, paragraphs, soft/hard
 * breaks, blockquotes, thematic breaks, ordered/unordered lists, fenced code,
 * pipe tables and the inline set (strong, emphasis, strikethrough, inline
 * code, links, bare autolinks, backslash escapes).
 *
 * The parser produces a plain data AST — never HTML — so the UI layer can
 * render it with React elements and no `dangerouslySetInnerHTML`, which makes
 * injection structurally impossible.
 */

export type MdInline =
  | { kind: "text"; value: string }
  | { kind: "break" }
  | { kind: "strong"; children: MdInline[] }
  | { kind: "emphasis"; children: MdInline[] }
  | { kind: "strikethrough"; children: MdInline[] }
  | { kind: "code"; value: string }
  | { kind: "link"; href: string; title?: string; children: MdInline[] }
  | { kind: "image"; src: string; alt: string; title?: string };

export type MdBlock =
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: MdInline[] }
  | { kind: "paragraph"; children: MdInline[] }
  | { kind: "code"; lang?: string; value: string }
  | { kind: "quote"; children: MdBlock[] }
  | { kind: "list"; ordered: boolean; start: number; items: MdInline[][] }
  | { kind: "hr" }
  | {
      kind: "table";
      align: ("left" | "center" | "right" | null)[];
      header: MdInline[][];
      rows: MdInline[][][];
    };

const ESCAPABLE = new Set([
  "\\",
  "`",
  "*",
  "_",
  "~",
  "[",
  "]",
  "(",
  ")",
  "#",
  "+",
  "-",
  ".",
  "!",
  ">",
  "|",
]);

const SAFE_PROTOCOLS = ["http://", "https://", "mailto:"];

function isWord(ch: string | undefined): boolean {
  return !!ch && /[A-Za-z0-9]/.test(ch);
}

function countRun(src: string, at: number, ch: string): number {
  let n = 0;
  while (src[at + n] === ch) n++;
  return n;
}

/** only protocols we are willing to put in an href; everything else is text */
function safeHref(raw: string): string | null {
  const href = raw.trim();
  const lower = href.toLowerCase();
  if (SAFE_PROTOCOLS.some((p) => lower.startsWith(p))) return href;
  // bare `example.com/x` is common in architecture notes — assume https
  if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(href)) return `https://${href}`;
  return null;
}

/**
 * Finds the index of the closing delimiter run matching an opening run of
 * `width` characters. Skips backslash escapes and code spans so ``*`a*b`*``
 * stays literal. The closing run must not be glued to a following word
 * character, mirroring the opening-side rule in `parseInline`.
 */
function findClosing(src: string, from: number, ch: string, width: number): number {
  const needle = ch.repeat(width);
  let i = from;
  while (i < src.length) {
    if (src[i] === "\\") {
      i += 2;
      continue;
    }
    if (src[i] === "`") {
      const open = countRun(src, i, "`");
      const end = src.indexOf("`".repeat(open), i + open);
      i = end === -1 ? i + open : end + open;
      continue;
    }
    if (src.startsWith(needle, i) && !isWord(src[i + width])) return i;
    i++;
  }
  return -1;
}

/**
 * The width consumed by a delimiter run. Using the full run length keeps
 * `***x***` from leaking stray asterisks into the output (it degrades to
 * strong rather than em-wrapping-strong); `~` always pairs in twos.
 */
function delimiterWidth(ch: string, run: number): number {
  if (ch === "~") return 2;
  return run;
}

/** rejects empty emphasis like `****` and whitespace-only spans like `** **` */
function isRenderableSpan(src: string, open: number, width: number, close: number): boolean {
  const inner = src.slice(open + width, close);
  return inner.trim().length > 0 && inner.trim() === inner;
}

function parseLink(
  src: string,
  at: number,
  image: boolean,
): { node: MdInline; next: number } | null {
  const labelEnd = src.indexOf("](", at + 1);
  if (labelEnd === -1 || labelEnd <= at + 1) return null;
  const label = src.slice(at + 1, labelEnd);
  if (label.includes("]") || label.includes("\n")) return null;
  const hrefEnd = src.indexOf(")", labelEnd + 2);
  if (hrefEnd === -1) return null;
  let target = src.slice(labelEnd + 2, hrefEnd).trim();
  let title: string | undefined;
  const quoted = /^(\S*)\s+"([^"]*)"$/.exec(target);
  if (quoted) {
    target = quoted[1];
    title = quoted[2];
  }
  const href = safeHref(target);
  if (!href) return null;
  const node: MdInline = image
    ? { kind: "image", src: href, alt: label, title }
    : { kind: "link", href, title, children: parseInline(label) };
  return { node, next: hrefEnd + 1 };
}

function bareAutolink(src: string, at: number): { node: MdInline; next: number } | null {
  const match = /^(https?:\/\/[^\s<>()[\]]+)/.exec(src.slice(at));
  if (!match) return null;
  // trailing punctuation is sentence punctuation, not part of the URL
  const url = match[1].replace(/[.,;:!?]+$/, "");
  if (!url) return null;
  return {
    node: { kind: "link", href: safeHref(url) ?? url, children: [{ kind: "text", value: url }] },
    next: at + url.length,
  };
}

export function parseInline(src: string): MdInline[] {
  const out: MdInline[] = [];
  let buf = "";
  let i = 0;
  const flush = () => {
    if (buf) {
      out.push({ kind: "text", value: buf });
      buf = "";
    }
  };

  while (i < src.length) {
    const ch = src[i];

    if (ch === "\\" && i + 1 < src.length && ESCAPABLE.has(src[i + 1])) {
      buf += src[i + 1];
      i += 2;
      continue;
    }

    if (ch === "\n") {
      flush();
      out.push({ kind: "break" });
      i++;
      continue;
    }

    if (ch === "`") {
      const run = countRun(src, i, "`");
      const end = src.indexOf("`".repeat(run), i + run);
      if (end !== -1) {
        flush();
        const value = src.slice(i + run, end).trim();
        if (value) out.push({ kind: "code", value });
        else buf += src.slice(i, end + run);
        i = end + run;
        continue;
      }
    }

    if (ch === "!" && src[i + 1] === "[") {
      const image = parseLink(src, i + 1, true);
      if (image) {
        flush();
        out.push(image.node);
        i = image.next;
        continue;
      }
    }

    if (ch === "[") {
      const link = parseLink(src, i, false);
      if (link) {
        flush();
        out.push(link.node);
        i = link.next;
        continue;
      }
    }

    if (ch === "h" && (src.startsWith("http://", i) || src.startsWith("https://", i))) {
      const auto = bareAutolink(src, i);
      if (auto) {
        flush();
        out.push(auto.node);
        i = auto.next;
        continue;
      }
    }

    // a delimiter glued to a preceding word char is a literal (`2*3`, `snake_case`)
    if ((ch === "*" || ch === "_" || ch === "~") && !isWord(src[i - 1])) {
      const run = countRun(src, i, ch);
      const width = delimiterWidth(ch, run);
      const close = findClosing(src, i + width, ch, width);
      if (close !== -1 && isRenderableSpan(src, i, width, close)) {
        flush();
        const children = parseInline(src.slice(i + width, close));
        const node: MdInline =
          width === 2 && ch !== "~"
            ? { kind: "strong", children }
            : ch === "~"
              ? { kind: "strikethrough", children }
              : { kind: "emphasis", children };
        out.push(node);
        i = close + width;
        continue;
      }
    }

    buf += ch;
    i++;
  }

  flush();
  return out;
}

function isThematicBreak(line: string): boolean {
  return /^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line);
}

function listMarker(line: string): { ordered: boolean; start: number; content: string } | null {
  const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
  if (bullet) return { ordered: false, start: 1, content: bullet[1] };
  const numbered = /^\s*(\d{1,9})[.)]\s+(.*)$/.exec(line);
  if (numbered) return { ordered: true, start: parseInt(numbered[1], 10), content: numbered[2] };
  return null;
}

function alignOf(cell: string): "left" | "center" | "right" | null {
  const c = cell.trim();
  const left = c.startsWith(":");
  const right = c.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return null;
}

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
      continue;
    }
    if (s[i] === "|") {
      cells.push(cur.trim());
      cur = "";
      continue;
    }
    cur += s[i];
  }
  cells.push(cur.trim());
  return cells;
}

function looksLikeTableDivider(line: string | undefined): boolean {
  if (line === undefined) return false;
  const s = line.trim();
  if (!/^\|?[\s:|-]*\|[\s:|-]*$/.test(s)) return false;
  return s.includes("-");
}

function startsNewBlock(line: string): boolean {
  return (
    /^\s*(`{3,}|~{3,})/.test(line) ||
    /^#{1,6}\s/.test(line) ||
    isThematicBreak(line) ||
    /^\s*>/.test(line) ||
    listMarker(line) !== null
  );
}

/** true when the line terminates an open paragraph (list/quote/table start) */
function endsParagraph(lines: string[], index: number): boolean {
  if (startsNewBlock(lines[index])) return true;
  const next = lines[index + 1];
  if (next === undefined) return false;
  if (next.trim() === "") return true;
  if (next.includes("|") && looksLikeTableDivider(lines[index + 2])) return true;
  return false;
}

function parseBlocks(lines: string[]): MdBlock[] {
  const blocks: MdBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    const fence = /^\s*(`{3,}|~{3,})\s*([A-Za-z0-9_+#.-]*)\s*$/.exec(line);
    if (fence) {
      const marker = fence[1][0];
      const min = fence[1].length;
      const lang = fence[2] || undefined;
      const body: string[] = [];
      i++;
      while (i < lines.length) {
        const t = lines[i].trim();
        if (t.length >= min && countRun(t, 0, marker) === t.length) {
          i++;
          break;
        }
        body.push(lines[i]);
        i++;
      }
      blocks.push({ kind: "code", lang, value: body.join("\n") });
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        children: parseInline(heading[2].trim()),
      });
      i++;
      continue;
    }

    if (isThematicBreak(line)) {
      blocks.push({ kind: "hr" });
      i++;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        inner.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push({ kind: "quote", children: parseBlocks(inner) });
      continue;
    }

    const marker = listMarker(line);
    if (marker) {
      const items: MdInline[][] = [];
      while (i < lines.length) {
        const m = listMarker(lines[i]);
        if (!m || m.ordered !== marker.ordered) break;
        items.push(parseInline(m.content));
        i++;
      }
      blocks.push({
        kind: "list",
        ordered: marker.ordered,
        start: marker.start,
        items,
      });
      continue;
    }

    if (line.includes("|") && looksLikeTableDivider(lines[i + 1])) {
      const header = splitRow(line).map(parseInline);
      const align = splitRow(lines[i + 1]).map(alignOf);
      i += 2;
      const rows: MdInline[][][] = [];
      while (i < lines.length && lines[i].trim() !== "" && lines[i].includes("|")) {
        const cells = splitRow(lines[i]);
        while (cells.length < header.length) cells.push("");
        rows.push(cells.slice(0, header.length).map(parseInline));
        i++;
      }
      blocks.push({ kind: "table", align, header, rows });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !endsParagraph(lines, i)) {
      para.push(lines[i].trim());
      i++;
    }
    if (para.length === 0) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ kind: "paragraph", children: parseInline(para.join("\n")) });
  }

  return blocks;
}

/** parses a markdown document into the block AST consumed by the preview */
export function parseMarkdown(src: string): MdBlock[] {
  return parseBlocks(src.replace(/\r\n?/g, "\n").split("\n"));
}

/** true when the source has no markdown construct worth highlighting */
export function isPlainText(src: string): boolean {
  return parseBlocks(src.replace(/\r\n?/g, "\n").split("\n")).every(
    (b) => b.kind === "paragraph" && b.children.every((c) => c.kind === "text"),
  );
}
