import { test, expect } from "../fixtures";

// `/docs` must hand back the raw markdown source with a machine-readable
// content type so agents can read it without executing any JS (no SPA render).
test.describe("docs raw markdown", () => {
  test("/docs serves the markdown source as text/markdown", async ({ request }) => {
    const res = await request.get("/docs");
    expect(res.status()).toBe(200);

    const contentType = res.headers()["content-type"] ?? "";
    expect(contentType, "served as markdown").toContain("text/markdown");

    const body = await res.text();
    // it is the literal source, not an HTML shell
    expect(body).toContain("# Archidraw File and Clipboard Syntax Reference");
    expect(body).toContain("libraryItems");
    expect(body).toContain("## 1. Formats at a glance");
    expect(body, "no SPA root div").not.toContain('<div id="root"');
    expect(body, "starts as markdown, not html").not.toMatch(/^\s*<!doctype html>/i);
  });

  test("/docs.md is an alias of the same markdown", async ({ request }) => {
    const [a, b] = await Promise.all([
      request.get("/docs"),
      request.get("/docs.md"),
    ]);
    expect(b.status()).toBe(200);
    expect(b.headers()["content-type"] ?? "").toContain("text/markdown");
    expect(await b.text()).toBe(await a.text());
  });
});
