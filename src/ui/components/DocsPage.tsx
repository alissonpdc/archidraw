import { useEffect, useMemo } from "react";
import docSource from "../../docs/archidraw-syntax.md?raw";
import { Markdown, slugify } from "./Markdown";
import "../styles/docs.css";

type IndexEntry = { level: 2 | 3; text: string; slug: string };
type IndexNode = { entry: IndexEntry; children: IndexNode[] };

/** section index (h2/h3) built from the markdown source, code fences skipped */
function parseIndex(source: string): IndexEntry[] {
  const entries: IndexEntry[] = [];
  let inFence = false;
  for (const line of source.split("\n")) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{2,3})\s+(.+)$/.exec(line);
    if (!m) continue;
    const text = m[2].replace(/`/g, "").trim();
    entries.push({ level: m[1].length as 2 | 3, text, slug: slugify(text) });
  }
  return entries;
}

/** h3 entries nest under the h2 that precedes them */
function nest(entries: IndexEntry[]): IndexNode[] {
  const roots: IndexNode[] = [];
  for (const entry of entries) {
    const node: IndexNode = { entry, children: [] };
    const last = roots[roots.length - 1];
    if (entry.level === 3 && last) last.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function renderNode(node: IndexNode) {
  return (
    <li key={node.entry.slug}>
      <a href={`#${node.entry.slug}`}>{node.entry.text}</a>
      {node.children.length > 0 && (
        <ul>{node.children.map(renderNode)}</ul>
      )}
    </li>
  );
}

export function DocsPage() {
  useEffect(() => {
    document.title = "Archidraw — File and Clipboard Syntax Reference";
  }, []);

  const index = useMemo(() => nest(parseIndex(docSource)), []);

  return (
    <div className="docs" data-testid="docs-page">
      <header className="docs__bar">
        <span className="docs__brand">Archidraw syntax reference</span>
        <a className="docs__link" href="/">
          Open editor
        </a>
      </header>
      <div className="docs__layout">
        <nav
          className="docs__index"
          data-testid="docs-index"
          aria-label="Section index"
        >
          <p className="docs__index-title">On this page</p>
          <ul className="docs__index-list">{index.map(renderNode)}</ul>
        </nav>
        <main className="docs__body">
          <Markdown source={docSource} headingOffset={0} />
        </main>
      </div>
    </div>
  );
}
