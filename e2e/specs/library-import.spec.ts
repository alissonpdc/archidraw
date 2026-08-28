import { type Page, test, expect, open } from "../fixtures";

/** opens the library panel; groups start collapsed */
async function openLibrary(page: Page) {
  await open(page);
  await page.keyboard.press("b");
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
    await expect(group.locator(".library-group-name")).toHaveText("my icons");
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
    await page.keyboard.press("b");

    const group = page.locator('[data-testid="library-imported-group"]');
    await expect(group).toHaveCount(1);
    await expect(group.locator(".library-group-name")).toHaveText("my icons");
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
    await page.keyboard.press("b");
    await expect(
      page.locator('[data-testid="library-imported-group"]'),
    ).toHaveCount(0);
  });
});