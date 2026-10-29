import { test, expect, open, type Page } from "../fixtures";

// window.archidrawValidate: o agente manda um payload (workspace/biblioteca/clipboard/
// elemento) e recebe {valid, format, errors, warnings, summary} diretamente in-browser.
// Espelha as regras de rejeição documentadas em /docs (Seções 2–5) e coerência com Ctrl+V / Open file.
async function callValidate(page: Page, payload: unknown) {
  return page.evaluate((data) => {
    return (window as unknown as { archidrawValidate: (d: unknown) => unknown }).archidrawValidate(data);
  }, payload) as Promise<{
    valid: boolean;
    format: string;
    errors: { path: string; message: string; rule?: string }[];
    warnings: { path: string; message: string; rule?: string }[];
    summary: Record<string, number>;
  }>;
}

test.describe("In-browser validation (window.archidrawValidate)", () => {
  test("accepts a valid workspace schema 2", async ({ page }) => {
    await open(page);
    const body = await callValidate(page, {
      schemaVersion: 2,
      activeTabId: "tab_1",
      tabs: [
        {
          id: "tab_1",
          name: "Diagram",
          doc: {
            schemaVersion: 1,
            elements: [
              { id: "a", type: "rectangle", x: 0, y: 0, width: 100, height: 50 },
            ],
          },
          camera: { scrollX: 0, scrollY: 0, zoom: 1 },
        },
      ],
    });
    expect(body.format).toBe("workspace");
    expect(body.valid).toBe(true);
    expect(body.errors).toEqual([]);
    expect(body.summary.elements).toBe(1);
    expect(body.summary.tabs).toBe(1);
  });

  test("validates legacy schemaVersion 1 workspace", async ({ page }) => {
    await open(page);
    const body = await callValidate(page, {
      schemaVersion: 1,
      doc: {
        schemaVersion: 1,
        elements: [{ id: "a", type: "rectangle", x: 0, y: 0, width: 10, height: 10 }],
      },
      camera: { scrollX: 0, scrollY: 0, zoom: 1 },
    });
    expect(body.format).toBe("workspace-legacy");
    expect(body.valid).toBe(true);
    expect(body.warnings.some((w) => w.rule === "2.3")).toBe(true);
  });

  test("rejects workspace with invalid envelope fields and unaligned activeTabId", async ({ page }) => {
    await open(page);
    // activeTabId não-string e tabs vazio
    const res1 = await callValidate(page, {
      schemaVersion: 2,
      activeTabId: 123,
      tabs: [],
    });
    expect(res1.valid).toBe(false);
    expect(res1.errors.some((e) => e.path === "activeTabId")).toBe(true);
    expect(res1.errors.some((e) => e.path === "tabs")).toBe(true);

    // tab não-objeto e activeTabId não-correspondente
    const res2 = await callValidate(page, {
      schemaVersion: 2,
      activeTabId: "tab_nonexistent",
      tabs: [
        null,
        {
          id: "tab_1",
          name: "Tab",
          doc: null, // doc não-objeto
          camera: { scrollX: "0", scrollY: 0, zoom: 1 },
        },
      ],
    });
    expect(res2.valid).toBe(false);
    expect(res2.errors.some((e) => e.path.includes("tabs[0]"))).toBe(true);
    expect(res2.errors.some((e) => e.path.includes("doc"))).toBe(true);
    expect(res2.warnings.some((w) => w.path === "activeTabId")).toBe(true);

    // doc.elements não array
    const res3 = await callValidate(page, {
      schemaVersion: 2,
      activeTabId: "tab_1",
      tabs: [
        {
          id: "tab_1",
          name: "Tab",
          doc: { schemaVersion: 1, elements: "not an array" },
          camera: { scrollX: 0, scrollY: 0, zoom: 1 },
        },
      ],
    });
    expect(res3.valid).toBe(false);
    expect(res3.errors.some((e) => e.path.includes("doc.elements"))).toBe(true);
  });

  test("rejects a workspace with a missing camera and bad type, naming both", async ({ page }) => {
    await open(page);
    const body = await callValidate(page, {
      schemaVersion: 2,
      activeTabId: "t",
      tabs: [
        {
          id: "t",
          name: "D",
          doc: { schemaVersion: 1, elements: [{ id: "a", type: "banana", x: 0, y: 0, width: 1, height: 1 }] },
          // camera ausente
        },
      ],
    });
    expect(body.valid).toBe(false);
    const paths = body.errors.map((e) => e.path);
    expect(paths.some((p) => p.includes("camera"))).toBe(true);
    expect(paths.some((p) => p.includes(".type"))).toBe(true);
    const typeErr = body.errors.find((e) => e.path.endsWith(".type"))!;
    expect(typeErr.message).toContain("banana");
    expect(typeErr.message).toContain("rectangle");
    expect(typeErr.rule).toBe("3.4");
  });

  test("validates a workspace with a tab missing name and non-finite geometry", async ({ page }) => {
    await open(page);
    const body = await callValidate(page, {
      schemaVersion: 2,
      activeTabId: "t",
      tabs: [
        {
          id: "t",
          // name ausente
          doc: { schemaVersion: 1, elements: [{ id: "a", type: "rectangle", x: "NaN", y: 0, width: 10, height: 10 }] },
          camera: { scrollX: 0, scrollY: 0, zoom: 1 },
        },
      ],
    });
    expect(body.valid).toBe(false);
    const errPaths = body.errors.map((e) => e.path);
    expect(errPaths).toContain("tabs[0].name");
    const warnPaths = body.warnings.map((w) => w.path);
    expect(warnPaths.some((p) => p.includes("elements[0].x"))).toBe(true);
  });

  test("warns that an item without archidrawElements inserts as a static image (rule 5.1)", async ({
    page,
  }) => {
    await open(page);
    const body = await callValidate(page, {
      type: "archidrawlib",
      version: 2,
      libraryItems: [
        {
          name: "Raster",
          elements: [{ type: "rectangle", x: 0, y: 0, width: 10, height: 10, opacity: 100 }],
        },
      ],
    });
    expect(body.format).toBe("library");
    expect(body.valid).toBe(true);
    expect(body.errors).toEqual([]);
    const warn = body.warnings.find((w) => w.rule === "5.1");
    expect(warn).toBeTruthy();
    expect(warn?.path).toBe("libraryItems[0]");
    expect(warn?.message).toContain("archidrawElements");
  });

  test("does not warn about raster items when the item carries native elements (rule 5.1)", async ({
    page,
  }) => {
    await open(page);
    const body = await callValidate(page, {
      type: "archidrawlib",
      version: 2,
      libraryItems: [
        {
          name: "Native",
          archidrawElements: [
            {
              id: "n1",
              type: "rectangle",
              x: 0,
              y: 0,
              width: 80,
              height: 40,
              strokeColor: "#3d4248",
              backgroundColor: "#dfe0e2",
              strokeWidth: 2,
              opacity: 1,
              strokeOpacity: 1,
              fillOpacity: 0,
              strokeStyle: "solid",
              fillStyle: "solid",
              roughness: 1,
              borderRadius: 0,
            },
          ],
        },
      ],
    });
    expect(body.valid).toBe(true);
    expect(body.errors).toEqual([]);
    expect(body.summary.items).toBe(1);
    expect(body.summary.elements).toBe(1);
    expect(body.warnings.some((w) => w.rule === "5.1")).toBe(false);
  });

  test("accepts a valid .archidrawlib and reports counts", async ({ page }) => {
    await open(page);
    const body = await callValidate(page, {
      type: "archidrawlib",
      version: 2,
      libraryItems: [
        { name: "Box", elements: [{ type: "rectangle", x: 0, y: 0, width: 10, height: 10, opacity: 100 }] },
        { name: "Arrow", elements: [{ type: "arrow", x: 0, y: 0, width: 10, height: 0, points: [[0, 0], [10, 0]] }] },
      ],
    });
    expect(body.format).toBe("library");
    expect(body.valid).toBe(true);
    expect(body.summary.items).toBe(2);
    expect(body.summary.elements).toBe(2);
  });

  test("handles library edge cases (empty items, array of arrays, invalid points, invalid opacity)", async ({
    page,
  }) => {
    await open(page);
    // raiz array de arrays (formato v1)
    const res1 = await callValidate(page, [
      [{ type: "rectangle", x: 0, y: 0, width: 10, height: 10 }],
    ]);
    expect(res1.format).toBe("library");
    expect(res1.valid).toBe(true);

    // libraryItems vazio
    const res2 = await callValidate(page, { type: "archidrawlib", libraryItems: [] });
    expect(res2.valid).toBe(false);
    expect(res2.errors[0].message).toContain("libraryItems vazio");

    // item sem elements nem archidrawElements
    const res3 = await callValidate(page, {
      type: "archidrawlib",
      libraryItems: [{ name: "Empty" }],
    });
    expect(res3.valid).toBe(false);
    expect(res3.warnings.some((w) => w.message.includes("sem archidrawElements"))).toBe(true);
    expect(res3.errors.some((e) => e.message.includes("nenhum elemento sobrevive"))).toBe(true);

    // item nem array nem objeto
    const res4 = await callValidate(page, {
      type: "archidrawlib",
      libraryItems: ["invalid item"],
    });
    expect(res4.valid).toBe(false);
    expect(res4.warnings.some((w) => w.message.includes("nem array nem objeto"))).toBe(true);

    // points < 2 e opacity inválida em elemento raster de lib
    const res5 = await callValidate(page, {
      type: "archidrawlib",
      libraryItems: [
        {
          elements: [
            { type: "line", x: 0, y: 0, width: 10, height: 10, points: [[0, 0]], opacity: 150 },
          ],
        },
      ],
    });
    expect(res5.warnings.some((w) => w.path.includes("points"))).toBe(true);
    expect(res5.warnings.some((w) => w.path.includes("opacity"))).toBe(true);
  });

  test("flags a library root with no libraryItems as invalid (rule 5.4)", async ({ page }) => {
    await open(page);
    const body = await callValidate(page, { type: "archidrawlib", version: 2, foo: 1 });
    expect(body.format).toBe("library");
    expect(body.valid).toBe(false);
    expect(body.errors[0].message).toContain("libraryItems");
    expect(body.errors[0].rule).toBe("5.4");
  });

  test("does not reject the whole library for a single bad element (rule 5.4), only warns", async ({ page }) => {
    await open(page);
    const body = await callValidate(page, {
      libraryItems: [
        {
          name: "Mixed",
          elements: [
            { type: "rectangle", x: 0, y: 0, width: 10, height: 10 },
            { type: "not-a-type", x: 0, y: 0 },
          ],
        },
      ],
    });
    expect(body.valid).toBe(true);
    expect(body.errors).toEqual([]);
    expect(body.warnings.length).toBeGreaterThan(0);
    expect(body.warnings.some((w) => w.message.includes("not-a-type"))).toBe(true);
  });

  test("accepts a valid clipboard envelope and counts elements", async ({ page }) => {
    await open(page);
    const body = await callValidate(page, {
      schemaVersion: 1,
      type: "archidraw/elements",
      elements: [
        { id: "a", type: "rectangle", x: 0, y: 0, width: 10, height: 10 },
        { id: "b", type: "text", x: 0, y: 0, width: 10, height: 10, text: "hi", fontSize: 20 },
      ],
    });
    expect(body.format).toBe("clipboard");
    expect(body.valid).toBe(true);
    expect(body.summary.elements).toBe(2);
  });

  test("handles empty clipboard and invalid element objects", async ({ page }) => {
    await open(page);
    const res1 = await callValidate(page, {
      schemaVersion: 1,
      type: "archidraw/elements",
      elements: [],
    });
    expect(res1.valid).toBe(false);
    expect(res1.errors.some((e) => e.path === "elements")).toBe(true);

    const res2 = await callValidate(page, {
      schemaVersion: 1,
      type: "archidraw/elements",
      elements: ["not an element"],
    });
    expect(res2.valid).toBe(false);
    expect(res2.errors.some((e) => e.message.includes("não é um objeto elemento"))).toBe(true);
  });

  test("clipboard is atomic: one bad type rejects the entire payload (rule 4.3)", async ({ page }) => {
    await open(page);
    const body = await callValidate(page, {
      schemaVersion: 1,
      type: "archidraw/elements",
      elements: [
        { id: "a", type: "rectangle", x: 0, y: 0, width: 10, height: 10 },
        { id: "b", type: "hexagon", x: 0, y: 0, width: 10, height: 10 },
      ],
    });
    expect(body.format).toBe("clipboard");
    expect(body.valid).toBe(false);
    expect(body.errors.some((e) => e.path.includes("elements[1].type"))).toBe(true);
  });

  test("a single element object is detected and validated as element", async ({ page }) => {
    await open(page);
    const body = await callValidate(page, { id: "a", type: "ellipse", x: 0, y: 0, width: 10, height: 10 });
    expect(body.format).toBe("element");
    expect(body.valid).toBe(true);
  });

  test("a single polygon element is recognized and validated", async ({ page }) => {
    await open(page);
    const body = await callValidate(page, {
      id: "poly1",
      type: "polygon",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rings: [
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 50, y: 100 },
        ],
      ],
    });
    expect(body.format).toBe("element");
    expect(body.valid).toBe(true);
    expect(body.errors).toEqual([]);
  });

  test("inspectElement checks all optional fields, shapes, components, texts and contexts", async ({
    page,
  }) => {
    await open(page);

    // Negative width/height on rectangle, invalid opacity, invalid roughness, invalid borderRadius, invalid enum
    const res1 = await callValidate(page, {
      id: "r1",
      type: "rectangle",
      x: 0,
      y: 0,
      width: -50,
      height: -50,
      opacity: 2,
      roughness: 5,
      borderRadius: 150,
      strokeStyle: "wavy",
      label: 123,
    });
    expect(res1.valid).toBe(true); // Warnings do not invalidate
    expect(res1.warnings.some((w) => w.path.includes("width"))).toBe(true);
    expect(res1.warnings.some((w) => w.path.includes("opacity"))).toBe(true);
    expect(res1.warnings.some((w) => w.path.includes("roughness"))).toBe(true);
    expect(res1.warnings.some((w) => w.path.includes("borderRadius"))).toBe(true);
    expect(res1.warnings.some((w) => w.path.includes("strokeStyle"))).toBe(true);
    expect(res1.warnings.some((w) => w.path.includes("label"))).toBe(true);

    // Polygon rings errors
    const res2 = await callValidate(page, {
      id: "p1",
      type: "polygon",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      rings: "not an array",
    });
    expect(res2.valid).toBe(false);

    const res3 = await callValidate(page, {
      id: "p2",
      type: "polygon",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      rings: [[{ x: 0, y: 0 }]], // < 3 points
    });
    expect(res3.valid).toBe(false);

    // Arrow and edge fields: labelT, bendPoints, controlPoint, bindings, animated
    const res4 = await callValidate(page, {
      id: "arr1",
      type: "arrow",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      labelT: 2,
      bendPoints: "not-array",
      controlPoint: { x: "bad", y: 0 },
      startBinding: "not-object",
      endBinding: { elementId: 123, side: "invalid" },
      animated: "not-boolean",
      startArrowhead: "star",
    });
    expect(res4.valid).toBe(true);
    expect(res4.warnings.some((w) => w.path.includes("labelT"))).toBe(true);
    expect(res4.warnings.some((w) => w.path.includes("bendPoints"))).toBe(true);
    expect(res4.warnings.some((w) => w.path.includes("controlPoint"))).toBe(true);
    expect(res4.warnings.some((w) => w.path.includes("startBinding"))).toBe(true);
    expect(res4.warnings.some((w) => w.path.includes("endBinding"))).toBe(true);
    expect(res4.warnings.some((w) => w.path.includes("animated"))).toBe(true);
    expect(res4.warnings.some((w) => w.path.includes("startArrowhead"))).toBe(true);

    // Text fields: text non-string, fontSize non-number, textAlign
    const res5 = await callValidate(page, {
      id: "t1",
      type: "text",
      x: 0,
      y: 0,
      width: 100,
      height: 30,
      text: 12345,
      fontSize: "large",
      textAlign: "justify",
    });
    expect(res5.valid).toBe(true);
    expect(res5.warnings.some((w) => w.path.includes("text"))).toBe(true);
    expect(res5.warnings.some((w) => w.path.includes("fontSize"))).toBe(true);
    expect(res5.warnings.some((w) => w.path.includes("textAlign"))).toBe(true);

    // Component fields: componentId, src, fill
    const res6 = await callValidate(page, {
      id: "c1",
      type: "component",
      x: 0,
      y: 0,
      width: 60,
      height: 60,
      componentId: 123,
      src: 456,
      fill: "yes",
    });
    expect(res6.valid).toBe(true);
    expect(res6.warnings.some((w) => w.path.includes("componentId"))).toBe(true);
    expect(res6.warnings.some((w) => w.path.includes("src"))).toBe(true);
    expect(res6.warnings.some((w) => w.path.includes("fill"))).toBe(true);

    // Context fields: labelPosition, labelSide, childIds
    const res7 = await callValidate(page, {
      id: "ctx1",
      type: "context",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      labelPosition: "middle",
      labelSide: "center",
      childIds: [123, 456],
    });
    expect(res7.valid).toBe(true);
    expect(res7.warnings.some((w) => w.path.includes("labelPosition"))).toBe(true);
    expect(res7.warnings.some((w) => w.path.includes("labelSide"))).toBe(true);
    expect(res7.warnings.some((w) => w.path.includes("childIds"))).toBe(true);
  });

  test("an unknown payload shape reports invalid with an explanatory error", async ({ page }) => {
    await open(page);
    const body = await callValidate(page, { hello: "world" });
    expect(body.format).toBe("unknown");
    expect(body.valid).toBe(false);
    expect(body.errors[0].message).toContain("envelope");
  });

  test("accepts raw JSON string and parses safely", async ({ page }) => {
    await open(page);
    const rawJson = JSON.stringify({
      schemaVersion: 2,
      activeTabId: "tab_1",
      tabs: [
        {
          id: "tab_1",
          name: "Diagram",
          doc: {
            schemaVersion: 1,
            elements: [
              { id: "a", type: "rectangle", x: 0, y: 0, width: 100, height: 50 },
            ],
          },
          camera: { scrollX: 0, scrollY: 0, zoom: 1 },
        },
      ],
    });
    const body = await callValidate(page, rawJson);
    expect(body.format).toBe("workspace");
    expect(body.valid).toBe(true);
    expect(body.summary.elements).toBe(1);
  });

  test("malformed JSON string returns invalid result with syntax error message", async ({ page }) => {
    await open(page);
    const body = await callValidate(page, "{ not json");
    expect(body.valid).toBe(false);
    expect(body.format).toBe("unknown");
    expect(body.errors[0].message).toContain("JSON inválido");
  });

  test("editor.validate method operates identically", async ({ page }) => {
    await open(page);
    const body = await page.evaluate(() => {
      return (window as any).__editor__.validate({
        id: "a",
        type: "rectangle",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
      });
    });
    expect(body.format).toBe("element");
    expect(body.valid).toBe(true);
  });

  test("HTTP POST /validate is not exposed as a server endpoint", async ({ request }) => {
    const res = await request.post("/validate", {
      data: { hello: "world" },
    });
    // Rota removida: o servidor web nao atende mais POST /validate com status 200
    expect([404, 405]).toContain(res.status());
  });
});
