import { useMemo, type ReactNode } from "react";
import { parseMarkdown, type MdBlock, type MdInline } from "../../core/markdown";

function renderInline(nodes: MdInline[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (node.kind) {
      case "text":
        return <span key={key}>{node.value}</span>;
      case "break":
        return <br key={key} />;
      case "strong":
        return <strong key={key}>{renderInline(node.children, key)}</strong>;
      case "emphasis":
        return <em key={key}>{renderInline(node.children, key)}</em>;
      case "strikethrough":
        return <s key={key}>{renderInline(node.children, key)}</s>;
      case "code":
        return (
          <code key={key} className="md-code-inline">
            {node.value}
          </code>
        );
      case "link":
        return (
          <a
            key={key}
            className="md-link"
            href={node.href}
            title={node.title ?? node.href}
            target="_blank"
            rel="noreferrer noopener"
          >
            {renderInline(node.children, key)}
          </a>
        );
      case "image":
        return (
          <span key={key} className="md-image" title={node.src}>
            {node.alt || "image"}
          </span>
        );
    }
  });
}

function renderBlock(block: MdBlock, i: number): ReactNode {
  const key = `b${i}`;
  switch (block.kind) {
    case "heading": {
      const Tag = `h${Math.min(block.level + 2, 6)}` as "h3" | "h4" | "h5" | "h6";
      return (
        <Tag key={key} className={`md-h md-h${block.level}`}>
          {renderInline(block.children, key)}
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p key={key} className="md-p">
          {renderInline(block.children, key)}
        </p>
      );
    case "code":
      return (
        <pre key={key} className="md-pre" data-lang={block.lang}>
          <code>{block.value}</code>
        </pre>
      );
    case "quote":
      return (
        <blockquote key={key} className="md-quote">
          {block.children.map(renderBlock)}
        </blockquote>
      );
    case "list": {
      const items = block.items.map((item, j) => (
        <li key={`${key}-${j}`} className="md-li">
          {renderInline(item, `${key}-${j}`)}
        </li>
      ));
      return block.ordered ? (
        <ol key={key} className="md-ol" start={block.start}>
          {items}
        </ol>
      ) : (
        <ul key={key} className="md-ul">
          {items}
        </ul>
      );
    }
    case "hr":
      return <hr key={key} className="md-hr" />;
    case "table":
      return (
        <table key={key} className="md-table">
          <thead>
            <tr>
              {block.header.map((cell, j) => (
                <th key={`${key}-h${j}`} style={alignStyle(block.align[j])}>
                  {renderInline(cell, `${key}-h${j}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={`${key}-r${r}`}>
                {row.map((cell, c) => (
                  <td key={`${key}-r${r}c${c}`} style={alignStyle(block.align[c])}>
                    {renderInline(cell, `${key}-r${r}c${c}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
  }
}

function alignStyle(align: "left" | "center" | "right" | null | undefined) {
  return align ? { textAlign: align } : undefined;
}

/**
 * Renders a markdown source as React elements. No `innerHTML` anywhere, so
 * the source is never interpreted as markup.
 */
export function Markdown({ source }: { source: string }) {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  return <div className="md-root">{blocks.map(renderBlock)}</div>;
}
