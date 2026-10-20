import { type Page, test, expect, open } from "../fixtures";

/** opens the library panel; groups start collapsed */
async function openLibrary(page: Page) {
  await open(page);
  await page.keyboard.press("l");
  await expect(page.locator(".library-panel")).toBeVisible();
}

const IMPORT_BUTTON = '[data-testid="library-import"]';

function fakeLibContent() {
  return JSON.stringify({
    type: "excalidrawlib",
    version: 2,
    libraryItems: [
      {
        id: "a1",
        name: "DB Box",
        elements: [
          {
            type: "rectangle",
            x: 0,
            y: 0,
            width: 80,
            height: 40,
            strokeColor: "#1e1e1e",
            backgroundColor: "#a5d8ff",
            fillStyle: "solid",
            strokeWidth: 2,
            strokeStyle: "solid",
            opacity: 100,
            roundness: null,
          },
        ],
      },
      {
        id: "a2",
        elements: [
          {
            type: "ellipse",
            x: 0,
            y: 0,
            width: 60,
            height: 40,
            strokeColor: "#e03131",
            backgroundColor: "transparent",
            fillStyle: "solid",
            strokeWidth: 2,
            strokeStyle: "solid",
            opacity: 100,
          },
          {
            type: "text",
            x: 8,
            y: 50,
            width: 60,
            height: 25,
            text: "Node",
            fontSize: 20,
            fontFamily: 2,
            strokeColor: "#1e1e1e",
            opacity: 100,
          },
        ],
      },
    ],
  });
}

async function importLib(page: Page, name: string, content: string) {
  await page.locator(IMPORT_BUTTON).click();
  await page.locator(".library-import-input").setInputFiles({
    name,
    mimeType: "application/json",
    buffer: Buffer.from(content, "utf-8"),
  });
}

/** import that is expected to succeed: waits for the group to appear */
async function importLibOk(page: Page, name: string, content: string) {
  await importLib(page, name, content);
  // import is async (file.text + parse): wait for the group to appear
  await expect(
    page.locator('[data-testid="library-imported-group"]'),
  ).toHaveCount(1);
}

test.describe("excalidraw library import", () => {
  test("imports v1 format ({library}) with tuple points", async ({
    page,
    editorState,
  }) => {
    await openLibrary(page);
    // v1: chave "library", items são arrays de elements, points [x,y]
    await importLibOk(
      page,
      "v1-lib.excalidrawlib",
      JSON.stringify({
        type: "excalidrawlib",
        version: 1,
        library: [
          [
            {
              type: "line",
              x: 100,
              y: 100,
              width: 40,
              height: 30,
              points: [
                [0, 0],
                [-10, 20],
                [30, 30],
              ],
              strokeColor: "#000000",
              backgroundColor: "transparent",
              strokeWidth: 2,
              opacity: 100,
            },
            {
              type: "rectangle",
              x: 90,
              y: 90,
              width: 60,
              height: 40,
              strokeColor: "#000000",
              backgroundColor: "#b2f2bb",
              fillStyle: "hachure",
              strokeWidth: 2,
              opacity: 100,
            },
          ],
        ],
      }),
    );

    // o SVG gerado não pode ter coordenadas inválidas
    const svg = await page.evaluate(() => {
      const libs = JSON.parse(
        localStorage.getItem("archidraw:importedLibraries") || "[]",
      );
      return libs[0]?.items?.[0]?.svg ?? "";
    });
    expect(svg).not.toContain("NaN");
    expect(svg).not.toContain("undefined");
    expect(svg).toContain("<path");
    expect(svg).toContain('fill-opacity');
  });
  test("import button is present in the library header", async ({ page }) => {
    await openLibrary(page);
    await expect(page.locator(IMPORT_BUTTON)).toBeVisible();
  });

  test("imports .excalidrawlib as a new group named after the file", async ({
    page,
    editorState,
  }) => {
    await openLibrary(page);
    await importLibOk(      page,
      "my-icons.excalidrawlib",
      fakeLibContent(),
    );

    // group named after the file (extension stripped) appears expanded
    const group = page.locator('[data-testid="library-imported-group"]');
    await expect(group).toHaveCount(1);
    await expect(group.locator(".library-group-name")).toHaveText("my-icons");
    await expect(group.locator(".library-section-header")).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    // tiles rendered as official-asset images (SVG data URIs)
    const tiles = group.locator(".library-tile");
    await expect(tiles).toHaveCount(2);
    await expect(tiles.first().locator("img.library-card-img")).toBeVisible();

    // clicking a tile inserts a component without a label
    await tiles.first().click();
    const state = await editorState();
    expect(state.elementCount).toBe(1);
    expect(state.elements[0].type).toBe("component");
    expect(state.elements[0].componentId).toMatch(/^imp-/);
    expect(state.elements[0].label).toBeUndefined();

    // item appears in search too
    await page.locator(".library-search").fill("db box");
    await expect(page.locator(".library-body .library-card")).toHaveCount(1);
  });

  test("imported items render on canvas via image asset", async ({ page }) => {
    await openLibrary(page);
    await importLibOk(page, "my-icons.excalidrawlib", fakeLibContent());

    const tile = page
      .locator('[data-testid="library-imported-group"] .library-tile')
      .first();
    await tile.click();

    // the imported item id must resolve to a registered image asset
    const resolved = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      const img = new Image();
      img.src = document
        .querySelector(`[data-component-id="${el.componentId}"] img`)
        ?.getAttribute("src") ?? "";
      return !!el.componentId && img.src.startsWith("data:image/svg+xml");
    });
    expect(resolved).toBe(true);
  });

  test("imported groups persist across reloads", async ({ page }) => {
    await openLibrary(page);
    await importLibOk(page, "my-icons.excalidrawlib", fakeLibContent());

    await page.reload();
    await open(page);
    await page.keyboard.press("l");

    const group = page.locator('[data-testid="library-imported-group"]');
    await expect(group).toHaveCount(1);
    await expect(group.locator(".library-group-name")).toHaveText("my-icons");
  });

  test("invalid file shows an error and does not create a group", async ({
    page,
  }) => {
    await openLibrary(page);
    await importLib(page, "broken.excalidrawlib", "{ not json");

    await expect(page.locator(".library-error")).toBeVisible();
    await expect(
      page.locator('[data-testid="library-imported-group"]'),
    ).toHaveCount(0);
  });

  test("rich items (arrowheads, draw, diamond, angle, dashes) produce valid SVG", async ({
    page,
  }) => {
    await openLibrary(page);
    await importLibOk(
      page,
      "rich.excalidrawlib",
      JSON.stringify({
        type: "excalidrawlib",
        version: 2,
        libraryItems: [
          {
            id: "b1",
            name: "Arrow & Diamond",
            elements: [
              {
                type: "arrow",
                x: 0,
                y: 0,
                points: [
                  [0, 0],
                  [20, 0],
                  [40, 20],
                ],
                startArrowhead: "arrow",
                endArrowhead: "triangle",
                strokeColor: "#111111",
                strokeWidth: 2,
                strokeStyle: "solid",
                opacity: 100,
              },
              {
                type: "diamond",
                x: 20,
                y: 20,
                width: 40,
                height: 30,
                strokeColor: "#111111",
                backgroundColor: "#c9e6ff",
                fillStyle: "cross-hatch",
                strokeWidth: 2,
                strokeStyle: "dashed",
                opacity: 60,
                angle: 0.5,
              },
              {
                type: "line",
                x: 0,
                y: 80,
                points: [
                  [0, 0],
                  [30, 10],
                  [60, 10],
                ],
                strokeStyle: "dotted",
                strokeColor: "#222222",
                opacity: 100,
              },
            ],
          },
          {
            id: "b2",
            elements: [
              {
                type: "draw",
                x: 0,
                y: 0,
                points: [
                  [0, 0],
                  [10, 5],
                  [20, 5],
                  [30, 0],
                ],
                strokeSharpness: "round",
                strokeColor: "#333333",
                opacity: 100,
              },
            ],
          },
          {
            id: "b3",
            name: "Text Icon",
            elements: [
              {
                type: "text",
                x: 0,
                y: 0,
                width: 40,
                height: 20,
                text: "API\nLayer",
                fontSize: 14,
                fontFamily: 1,
                strokeColor: "#000000",
                opacity: 100,
              },
            ],
          },
        ],
      }),
    );

    const svg = await page.evaluate(() => {
      const libs = JSON.parse(
        localStorage.getItem("archidraw:importedLibraries") || "[]",
      );
      return libs
        .find((l: { name: string }) => l.name === "rich")
        ?.items?.map((it: { svg: string }) => it.svg)
        .join("\n") ?? "";
    });

    expect(svg).not.toContain("NaN");
    expect(svg).not.toContain("undefined");
    expect(svg).toContain("<polygon");
    expect(svg).toContain("stroke-dasharray");
    expect(svg).toContain("transform=\"rotate(");
    expect(svg).toContain("font-family=\"Virgil,");

    const group = page.locator('[data-testid="library-imported-group"]');
    await expect(group.locator(".library-tile")).toHaveCount(3);
  });

  test("imported group can be removed", async ({ page }) => {
    await openLibrary(page);
    await importLibOk(page, "my-icons.excalidrawlib", fakeLibContent());

    await page
      .locator('[data-testid="library-imported-group"] .library-group-remove')
      .click();
    await expect(
      page.locator('[data-testid="library-imported-group"]'),
    ).toHaveCount(0);

    await page.reload();
    await open(page);
    await page.keyboard.press("l");
    await expect(
      page.locator('[data-testid="library-imported-group"]'),
    ).toHaveCount(0);
  });

  test("imported libraries are restored after a reload", async ({
    page,
    editorState,
  }) => {
    await openLibrary(page);
    await importLibOk(page, "my-icons.excalidrawlib", fakeLibContent());

    await page.reload();
    await page.waitForFunction(
      () =>
        (window as any).__editor__ !== undefined &&
        (window as any).__appReady__ === true,
    );
    await page.keyboard.press("l");

    const group = page.locator('[data-testid="library-imported-group"]');
    await expect(group).toHaveCount(1);
    await expect(group.locator(".library-group-name")).toHaveText("my-icons");

    const persisted = await page.evaluate(() =>
      JSON.parse(
        localStorage.getItem("archidraw:importedLibraries") || "[]",
      ).map((l: { name: string }) => l.name),
    );
    expect(persisted).toEqual(["my-icons"]);

    // assets re-registered: expanding the restored group shows the tile
    await group.locator(".library-group-name").click();
    const tile = group.locator(".library-tile");
    await expect(tile).toHaveCount(2);
    await tile.first().click();
    const s = await editorState();
    expect(s.elements.every((e) => e.type === "component")).toBe(true);
  });
});

test.describe("archidrawlib native import", () => {
  const nativeRect = {
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
    roughness: 3,
    borderRadius: 0,
  };

  function lib(items: unknown[]) {
    return JSON.stringify({ type: "archidrawlib", version: 2, libraryItems: items });
  }

  test("item with native elements is inserted as an editable group", async ({
    page,
    editorState,
  }) => {
    await openLibrary(page);
    await importLibOk(
      page,
      "native.archidrawlib",
      lib([
        {
          name: "Sketchy Box",
          elements: [{ type: "rectangle", x: 0, y: 0, width: 80, height: 40, opacity: 100 }],
          archidrawElements: [nativeRect],
          svg: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><path d="M0 0"/></svg>',
        },
      ]),
    );

    await page.locator('[data-testid="library-imported-group"] .library-tile').click();
    const state = await editorState();
    expect(state.elementCount).toBe(1);
    expect(state.elements[0].type).toBe("rectangle");
    const el = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0],
    );
    expect(el.roughness).toBe(3);
    expect(el.groupId).toBeTruthy();
  });

  test("stored svg is used verbatim as the tile thumbnail", async ({ page }) => {
    await openLibrary(page);
    await importLibOk(
      page,
      "thumb.archidrawlib",
      lib([
        {
          name: "Thumb",
          elements: [{ type: "rectangle", x: 0, y: 0, width: 80, height: 40, opacity: 100 }],
          archidrawElements: [nativeRect],
          svg: '<svg xmlns="http://www.w3.org/2000/svg" data-thumb="yes"></svg>',
        },
      ]),
    );
    const stored = await page.evaluate(() => {
      const libs = JSON.parse(localStorage.getItem("archidraw:importedLibraries") || "[]");
      return libs[0].items[0].svg as string;
    });
    expect(stored).toContain('data-thumb="yes"');
  });

  test("item with only native elements is inserted as an editable group", async ({
    page,
    editorState,
  }) => {
    await openLibrary(page);
    await importLibOk(
      page,
      "natives-only.archidrawlib",
      lib([{ name: "Natives Only", archidrawElements: [nativeRect] }]),
    );

    const stored = await page.evaluate(() => {
      const libs = JSON.parse(localStorage.getItem("archidraw:importedLibraries") || "[]");
      return libs[0].items[0] as { svg: string; elements?: unknown[] };
    });
    expect(stored.svg).toContain("<svg");
    expect(stored.svg).not.toContain("NaN");
    expect(stored.elements).toHaveLength(1);

    await page.locator('[data-testid="library-imported-group"] .library-tile').first().click();
    const state = await editorState();
    expect(state.elementCount).toBe(1);
    expect(state.elements[0].type).toBe("rectangle");
    const el = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0],
    );
    expect(el.roughness).toBe(3);
  });

  test("the thumbnail is rendered from the native elements, sketch stroke included", async ({
    page,
  }) => {
    await openLibrary(page);
    await importLibOk(
      page,
      "thumb-from-natives.archidrawlib",
      lib([
        {
          name: "Sketch",
          elements: [{ type: "rectangle", x: 0, y: 0, width: 80, height: 40, opacity: 100 }],
          archidrawElements: [nativeRect],
        },
      ]),
    );
    const svg = await page.evaluate(() => {
      const libs = JSON.parse(localStorage.getItem("archidraw:importedLibraries") || "[]");
      return libs[0].items[0].svg as string;
    });
    // o item nativo tem roughness 3: o thumbnail vem dele (path hand-drawn),
    // não do dialeto Excalidraw (que desenharia um <rect> limpo)
    expect(svg).toContain("<svg");
    expect(svg).not.toContain("<rect");
  });

  test("an entry with neither elements nor natives is dropped, the rest imports", async ({
    page,
  }) => {
    await openLibrary(page);
    await importLibOk(
      page,
      "drop-empty.archidrawlib",
      lib([
        { name: "Nowhere", elements: [], archidrawElements: [] },
        { name: "Kept", archidrawElements: [nativeRect] },
      ]),
    );

    const group = page.locator('[data-testid="library-imported-group"]');
    await expect(group.locator(".library-tile")).toHaveCount(1);
    await expect(group.locator(".library-group-name")).toHaveText("drop-empty");
  });

  test("name, thumbnail and natives all come from the same entry", async ({
    page,
    editorState,
  }) => {
    await openLibrary(page);
    await importLibOk(
      page,
      "aligned.archidrawlib",
      lib([
        { name: "Nowhere", elements: [], archidrawElements: [] },
        {
          name: "Aligned",
          elements: [{ type: "rectangle", x: 0, y: 0, width: 80, height: 40, opacity: 100 }],
          archidrawElements: [nativeRect],
        },
      ]),
    );
    const items = await page.evaluate(() => {
      const libs = JSON.parse(localStorage.getItem("archidraw:importedLibraries") || "[]");
      return libs[0].items as { name: string; elements?: unknown[] }[];
    });
    // o item pulado não pode deslocar o wrapper do item seguinte
    expect(items.map((it) => it.name)).toEqual(["Aligned"]);
    expect(items[0].elements).toHaveLength(1);

    await page.locator('[data-testid="library-imported-group"] .library-tile').first().click();
    const state = await editorState();
    expect(state.elements[0].type).toBe("rectangle");
  });

  test("invalid or empty archidrawElements fall back to a raster component", async ({
    page,
    editorState,
  }) => {
    await openLibrary(page);
    await importLibOk(
      page,
      "fallback.archidrawlib",
      lib([
        {
          name: "Invalid",
          elements: [{ type: "rectangle", x: 0, y: 0, width: 80, height: 40, opacity: 100 }],
          archidrawElements: [{ type: "star" }],
        },
        {
          name: "Empty",
          elements: [{ type: "ellipse", x: 0, y: 0, width: 80, height: 40, opacity: 100 }],
          archidrawElements: [],
        },
        {
          name: "NoSvgMarkup",
          elements: [{ type: "diamond", x: 0, y: 0, width: 80, height: 40, opacity: 100 }],
          svg: "not svg at all",
        },
        {
          name: "NonStringSvg",
          elements: [{ type: "ellipse", x: 0, y: 60, width: 80, height: 40, opacity: 100 }],
          svg: 42,
        },
      ]),
    );

    // the NoSvgMarkup item's bad svg must be regenerated, not stored verbatim
    const storedSvgs = await page.evaluate(() => {
      const libs = JSON.parse(localStorage.getItem("archidraw:importedLibraries") || "[]");
      return libs[0].items.map((it: { svg: string }) => it.svg);
    });
    expect(storedSvgs[2]).toContain("<svg");
    expect(storedSvgs[2]).not.toBe("not svg at all");
    expect(storedSvgs[3]).toContain("<svg");

    await page
      .locator('[data-testid="library-imported-group"] .library-tile')
      .first()
      .click();
    const state = await editorState();
    expect(state.elements[0].type).toBe("component");
    expect(state.elements[0].componentId).toMatch(/^imp-/);
  });
});