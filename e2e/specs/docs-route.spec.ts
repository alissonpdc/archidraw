import { test, expect, open, pressPasteText, importFile, type Page } from "../fixtures";

// `/docs` entrega o markdown-fonte cru (sem render de SPA). Estes testes leem
// esse markdown direto pelo canal HTTP e validam que os exemplos JSON continuam
// sendo aceitos pelos parsers reais (import/paste).
async function fetchDocsMarkdown(request: import("@playwright/test").APIRequestContext) {
  const res = await request.get("/docs");
  expect(res.status()).toBe(200);
  return await res.text();
}

/** every ```json fence in the markdown source */
function jsonBlocks(md: string): string[] {
  const blocks: string[] = [];
  const re = /```json\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) blocks.push(m[1].trim());
  return blocks;
}

/** first json block containing all `required` and none of `excluded` */
function pickJson(md: string, required: string[], excluded: string[] = []): string | null {
  return (
    jsonBlocks(md).find(
      (b) =>
        required.every((m) => b.includes(m)) &&
        excluded.every((m) => !b.includes(m)),
    ) ?? null
  );
}

test.describe("docs markdown source", () => {
  test("documents every element type, enum and schema marker", async ({ request }) => {
    const md = await fetchDocsMarkdown(request);

    for (const type of [
      "rectangle",
      "diamond",
      "ellipse",
      "line",
      "arrow",
      "text",
      "component",
      "context",
    ]) {
      expect(md, `element type ${type} documented`).toContain(type);
    }

    for (const value of [
      "archidraw/elements",
      "activeTabId",
      "schemaVersion",
      "dashdot",
      "cross-hachure",
      "hachure",
      "triangle",
      "curved",
      "top-left",
      "internal",
      "external",
      "archidraw:workspace",
    ]) {
      expect(md, `syntax token ${value} documented`).toContain(value);
    }

    for (const field of [
      "strokeColor",
      "backgroundColor",
      "strokeWidth",
      "strokeOpacity",
      "fillOpacity",
      "borderRadius",
      "roughness",
      "labelT",
      "controlPoint",
      "bendPoints",
      "startBinding",
      "endBinding",
      "startArrowhead",
      "endArrowhead",
      "componentId",
      "childIds",
      "labelPosition",
      "labelSide",
      "textVAlign",
      "lineSpacing",
      "captionPosition",
    ]) {
      expect(md, `field ${field} documented`).toContain(field);
    }
  });

  test("documents the .archidraw workspace file format guidance", async ({ request }) => {
    const md = await fetchDocsMarkdown(request);

    for (const token of [
      "the reference set to copy",
      "Omitting them is safe",
      "Open never recomputes membership",
      "the tab order decides",
      "The box never wraps",
      "sits inside the box",
      "the only place `captionPosition` applies",
      "bottom-right corner",
      "edges included",
    ]) {
      expect(md, `workspace token ${token} documented`).toContain(token);
    }
  });

  test("documents the .archidrawlib library file format", async ({ request }) => {
    const md = await fetchDocsMarkdown(request);

    for (const token of [
      ".archidrawlib",
      "libraryItems",
      "roundness",
      "cross-hatch",
      "Invalid library file",
      "fontSize × 0.6 × text.length",
      "smooths the vertices",
      "first point equals the last",
      "Arcs and silhouettes",
      "black fill, no stroke",
      "Tuples and objects may be mixed inside one array",
      "an open contour never fills either",
    ]) {
      expect(md, `library token ${token} documented`).toContain(token);
    }

    expect(md, "5.3 layout section present").toContain("5.3 Layout and rendering rules");
  });

  test("documents the POST /validate endpoint contract", async ({ request }) => {
    const md = await fetchDocsMarkdown(request);

    // heading e metodo/path
    expect(md, "7 heading present").toContain(
      "## 7. Validation endpoint (`POST /validate`)",
    );
    expect(md, "method documented").toContain("POST /validate");

    // campos do veredicto
    for (const field of ["valid", "format", "errors", "warnings", "summary", "rule"]) {
      expect(md, `response field ${field} documented`).toContain(field);
    }

    // todos os valores de `format`
    for (const format of [
      "workspace",
      "workspace-legacy",
      "library",
      "clipboard",
      "element",
      "unknown",
    ]) {
      expect(md, `format value ${format} documented`).toContain(format);
    }

    // contrato HTTP: status e limites
    for (const token of ["400", "405", "413", "8 MB"]) {
      expect(md, `http token ${token} documented`).toContain(token);
    }

    // disponibilidade: /validate roda no servidor Node de produção, não é só dev
    expect(md, "production node server documented").toContain("Node server");
    expect(md, "atomic clipboard rule referenced").toContain("atomic");
  });

  test("the 7.1 response example is text, not a ```json block the parsers would consume", async ({
    request,
  }) => {
    const md = await fetchDocsMarkdown(request);
    // a fence de 7.1 e uma resposta (tem "valid"/"errors"), nao um payload de
    // entrada; por isso e ``` e nao ```json — senao o suite de exemplos tentaria
    // parsea-la como workspace/biblioteca e falharia.
    const section = md.slice(md.indexOf("### 7.1 Response shape"));
    const fence = section.slice(0, section.indexOf("### 7.2"));
    expect(fence, "7.1 exists").toContain('"valid": false');
    expect(fence, "7.1 is a plain fence").toMatch(/\n```\n/);
    expect(fence, "7.1 is not a json fence").not.toMatch(/\n```json\n/);
  });

  test("library file example imports through the library panel", async ({
    request,
    page,
  }) => {
    const md = await fetchDocsMarkdown(request);
    const json = pickJson(md, [
      '"type": "archidrawlib"',
      '"libraryItems"',
      '"name": "Invoke"',
    ]);
    expect(json).toBeTruthy();

    const parsed = JSON.parse(json!);
    expect(parsed.schemaVersion).toBeUndefined();
    expect(parsed.version).toBe(2);
    expect(parsed.libraryItems.length).toBeGreaterThanOrEqual(2);
    for (const item of parsed.libraryItems) {
      expect(typeof item.name).toBe("string");
      expect(item.elements.length).toBeGreaterThan(0);
    }

    await open(page);
    await page.keyboard.press("l");
    await expect(page.locator(".library-panel")).toBeVisible();

    await page.locator('[data-testid="library-import"]').click();
    await page
      .locator(".library-import-input")
      .setInputFiles({
        name: "docs-example.archidrawlib",
        mimeType: "application/json",
        buffer: Buffer.from(json!, "utf8"),
      });

    const group = page.locator('[data-testid="library-imported-group"]');
    await expect(group).toHaveCount(1);
    await expect(group.locator(".library-tile")).toHaveCount(
      parsed.libraryItems.length,
    );

    const svg = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("archidraw:importedLibraries") || "[]")
        .flatMap((l: { items: { svg: string }[] }) => l.items)
        .map((it: { svg: string }) => it.svg)
        .join("\n"),
    );
    expect(svg).not.toContain("NaN");
    expect(svg).not.toContain("undefined");
    expect(svg).toContain("<svg");
  });

  test("clipboard envelope example pastes all eight element types", async ({
    request,
    page,
    editorState,
  }) => {
    const md = await fetchDocsMarkdown(request);
    const json = pickJson(md, ['"archidraw/elements"', '"el_ctx"']);
    expect(json).toBeTruthy();

    await open(page);
    expect((await editorState()).elementCount).toBe(0);

    await pressPasteText(page, json!);

    const state = await editorState();
    expect(state.elementCount).toBe(8);
    expect(state.elements.map((e) => e.type).sort()).toEqual([
      "arrow",
      "component",
      "context",
      "diamond",
      "ellipse",
      "line",
      "rectangle",
      "text",
    ]);
    expect(state.selectedIds.length).toBe(8);
  });

  test("bare array and single element examples paste", async ({
    request,
    page,
    editorState,
  }) => {
    const md = await fetchDocsMarkdown(request);
    const arrayJson = pickJson(md, ['"label": "A"', '"label": "B"']);
    const singleJson = pickJson(md, ['"text": "hello"']);
    expect(arrayJson).toBeTruthy();
    expect(singleJson).toBeTruthy();

    await open(page);

    await pressPasteText(page, arrayJson!);
    expect((await editorState()).elementCount).toBe(2);

    await pressPasteText(page, singleJson!);
    const state = await editorState();
    expect(state.elementCount).toBe(3);
    expect(state.elements[2].type).toBe("text");
  });

  test("complete workspace example imports as a new diagram", async ({
    request,
    page,
    editorState,
  }) => {
    const md = await fetchDocsMarkdown(request);
    const json = pickJson(md, ['"activeTabId"', '"componentId"']);
    expect(json).toBeTruthy();

    const parsed = JSON.parse(json!);
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.tabs).toHaveLength(1);
    const expectedTypes = parsed.tabs[0].doc.elements.map((el: { type: string }) => el.type);
    expect(expectedTypes).toHaveLength(8);

    await open(page);
    const before = await editorState();
    expect(before.tabs).toHaveLength(1);

    await importFile(page, {
      name: "docs-example.archidraw",
      mimeType: "application/json",
      buffer: Buffer.from(json!, "utf8"),
    });

    const state = await editorState();
    expect(state.tabs).toHaveLength(2);
    expect(state.elementCount).toBe(8);
    expect(state.elements.map((e) => e.type)).toEqual(expectedTypes);
    expect(state.elements.map((e) => e.componentId).filter(Boolean)).toEqual(["ec2"]);
  });

  test("minimal and legacy examples are valid JSON for their schemas", async ({
    request,
  }) => {
    const md = await fetchDocsMarkdown(request);

    const minimal = pickJson(md, ['"name": "Minimal"']);
    const legacy = pickJson(
      md,
      ['"schemaVersion": 1'],
      ['"activeTabId"', '"archidraw/elements"'],
    );
    expect(minimal).toBeTruthy();
    expect(legacy).toBeTruthy();

    const minimalDoc = JSON.parse(minimal!);
    expect(minimalDoc.schemaVersion).toBe(2);
    expect(minimalDoc.tabs[0].doc.elements).toHaveLength(2);

    const legacyDoc = JSON.parse(legacy!);
    expect(legacyDoc.schemaVersion).toBe(1);
    expect(legacyDoc.doc.elements).toHaveLength(0);
  });
});
