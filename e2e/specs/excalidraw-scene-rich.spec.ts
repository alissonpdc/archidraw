import { test, expect, open } from "../fixtures";
import { type Page } from "@playwright/test";

async function importScene(page: Page, file: object) {
  await page.setInputFiles("[data-testid=\"import-input\"]", {
    name: "rich.excalidraw",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(file)),
  });
}

async function importedElements(page: Page) {
  return page.evaluate(() => {
    const snap = (window as any).__editor__.getSnapshot();
    return snap.doc.elements;
  });
}

test.describe("excalidraw scene import (rich)", () => {
  test("converts arrows, lines, draw, shapes and bound texts", async ({
    page,
  }) => {
    await open(page);
    await importScene(page, {
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements: [
        {
          id: "ar1",
          type: "arrow",
          x: 100,
          y: 200,
          width: 100,
          height: 40,
          points: [
            [0, 40],
            [0, 0],
            [100, 40],
          ],
          strokeColor: "#1e1e1e",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 2,
          strokeStyle: "solid",
          roughness: 0,
          opacity: 100,
          startArrowhead: "arrow",
          endArrowhead: "triangle",
          startBinding: { elementId: "rec1", fixedPoint: [0, 0.5] },
          endBinding: { elementId: "rec1", fixedPoint: [0.5, 1] },
        },
        {
          id: "ar2",
          type: "arrow",
          x: 300,
          y: 200,
          width: 0,
          height: 80,
          points: [
            [0, 0],
            [0, 80],
          ],
          startArrowhead: null,
          endArrowhead: "circle",
          endBinding: { elementId: "rec1", focus: 0.5 },
        },
        {
          id: "ln1",
          type: "line",
          x: 50,
          y: 300,
          width: 80,
          height: 40,
          points: [
            [0, 0],
            [40, 0],
            [80, 40],
          ],
          strokeSharpness: "round",
        },
        {
          id: "dr1",
          type: "draw",
          x: 200,
          y: 300,
          width: 100,
          height: 50,
          points: [
            [0, 10],
            [10, 0],
            [20, 20],
            [40, 10],
            [60, 20],
          ],
          strokeSharpness: "round",
          closed: true,
        },
        {
          id: "fd1",
          type: "freedraw",
          x: 400,
          y: 300,
          width: 60,
          height: 60,
          points: [
            [0, 0],
            [10, 10],
            [20, 20],
            [30, 10],
          ],
        },
        {
          id: "el1",
          type: "ellipse",
          x: 50,
          y: 400,
          width: 120,
          height: 60,
          strokeColor: "#1e1e1e",
          backgroundColor: "#a5d8ff",
          fillStyle: "cross-hatch",
          strokeWidth: 2,
          strokeStyle: "solid",
          roughness: 1.5,
          opacity: 100,
        },
        {
          id: "di1",
          type: "diamond",
          x: 250,
          y: 400,
          width: 100,
          height: 80,
          strokeColor: "#1e1e1e",
          backgroundColor: "#ffc9c9",
          fillStyle: "hachure",
          strokeWidth: 2,
          strokeStyle: "solid",
          roughness: 0.5,
          opacity: 100,
        },
        {
          id: "rec1",
          type: "rectangle",
          x: 50,
          y: 500,
          width: 200,
          height: 80,
          strokeColor: "#1e1e1e",
          backgroundColor: "#b2f2bb",
          fillStyle: "solid",
          strokeWidth: 2,
          strokeStyle: "solid",
          roughness: 0,
          opacity: 100,
          boundElements: [{ id: "txt1", type: "text" }],
        },
        {
          id: "txt1",
          type: "text",
          x: 60,
          y: 520,
          width: 180,
          height: 30,
          text: "Bound label",
          fontSize: 20,
          fontFamily: 1,
          containerId: "rec1",
          originalText: "Bound label",
        },
        {
          id: "txt2",
          type: "text",
          x: 300,
          y: 500,
          width: 100,
          height: 30,
          text: "solo",
          fontSize: 18,
          fontFamily: 3,
        },
      ],
      appState: {},
      files: {},
    });

    const els = (await importedElements(page)) as any[];
    const byId = new Map(els.map((el) => [el.id, el]));

    const ar1 = byId.get("ar1");
    expect(ar1.type).toBe("arrow");
    expect(ar1.startArrowhead).toBe("arrow");
    expect(ar1.endArrowhead).toBe("triangle");
    expect(ar1.startBinding).toEqual({ elementId: "rec1", nx: 0, ny: 0.5 });
    expect(ar1.endBinding).toEqual({ elementId: "rec1", nx: 0.5, ny: 1 });

    const ar2 = byId.get("ar2");
    expect(ar2.startArrowhead).toBe("none");
    expect(ar2.endArrowhead).toBe("circle");
    expect(ar2.endBinding).toEqual({ elementId: "rec1", nx: 0.75, ny: 0.5 });

    for (const id of ["ln1", "dr1", "fd1"]) {
      expect(byId.get(id)!.type).toBe("line");
    }
    expect(byId.get("el1").fillStyle).toBe("cross-hachure");
    expect(byId.get("el1").roughness).toBe(2);
    expect(byId.get("di1").fillStyle).toBe("hachure");
    expect(byId.get("di1").roughness).toBe(1);

    const rec1 = byId.get("rec1");
    expect(rec1.label).toBe("Bound label");
    expect(rec1.fontFamily).toBe('"Architects Daughter", cursive');
    expect(byId.has("txt1")).toBe(false);
    expect(byId.get("txt2").fontFamily).toBe(
      'Consolas, "SF Mono", monospace',
    );
  });

  test("accepts a raw element array (no envelope)", async ({ page }) => {
    await open(page);
    await importScene(page, [
      {
        id: "raw_line",
        type: "line",
        x: 10,
        y: 10,
        width: 100,
        height: 50,
        points: [
          [0, 0],
          [50, 0],
          [100, 50],
        ],
      },
    ]);

    const els = (await importedElements(page)) as any[];
    expect(els).toHaveLength(1);
    expect(els[0].type).toBe("line");
  });

  test("rejects broken JSON without crashing and keeps the canvas", async ({
    page,
  }) => {
    await open(page);
    await page.setInputFiles("[data-testid=\"import-input\"]", {
      name: "broken.excalidraw",
      mimeType: "application/json",
      buffer: Buffer.from("{ oops !!"),
    });

    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { elementCount: snap.doc.elements.length, tabs: snap.tabs.length };
    });
    expect(s.elementCount).toBe(0);
    expect(s.tabs).toBe(1);
  });

  test("rejects a scene without elements", async ({ page }) => {
    await open(page);
    await importScene(page, { type: "excalidraw", appState: {} });

    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { elementCount: snap.doc.elements.length, tabs: snap.tabs.length };
    });
    expect(s.elementCount).toBe(0);
    expect(s.tabs).toBe(1);
  });
});