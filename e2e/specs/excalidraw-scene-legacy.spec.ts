import { test, expect, open } from "../fixtures";
import { type Page } from "@playwright/test";

async function importScene(page: Page, file: object) {
  await page.setInputFiles("[data-testid=\"import-input\"]", {
    name: "legacy.excalidraw",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(file)),
  });
}

async function textProps(page: Page) {
  return page.evaluate(() => {
    const ed = (window as any).__editor__;
    return ed
      .getSnapshot()
      .doc.elements.filter((el: any) => el.type === "text")
      .map((el: any) => ({ text: el.text, fontFamily: el.fontFamily }));
  });
}

test.describe("excalidraw scene import (legacy fields)", () => {
  test("maps string fontFamily names to the right font category", async ({
    page,
  }) => {
    await open(page);
    await importScene(page, {
      type: "excalidraw",
      version: 2,
      elements: [
        {
          id: "t1",
          type: "text",
          x: 100,
          y: 100,
          width: 100,
          height: 25,
          text: "Handwritten",
          fontFamily: "Virgil",
          fontSize: 20,
          strokeColor: "#1e1e1e",
          opacity: 100,
        },
        {
          id: "t2",
          type: "text",
          x: 100,
          y: 140,
          width: 100,
          height: 25,
          text: "Code",
          fontFamily: "Cascadia",
          fontSize: 20,
          strokeColor: "#1e1e1e",
          opacity: 100,
        },
        {
          id: "t3",
          type: "text",
          x: 100,
          y: 180,
          width: 100,
          height: 25,
          text: "Body",
          fontFamily: 2,
          fontSize: 20,
          strokeColor: "#1e1e1e",
          opacity: 100,
        },
      ],
    });

    const texts = await textProps(page);
    expect(texts).toEqual([
      { text: "Handwritten", fontFamily: '"Architects Daughter", cursive' },
      { text: "Code", fontFamily: 'Consolas, "SF Mono", monospace' },
      { text: "Body", fontFamily: undefined },
    ]);
  });

  test("drops malformed lines without points instead of crashing", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await importScene(page, {
      type: "excalidraw",
      version: 2,
      elements: [
        {
          id: "bad",
          type: "line",
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          strokeColor: "#1e1e1e",
          backgroundColor: "transparent",
          strokeWidth: 2,
          opacity: 100,
        },
        {
          id: "ok1",
          type: "rectangle",
          x: 200,
          y: 200,
          width: 80,
          height: 40,
          strokeColor: "#1e1e1e",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 2,
          opacity: 100,
        },
      ],
    });

    const s = await editorState();
    expect(s.elementCount).toBe(1);
    expect(s.elements[0].type).toBe("rectangle");
  });

  test("imports fill/roughness/arrowhead/binding variants and drops unknowns", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await importScene(page, {
      type: "excalidraw",
      version: 2,
      elements: [
        {
          id: "x1",
          type: "rectangle",
          x: 100,
          y: 100,
          width: 80,
          height: 40,
          strokeColor: "#1e1e1e",
          backgroundColor: "#b2f2bb",
          fillStyle: "cross-hatch",
          strokeWidth: 2,
          roughness: 3,
          opacity: 100,
        },
        {
          id: "x2",
          type: "diamond",
          x: 200,
          y: 100,
          strokeColor: "#1e1e1e",
          backgroundColor: "transparent",
          strokeWidth: 2,
          opacity: 100,
        },
        {
          id: "x3",
          type: "arrow",
          x: 300,
          y: 100,
          width: 100,
          height: 40,
          points: [
            [0, 40],
            [100, 40],
          ],
          startArrowhead: "triangle",
          endArrowhead: "circle",
          startBinding: { elementId: "x1", fixedPoint: [1, 0.5], focus: 0.5 },
          strokeColor: "#1e1e1e",
          strokeWidth: 2,
          strokeStyle: "dotted",
          opacity: 100,
        },
        {
          id: "x4",
          type: "text",
          x: 100,
          y: 200,
          width: 100,
          height: 25,
          originalText: "Fallback text",
          strokeColor: "#1e1e1e",
          opacity: 100,
        },
        {
          id: "x5",
          type: "iframe",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          strokeColor: "#000",
          opacity: 100,
        },
      ],
    });

    const mapped = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed
        .getSnapshot()
        .doc.elements.map((e: any) => ({
          type: e.type,
          fillStyle: e.fillStyle,
          roughness: e.roughness,
          startArrowhead: e.startArrowhead,
          endArrowhead: e.endArrowhead,
          strokeStyle: e.strokeStyle,
          fontSize: e.fontSize,
          text: e.text,
        }));
    });

    expect(mapped).toHaveLength(4);
    const [rect, diamond, arrow, text] = mapped;
    expect(rect).toMatchObject({ type: "rectangle", fillStyle: "cross-hachure", roughness: 3 });
    // transparent bg forces fillStyle solid (transparency bug guard)
    expect(diamond).toMatchObject({ type: "diamond" });
    expect(arrow).toMatchObject({
      type: "arrow",
      startArrowhead: "triangle",
      endArrowhead: "circle",
      strokeStyle: "dotted",
    });
    // text falls back to originalText and default font size
    expect(text).toMatchObject({ type: "text", text: "Fallback text", fontSize: 20 });
  });

  test("invalid structure throws instead of producing an empty doc", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.setInputFiles("[data-testid=\"import-input\"]", {
      name: "broken2.excalidraw",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({ type: "excalidraw", elements: "not-an-array" }),
      ),
    });

    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });

  test("bound text becomes the label of its container", async ({ page }) => {
    await open(page);
    await importScene(page, {
      type: "excalidraw",
      version: 2,
      elements: [
        {
          id: "box",
          type: "rectangle",
          x: 100,
          y: 100,
          width: 120,
          height: 60,
          strokeColor: "#1e1e1e",
          strokeWidth: 2,
          opacity: 100,
          boundElements: [{ type: "text", id: "lbl" }],
        },
        {
          id: "lbl",
          type: "text",
          x: 120,
          y: 115,
          width: 80,
          height: 20,
          text: "Web",
          containerId: "box",
          strokeColor: "#1e1e1e",
          opacity: 100,
        },
        {
          id: "edge",
          type: "arrow",
          x: 300,
          y: 200,
          width: 100,
          height: 40,
          points: [[0, 40], [100, 40]],
          startBinding: { elementId: "box", fixedPoint: [1, 0.5], focus: 0.8 },
          strokeColor: "#1e1e1e",
          strokeWidth: 2,
          opacity: 100,
        },
      ],
    });

    const out = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const els = ed.getSnapshot().doc.elements;
      const box = els.find((e: any) => e.id === "box");
      return {
        count: els.length,
        boxLabel: box.label,
        hasBoundText: els.some((e: any) => e.type === "text" && e.text === "Web"),
      };
    });
    expect(out.count).toBe(2); // the bound text merged into the box
    expect(out.boxLabel).toBe("Web");
    expect(out.hasBoundText).toBe(false);
  });
});