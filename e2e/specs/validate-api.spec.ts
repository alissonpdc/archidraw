import { test, expect } from "../fixtures";

// POST /validate: o agente manda um payload (workspace/biblioteca/clipboard/
// elemento) e recebe {valid, format, errors, warnings, summary}.
// Espelha as regras de rejeição documentadas em /docs (Seções 2–5).
async function postValidate(request: import("@playwright/test").APIRequestContext, body: unknown) {
  return request.post("/validate", { data: body });
}

test.describe("POST /validate", () => {
  test("accepts a valid workspace schema 2", async ({ request }) => {
    const res = await postValidate(request, {
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
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.format).toBe("workspace");
    expect(body.valid).toBe(true);
    expect(body.errors).toEqual([]);
    expect(body.summary.elements).toBe(1);
    expect(body.summary.tabs).toBe(1);
  });

  test("rejects a workspace with a missing camera and bad type, naming both", async ({ request }) => {
    const res = await postValidate(request, {
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
    const body = await res.json();
    expect(body.valid).toBe(false);
    const paths = body.errors.map((e: { path: string }) => e.path);
    expect(paths.some((p: string) => p.includes("camera"))).toBe(true);
    expect(paths.some((p: string) => p.includes(".type"))).toBe(true);
    // o erro de type cita o valor e a lista permitida (util p/ o agente)
    const typeErr = body.errors.find((e: { path: string }) => e.path.endsWith(".type"));
    expect(typeErr.message).toContain("banana");
    expect(typeErr.message).toContain("rectangle");
    expect(typeErr.rule).toBe("3.4");
  });

  test("validates a workspace with a tab missing name and non-finite geometry", async ({ request }) => {
    const res = await postValidate(request, {
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
    const body = await res.json();
    // tab sem name rejeita (regra 2.1); geometria nao-finita so advertencia,
    // porque o storage.parse real nao checa geometria (aceita o arquivo)
    expect(body.valid).toBe(false);
    const errPaths = body.errors.map((e: { path: string }) => e.path);
    expect(errPaths).toContain("tabs[0].name");
    const warnPaths = body.warnings.map((w: { path: string }) => w.path);
    expect(warnPaths.some((p) => p.includes("elements[0].x"))).toBe(true);
  });

  test("accepts a valid .archidrawlib and reports counts", async ({ request }) => {
    const res = await postValidate(request, {
      type: "archidrawlib",
      version: 2,
      libraryItems: [
        { name: "Box", elements: [{ type: "rectangle", x: 0, y: 0, width: 10, height: 10, opacity: 100 }] },
        { name: "Arrow", elements: [{ type: "arrow", x: 0, y: 0, width: 10, height: 0, points: [[0, 0], [10, 0]] }] },
      ],
    });
    const body = await res.json();
    expect(body.format).toBe("library");
    expect(body.valid).toBe(true);
    expect(body.summary.items).toBe(2);
    expect(body.summary.elements).toBe(2);
  });

  test("flags a library root with no libraryItems as invalid (rule 5.4)", async ({ request }) => {
    const res = await postValidate(request, { type: "archidrawlib", version: 2, foo: 1 });
    const body = await res.json();
    expect(body.format).toBe("library");
    expect(body.valid).toBe(false);
    expect(body.errors[0].message).toContain("libraryItems");
    expect(body.errors[0].rule).toBe("5.4");
  });

  test("does not reject the whole library for a single bad element (rule 5.4), only warns", async ({ request }) => {
    const res = await postValidate(request, {
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
    const body = await res.json();
    // na biblioteca, tipo invalido descarta o elemento mas NAO rejeita o arquivo
    expect(body.valid).toBe(true);
    expect(body.errors).toEqual([]);
    expect(body.warnings.length).toBeGreaterThan(0);
    expect(body.warnings.some((w: { message: string }) => w.message.includes("not-a-type"))).toBe(true);
  });

  test("accepts a valid clipboard envelope and counts elements", async ({ request }) => {
    const res = await postValidate(request, {
      schemaVersion: 1,
      type: "archidraw/elements",
      elements: [
        { id: "a", type: "rectangle", x: 0, y: 0, width: 10, height: 10 },
        { id: "b", type: "text", x: 0, y: 0, width: 10, height: 10, text: "hi", fontSize: 20 },
      ],
    });
    const body = await res.json();
    expect(body.format).toBe("clipboard");
    expect(body.valid).toBe(true);
    expect(body.summary.elements).toBe(2);
  });

  test("clipboard is atomic: one bad type rejects the entire payload (rule 4.3)", async ({ request }) => {
    const res = await postValidate(request, {
      schemaVersion: 1,
      type: "archidraw/elements",
      elements: [
        { id: "a", type: "rectangle", x: 0, y: 0, width: 10, height: 10 },
        { id: "b", type: "hexagon", x: 0, y: 0, width: 10, height: 10 },
      ],
    });
    const body = await res.json();
    expect(body.format).toBe("clipboard");
    expect(body.valid).toBe(false);
    expect(body.errors.some((e: { path: string }) => e.path.includes("elements[1].type"))).toBe(true);
  });

  test("a single element object is detected and validated as element", async ({ request }) => {
    const res = await postValidate(request, { id: "a", type: "ellipse", x: 0, y: 0, width: 10, height: 10 });
    const body = await res.json();
    expect(body.format).toBe("element");
    expect(body.valid).toBe(true);
  });

  test("an unknown payload shape reports invalid with an explanatory error", async ({ request }) => {
    const res = await postValidate(request, { hello: "world" });
    const body = await res.json();
    expect(body.format).toBe("unknown");
    expect(body.valid).toBe(false);
    expect(body.errors[0].message).toContain("envelope");
  });

  test("malformed JSON body returns 400 with a JSON syntax error", async ({ request }) => {
    // Buffer p/ enviar bytes crus (uma string JS seria re-serializada pelo
    // Playwright e chegaria como JSON valido)
    const res = await request.post("/validate", {
      data: Buffer.from("{ not json", "utf8"),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.errors[0].message).toContain("JSON inválido");
  });

  test("GET /validate returns 405 with usage", async ({ request }) => {
    const res = await request.get("/validate");
    expect(res.status()).toBe(405);
    const body = await res.json();
    expect(body.error).toContain("POST");
    expect(body.usage.path).toBe("/validate");
  });
});
