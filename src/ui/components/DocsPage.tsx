import { useEffect } from "react";
import docSource from "../../docs/archidraw-syntax.md?raw";
import { Markdown } from "./Markdown";
import "../styles/docs.css";

export function DocsPage() {
  useEffect(() => {
    document.title = "Archidraw — File and Clipboard Syntax Reference";
  }, []);

  return (
    <div className="docs" data-testid="docs-page">
      <header className="docs__bar">
        <span className="docs__brand">Archidraw syntax reference</span>
        <a className="docs__link" href="/">
          Open editor
        </a>
      </header>
      <main className="docs__body">
        <Markdown source={docSource} headingOffset={0} />
      </main>
    </div>
  );
}
