import { test, expect, open, drag, selectTool, pressPasteText } from "../fixtures";
import type { Page } from "@playwright/test";

const RECT = { a: { x: 200, y: 150 }, b: { x: 320, y: 220 } };

async function drawRect(
  page: Page,
  from: { x: number; y: number } = RECT.a,
  to: { x: number; y: number } = RECT.b,
) {
  await selectTool(page, "2");
  await drag(page, from, to);
  await selectTool(page, "1");
}

async function copyViaShortcut(page: Page) {
  await page.keyboard.press("ControlOrMeta+c");
  await expect
    .poll(async () =>
      page.evaluate(() => localStorage.getItem("archidraw:clipboard") !== null),
    )
    .toBe(true);
}

test.describe("clipboard JSON — copy writes descriptive JSON to the OS clipboard", () => {
  test("Copy puts a versioned envelope describing the elements", async ({
    page,
    editorState,
  }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await open(page);
    await drawRect(page);

    await copyViaShortcut(page);

    const docEl = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0],
    );
    const raw = await page.evaluate(() => navigator.clipboard.readText());
    const parsed = JSON.parse(raw);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.type).toBe("archidraw/elements");
    expect(parsed.elements).toHaveLength(1);
    expect(parsed.elements[0]).toEqual(docEl);
    expect((await editorState()).elementCount).toBe(1);
  });

  test("Cut also writes the JSON envelope to the OS clipboard", async ({
    page,
    editorState,
  }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await open(page);
    await drawRect(page);

    await page.keyboard.press("ControlOrMeta+x");
    await expect
      .poll(async () => (await editorState()).elementCount)
      .toBe(0);

    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .not.toBe("");
    const raw = await page.evaluate(() => navigator.clipboard.readText());
    const parsed = JSON.parse(raw);
    expect(parsed.type).toBe("archidraw/elements");
    expect(parsed.elements).toHaveLength(1);
    expect(parsed.elements[0].type).toBe("rectangle");
  });

  test("multi-selection copy describes every element", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await open(page);
    await drawRect(page, RECT.a, RECT.b);
    await drawRect(page, { x: 360, y: 150 }, { x: 480, y: 220 });

    await page.keyboard.press("ControlOrMeta+a");
    await copyViaShortcut(page);

    const raw = await page.evaluate(() => navigator.clipboard.readText());
    const parsed = JSON.parse(raw);
    expect(parsed.elements).toHaveLength(2);
    expect(parsed.elements.map((el: any) => el.type)).toEqual([
      "rectangle",
      "rectangle",
    ]);
  });
});

test.describe("clipboard JSON — paste element JSON from an external source", () => {
  test("pasting a single element object creates the element with defaults", async ({
    page,
    editorState,
  }) => {
    await open(page);

    await pressPasteText(
      page,
      JSON.stringify({ type: "rectangle", x: 40, y: 50, width: 80, height: 30 }),
    );

    const state = await editorState();
    expect(state.elementCount).toBe(1);
    expect(state.elements[0].type).toBe("rectangle");
    const el = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0],
    );
    expect(el.x).toBe(56);
    expect(el.y).toBe(66);
    expect(el.width).toBe(80);
    expect(el.height).toBe(30);
    expect(el.strokeColor).toBe("#3d4248");
    expect(el.backgroundColor).toBe("#dfe0e2");
    expect(el.strokeWidth).toBe(1);
    expect(el.opacity).toBe(1);
    expect(el.strokeStyle).toBe("solid");
    expect(el.fillStyle).toBe("solid");
    expect(el.roughness).toBe(0);
    expect(el.borderRadius).toBe(0);
    expect(el.angle).toBe(0);
    expect(state.selectedIds).toHaveLength(1);
  });

  test("pasting the envelope with multiple elements creates all of them with remapped bindings", async ({
    page,
  }) => {
    await open(page);

    const payload = {
      schemaVersion: 1,
      type: "archidraw/elements",
      elements: [
        { type: "rectangle", id: "r1", x: 10, y: 10, width: 100, height: 60 },
        {
          type: "arrow",
          id: "a1",
          x: 110,
          y: 40,
          width: 80,
          height: 0,
          startBinding: { elementId: "r1", nx: 1, ny: 0.5, side: "right" },
          endBinding: { elementId: "r1", nx: 0, ny: 0.5 },
        },
      ],
    };
    await pressPasteText(page, JSON.stringify(payload));

    const els = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements,
    );
    expect(els).toHaveLength(2);
    const rect = els.find((el: any) => el.type === "rectangle");
    const arrow = els.find((el: any) => el.type === "arrow");
    expect(rect.id).not.toBe("r1");
    expect(arrow.startBinding.elementId).toBe(rect.id);
    expect(arrow.startBinding.side).toBe("right");
    expect(arrow.startBinding.nx).toBe(1);
    expect(arrow.endBinding.elementId).toBe(rect.id);
    expect(arrow.endBinding.side).toBeUndefined();
    expect(arrow.endBinding.nx).toBe(0);
  });

  test("pasting a bare element array (legacy format) is accepted", async ({
    page,
    editorState,
  }) => {
    await open(page);

    await pressPasteText(
      page,
      JSON.stringify([
        { type: "ellipse", x: 30, y: 30, width: 50, height: 40 },
      ]),
    );

    const state = await editorState();
    expect(state.elementCount).toBe(1);
    expect(state.elements[0].type).toBe("ellipse");
  });

  test("pasted JSON round-trips: copy → OS clipboard JSON → paste recreates the element", async ({
    page,
  }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await open(page);
    await drawRect(page);

    await copyViaShortcut(page);
    const json = await page.evaluate(() => navigator.clipboard.readText());

    await page.keyboard.press("Delete");
    await expect
      .poll(async () =>
        page.evaluate(() => (window as any).__editor__.getSnapshot().doc.elements.length),
      )
      .toBe(0);

    await pressPasteText(page, json);

    const els = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements,
    );
    expect(els).toHaveLength(1);
    expect(els[0].type).toBe("rectangle");
    expect(els[0].width).toBe(RECT.b.x - RECT.a.x);
    expect(els[0].height).toBe(RECT.b.y - RECT.a.y);
  });

  test("text elements keep their content and styling", async ({ page }) => {
    await open(page);

    const payload = {
      type: "text",
      text: "hello archidraw",
      fontSize: 24,
      x: 10,
      y: 10,
      bold: true,
      italic: true,
      underline: true,
      fontFamily: "Georgia",
      textColor: "#ff0000",
      lineSpacing: 1.5,
      textAlign: "center",
      textOffsetGlobal: 2,
      textOffsetTop: 3,
      textOffsetBottom: 4,
      textOffsetLeft: 5,
      textOffsetRight: 6,
    };
    await pressPasteText(page, JSON.stringify(payload));

    const el = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0],
    );
    expect(el.text).toBe("hello archidraw");
    expect(el.fontSize).toBe(24);
    expect(el.bold).toBe(true);
    expect(el.italic).toBe(true);
    expect(el.underline).toBe(true);
    expect(el.fontFamily).toBe("Georgia");
    expect(el.textColor).toBe("#ff0000");
    expect(el.lineSpacing).toBe(1.5);
    expect(el.textAlign).toBe("center");
    expect(el.textOffsetGlobal).toBe(2);
    expect(el.textOffsetTop).toBe(3);
    expect(el.textOffsetBottom).toBe(4);
    expect(el.textOffsetLeft).toBe(5);
    expect(el.textOffsetRight).toBe(6);
  });

  test("text element without fontSize gets the default size", async ({
    page,
  }) => {
    await open(page);

    await pressPasteText(
      page,
      JSON.stringify({ type: "text", text: "plain", x: 0, y: 0 }),
    );

    const el = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0],
    );
    expect(el.text).toBe("plain");
    expect(el.fontSize).toBe(20);
    expect(el.width).toBe(100);
    expect(el.height).toBe(100);
  });

  test("component and context elements keep their specifics", async ({
    page,
  }) => {
    await open(page);

    const payload = {
      schemaVersion: 1,
      type: "archidraw/elements",
      elements: [
        {
          type: "component",
          componentId: "ec2",
          label: "EC2",
          x: 300,
          y: 40,
          width: 48,
          height: 48,
          captionPosition: "bottom",
          captionGap: 8,
          captionOffsetTop: 1,
          captionOffsetBottom: 2,
          captionOffsetLeft: 3,
          captionOffsetRight: 4,
          fill: false,
        },
        {
          type: "context",
          label: "Bounded",
          x: 280,
          y: 20,
          width: 300,
          height: 200,
          labelPosition: "top-left",
          labelSide: "internal",
          childIds: ["nonexistent"],
        },
      ],
    };
    await pressPasteText(page, JSON.stringify(payload));

    const els = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements,
    );
    const comp = els.find((el: any) => el.type === "component");
    const ctx = els.find((el: any) => el.type === "context");
    expect(comp.componentId).toBe("ec2");
    expect(comp.label).toBe("EC2");
    expect(comp.captionPosition).toBe("bottom");
    expect(comp.captionGap).toBe(8);
    expect(comp.captionOffsetTop).toBe(1);
    expect(comp.captionOffsetBottom).toBe(2);
    expect(comp.captionOffsetLeft).toBe(3);
    expect(comp.captionOffsetRight).toBe(4);
    expect(comp.fill).toBe(false);
    expect(ctx.label).toBe("Bounded");
    expect(ctx.labelPosition).toBe("top-left");
    expect(ctx.labelSide).toBe("internal");
    expect(ctx.childIds).toEqual([comp.id]);
  });

  test("component without componentId defaults to an empty id", async ({
    page,
  }) => {
    await open(page);

    await pressPasteText(
      page,
      JSON.stringify({ type: "component", x: 10, y: 10, width: 48, height: 48 }),
    );

    const el = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0],
    );
    expect(el.type).toBe("component");
    expect(el.componentId).toBe("");
  });

  test("lines keep control points, bends and label position", async ({
    page,
  }) => {
    await open(page);

    const payload = {
      type: "line",
      lineType: "curved",
      label: "edge",
      labelT: 0.25,
      controlPoint: { x: 50, y: 80 },
      bendPoints: [
        { x: 10, y: 10 },
        { x: 20, y: 30 },
      ],
      strokeStyle: "dashed",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    };
    await pressPasteText(page, JSON.stringify(payload));

    const el = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0],
    );
    expect(el.type).toBe("line");
    expect(el.lineType).toBe("curved");
    expect(el.label).toBe("edge");
    expect(el.labelT).toBe(0.25);
    expect(el.controlPoint).toEqual({ x: 50, y: 80 });
    expect(el.bendPoints).toEqual([
      { x: 10, y: 10 },
      { x: 20, y: 30 },
    ]);
    expect(el.strokeStyle).toBe("dashed");
  });

  test("arrows keep animation and arrowheads", async ({ page }) => {
    await open(page);

    const payload = {
      type: "arrow",
      animated: true,
      startArrowhead: "circle",
      endArrowhead: "triangle",
      lineType: "auto",
      bendPoints: [{ x: 10, y: 20 }],
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    };
    await pressPasteText(page, JSON.stringify(payload));

    const el = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0],
    );
    expect(el.type).toBe("arrow");
    expect(el.animated).toBe(true);
    expect(el.startArrowhead).toBe("circle");
    expect(el.endArrowhead).toBe("triangle");
    expect(el.lineType).toBe("auto");
  });

  test("invalid enum values and junk optional fields are coerced or dropped", async ({
    page,
  }) => {
    await open(page);

    const payload = {
      type: "rectangle",
      x: 1,
      y: 2,
      width: 30,
      height: 40,
      strokeStyle: "wiggle",
      fillStyle: 123,
      roughness: 99,
      opacity: "high",
      borderRadius: "big",
      angle: "tilt",
      locked: "yes",
      label: 42,
      groupId: { g: 1 },
      details: 7,
      fontFamily: 9,
      bold: "no",
      italic: "no",
      underline: "no",
      textColor: 1,
      lineSpacing: "wide",
      fontSize: "huge",
      textAlign: 42,
      textVAlign: "up",
      captionPosition: "diagonal",
      captionGap: "gap",
    };
    await pressPasteText(page, JSON.stringify(payload));

    const el = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0],
    );
    expect(el.strokeStyle).toBe("solid");
    expect(el.fillStyle).toBe("solid");
    expect(el.roughness).toBe(3);
    expect(el.opacity).toBe(1);
    expect(el.borderRadius).toBe(0);
    expect(el.angle).toBe(0);
    expect(el.locked).toBeUndefined();
    expect(el.label).toBeUndefined();
    expect(el.groupId).toBeUndefined();
    expect(el.details).toBeUndefined();
    expect(el.fontFamily).toBeUndefined();
    expect(el.bold).toBeUndefined();
    expect(el.italic).toBeUndefined();
    expect(el.underline).toBeUndefined();
    expect(el.textColor).toBeUndefined();
    expect(el.lineSpacing).toBeUndefined();
    expect(el.fontSize).toBeUndefined();
    expect(el.textAlign).toBeUndefined();
    expect(el.textVAlign).toBeUndefined();
    expect(el.captionPosition).toBeUndefined();
    expect(el.captionGap).toBeUndefined();
  });

  test("invalid points, bends and bindings are dropped", async ({ page }) => {
    await open(page);

    const payload = {
      schemaVersion: 1,
      type: "archidraw/elements",
      elements: [
        { type: "rectangle", x: 0, y: 0, width: 60, height: 60 },
        {
          type: "line",
          x: 0,
          y: 0,
          width: 50,
          height: 50,
          controlPoint: { x: "a", y: 2 },
          bendPoints: [1],
          startBinding: 5,
          endBinding: null,
        },
        {
          type: "arrow",
          x: 0,
          y: 0,
          width: 50,
          height: 50,
          controlPoint: [1, 2],
          bendPoints: "nope",
          startBinding: { nx: 0.5 },
          endBinding: { elementId: "x", nx: 0.5, ny: 0.5, side: "diagonal" },
          startArrowhead: "spike",
          endArrowhead: 42,
        },
        {
          type: "line",
          x: 0,
          y: 0,
          width: 20,
          height: 20,
          controlPoint: null,
          bendPoints: [{ y: 2 }],
          startBinding: [1],
          endBinding: [],
        },
      ],
    };
    await pressPasteText(page, JSON.stringify(payload));

    const els = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements,
    );
    expect(els).toHaveLength(4);
    const badLine = els[1];
    expect(badLine.controlPoint).toBeUndefined();
    expect(badLine.bendPoints).toBeUndefined();
    expect(badLine.startBinding).toBeUndefined();
    expect(badLine.endBinding).toBeUndefined();
    const badArrow = els[2];
    expect(badArrow.controlPoint).toBeUndefined();
    expect(badArrow.bendPoints).toBeUndefined();
    expect(badArrow.startBinding).toBeUndefined();
    expect(badArrow.endBinding.elementId).toBe("x");
    expect(badArrow.endBinding.side).toBeUndefined();
    expect(badArrow.startArrowhead).toBeUndefined();
    expect(badArrow.endArrowhead).toBeUndefined();
    const badLine2 = els[3];
    expect(badLine2.controlPoint).toBeUndefined();
    expect(badLine2.bendPoints).toBeUndefined();
    expect(badLine2.startBinding).toBeUndefined();
    expect(badLine2.endBinding).toBeUndefined();
  });

  test("invalid context childIds are dropped or filtered", async ({ page }) => {
    await open(page);

    const payload = {
      schemaVersion: 1,
      type: "archidraw/elements",
      elements: [
        { type: "rectangle", id: "kept", x: 0, y: 0, width: 40, height: 40 },
        {
          type: "context",
          x: 500,
          y: 80,
          width: 300,
          height: 200,
          childIds: [42, "kept"],
        },
        {
          type: "context",
          x: 900,
          y: 80,
          width: 100,
          height: 100,
          childIds: "nope",
        },
      ],
    };
    await pressPasteText(page, JSON.stringify(payload));

    const els = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements,
    );
    expect(els).toHaveLength(3);
    const ctx1 = els.find((el: any) => el.type === "context" && el.width === 300);
    const ctx2 = els.find((el: any) => el.type === "context" && el.width === 100);
    expect(ctx1.childIds).toBeUndefined();
    expect(ctx2.childIds).toBeUndefined();
  });
});

test.describe("clipboard JSON — foreign payloads are not hijacked", () => {
  test("foreign JSON text falls back to the internal clipboard", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await copyViaShortcut(page);

    await pressPasteText(page, JSON.stringify({ hello: "world" }));

    expect((await editorState()).elementCount).toBe(2);
  });

  test("foreign JSON array falls back to the internal clipboard", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await copyViaShortcut(page);

    await pressPasteText(page, JSON.stringify([{ foo: 1 }]));

    expect((await editorState()).elementCount).toBe(2);
  });

  test("plain text falls back to the internal clipboard", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await copyViaShortcut(page);

    await pressPasteText(page, "not json at all");

    expect((await editorState()).elementCount).toBe(2);
  });

  test("plain text with empty internal clipboard creates nothing", async ({
    page,
    editorState,
  }) => {
    await open(page);

    await pressPasteText(page, "just text");

    expect((await editorState()).elementCount).toBe(0);
  });

  test("JSON scalars create nothing", async ({ page, editorState }) => {
    await open(page);

    await pressPasteText(page, '"hello"');
    await pressPasteText(page, "42");
    await pressPasteText(page, "null");

    expect((await editorState()).elementCount).toBe(0);
  });

  test("an array containing an invalid element rejects the whole payload", async ({
    page,
    editorState,
  }) => {
    await open(page);

    await pressPasteText(
      page,
      JSON.stringify([
        { type: "rectangle", x: 0, y: 0, width: 10, height: 10 },
        { type: "star" },
      ]),
    );

    expect((await editorState()).elementCount).toBe(0);
  });

  test("nested arrays and null elements are rejected", async ({
    page,
    editorState,
  }) => {
    await open(page);

    await pressPasteText(page, "[[]]");
    await pressPasteText(page, "[null]");

    expect((await editorState()).elementCount).toBe(0);
  });

  test("an empty envelope creates nothing", async ({
    page,
    editorState,
  }) => {
    await open(page);

    await pressPasteText(
      page,
      JSON.stringify({ schemaVersion: 1, type: "archidraw/elements", elements: [] }),
    );
    await pressPasteText(page, "[]");

    expect((await editorState()).elementCount).toBe(0);
  });

  test("pasteFromText returns 0 for garbage and N for valid payloads", async ({
    page,
  }) => {
    await open(page);

    const bad = await page.evaluate(() =>
      (window as any).__editor__.pasteFromText("nope"),
    );
    expect(bad).toBe(0);
    const good = await page.evaluate(() =>
      (window as any).__editor__.pasteFromText(
        JSON.stringify({ type: "rectangle", x: 0, y: 0, width: 10, height: 10 }),
      ),
    );
    expect(good).toBe(1);
  });

  test("pasting JSON twice cascades the offset", async ({ page }) => {
    await open(page);

    const json = JSON.stringify({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 20,
      height: 20,
    });
    await pressPasteText(page, json);
    await pressPasteText(page, json);

    const els = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements,
    );
    expect(els).toHaveLength(2);
    expect(els[0].x).toBe(16);
    expect(els[1].x).toBe(32);
  });
});

test.describe("clipboard JSON — paste an .archidrawlib envelope", () => {
  const nativeRect = {
    type: "rectangle",
    id: "n1",
    x: 0,
    y: 0,
    width: 60,
    height: 40,
    roughness: 2,
  };

  test("pasting a library envelope inserts its native elements", async ({
    page,
    editorState,
  }) => {
    await open(page);

    await pressPasteText(
      page,
      JSON.stringify({
        type: "archidrawlib",
        version: 2,
        libraryItems: [
          {
            name: "Sketch Box",
            elements: [{ type: "rectangle", x: 0, y: 0, width: 60, height: 40, opacity: 100 }],
            archidrawElements: [nativeRect],
          },
        ],
      }),
    );

    const state = await editorState();
    expect(state.elementCount).toBe(1);
    const el = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0],
    );
    expect(el.type).toBe("rectangle");
    expect(el.roughness).toBe(2);
    expect(el.groupId).toBeTruthy();
  });

  test("a library envelope without native elements creates nothing", async ({
    page,
    editorState,
  }) => {
    await open(page);

    await pressPasteText(
      page,
      JSON.stringify({
        type: "excalidrawlib",
        version: 2,
        libraryItems: [{ name: "Raster", elements: [{ type: "rectangle", x: 0, y: 0, width: 10, height: 10 }] }],
      }),
    );

    expect((await editorState()).elementCount).toBe(0);
  });

  test("malformed or all-invalid library envelopes create nothing", async ({
    page,
    editorState,
  }) => {
    await open(page);

    // archidrawElements present but not an array
    await pressPasteText(
      page,
      JSON.stringify({ type: "archidrawlib", version: 2, libraryItems: [{ archidrawElements: "nope" }] }),
    );
    // legacy {library} array shape: items are bare arrays, never objects
    await pressPasteText(
      page,
      JSON.stringify({ library: [[{ type: "rectangle", x: 0, y: 0, width: 1, height: 1 }]] }),
    );
    // an item that is neither an object nor an array
    await pressPasteText(
      page,
      JSON.stringify({ libraryItems: [42] }),
    );
    // every native element invalid -> the whole batch yields nothing
    await pressPasteText(
      page,
      JSON.stringify({ libraryItems: [{ archidrawElements: [{ type: "star" }] }] }),
    );
    // empty libraryItems
    await pressPasteText(page, JSON.stringify({ libraryItems: [] }));

    expect((await editorState()).elementCount).toBe(0);
  });
});
