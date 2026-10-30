import { test, expect } from "../fixtures";

const SLUGS = [
  "index",
  "recomendations",
  "workspace",
  "elements",
  "clipboard",
  "library",
  "lib-svg",
  "lib-native",
  "validation",
];

test.describe("ai raw markdown routes (/ai and /ai/<slug>.md)", () => {
  test("/ai serves the compiled markdown source as text/markdown", async ({ request }) => {
    const res = await request.get("/ai");
    expect(res.status()).toBe(200);

    const contentType = res.headers()["content-type"] ?? "";
    expect(contentType, "served as markdown").toContain("text/markdown");

    const body = await res.text();
    expect(body).toContain("# Archidraw File and Clipboard Syntax Reference");
    expect(body).toContain("## 0. Modular AI Documentation Map (`/ai` & `/ai/<slug>.md`)");
    expect(body).toContain("libraryItems");
    expect(body).toContain("## 1. Formats at a glance");
    expect(body, "no SPA root div").not.toContain('<div id="root"');
    expect(body, "starts as markdown, not html").not.toMatch(/^\s*<!doctype html>/i);
  });

  test("every /ai/<slug>.md module is served as truncation-safe text/markdown", async ({
    request,
  }) => {
    const fullRes = await request.get("/ai");
    const fullText = await fullRes.text();

    for (const slug of SLUGS) {
      const res = await request.get(`/ai/${slug}.md`);
      expect(res.status(), `/ai/${slug}.md status`).toBe(200);
      expect(res.headers()["content-type"] ?? "").toContain("text/markdown");
      const text = await res.text();
      expect(text.length, `/ai/${slug}.md non-empty`).toBeGreaterThan(500);
      expect(text.length, `/ai/${slug}.md under 46KB truncation limit`).toBeLessThan(46080);
      expect(fullText).toContain(text.trim());
    }
  });

  test("rejects /ai/<slug> without .md and unknown /ai/<slug>.md with 404 guide", async ({
    request,
  }) => {
    for (const badPath of ["/ai/workspace", "/ai/elements", "/ai/unknown.md"]) {
      const res = await request.get(badPath);
      expect(res.status(), badPath).toBe(404);
      expect(res.headers()["content-type"] ?? "").toContain("text/markdown");
      const body = await res.text();
      expect(body).toContain("/ai/workspace.md");
    }
  });

  test("removes legacy /docs and /docs.md markdown routes", async ({ request }) => {
    for (const oldPath of ["/docs", "/docs.md", "/ai.md"]) {
      const res = await request.get(oldPath);
      const contentType = res.headers()["content-type"] ?? "";
      expect(contentType, `${oldPath} is not served as text/markdown`).not.toContain(
        "text/markdown",
      );
    }
  });
});
