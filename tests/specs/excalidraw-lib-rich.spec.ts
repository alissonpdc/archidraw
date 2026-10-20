import { test, expect, open } from "../fixtures";
import { type Page } from "@playwright/test";

async function openLibrary(page: Page) {
  await open(page);
  await page.keyboard.press("l");
  await expect(page.locator(".library-panel")).toBeVisible();
}

async function importLib(page: Page, name: string, content: string) {
  await page.locator('[data-testid="library-import"]').click();
  await page.locator(".library-import-input").setInputFiles({
    name,
    mimeType: "application/json",
    buffer: Buffer.from(content, "utf-8"),
  });
}

function svgPayload(page: Page, groupName: string) {
  return page.evaluate((name) => {
    const libs = JSON.parse(
      localStorage.getItem("archidraw:importedLibraries") || "[]",
    );
    const lib = libs.find((l: { name: string }) => l.name === name);
    return lib?.items?.map((it: { svg: string }) => it.svg).join("\n") ?? "";
  }, groupName);
}

const POINT = (x: number, y: number) => ({ x, y });

test.describe("excalidrawlib SVG generation", () => {
  test("v2 libraryItems with shapes, edges, draw, text and angles produce valid SVG", async ({
    page,
  }) => {
    await openLibrary(page);
    await importLib(
      page,
      "rich.excalidrawlib",
      JSON.stringify({
        type: "excalidrawlib",
        version: 2,
        libraryItems: [
          {
            id: "r1",
            name: "Mixed Elements",
            elements: [
              {
                type: "rectangle",
                x: 0,
                y: 0,
                width: 80,
                height: 40,
                roundness: { type: 3 },
                strokeColor: "#1e1e1e",
                backgroundColor: "#a5d8ff",
                fillStyle: "hachure",
                strokeWidth: 2,
                strokeStyle: "dashed",
                opacity: 100,
              },
              {
                type: "ellipse",
                x: 90,
                y: 0,
                width: 60,
                height: 40,
                angle: Math.PI / 4,
                strokeColor: "#e03131",
                backgroundColor: "transparent",
                strokeWidth: 2,
                opacity: 100,
              },
              {
                type: "diamond",
                x: 0,
                y: 60,
                width: 60,
                height: 40,
                strokeColor: "#1e1e1e",
                backgroundColor: "#b2f2bb",
                fillStyle: "cross-hatch",
                strokeWidth: 1,
                opacity: 60,
              },
              {
                type: "line",
                x: 120,
                y: 60,
                width: 100,
                height: 40,
                points: [
                  [0, 40],
                  [100, 40],
                ],
                strokeColor: "#1e1e1e",
                strokeWidth: 2,
                opacity: 100,
              },
              {
                type: "draw",
                x: 0,
                y: 120,
                width: 80,
                height: 40,
                points: [
                  [0, 20],
                  [30, 0],
                  [60, 40],
                  [80, 10],
                ],
                strokeColor: "#1971c2",
                backgroundColor: "#e7f5ff",
                fillStyle: "solid",
                strokeWidth: 2,
                opacity: 100,
              },
              {
                type: "arrow",
                x: 120,
                y: 120,
                width: 100,
                height: 40,
                points: [
                  [0, 40],
                  [100, 40],
                ],
                startArrowhead: "arrow",
                endArrowhead: "triangle",
                strokeColor: "#1e1e1e",
                strokeWidth: 2,
                opacity: 100,
              },
              {
                type: "text",
                x: 0,
                y: 200,
                width: 120,
                height: 40,
                text: "Node\nHi",
                fontSize: 16,
                fontFamily: 3,
                strokeColor: "#1e1e1e",
                opacity: 100,
              },
              {
                type: "thingamajig",
                x: 0,
                y: 0,
                width: 10,
                height: 10,
                strokeColor: "#000",
                opacity: 100,
              },
              {
                // missing geometry/stroke fields lean on defaults
                type: "rectangle",
                x: 300,
                y: 0,
              },
              {
                type: "text",
                x: 300,
                y: 200,
                width: 100,
                height: 25,
                text: "Default size",
                strokeColor: "#1e1e1e",
                opacity: 100,
              },
              {
                // closed draw loop (start ≈ end) prints a filled Z path
                type: "draw",
                x: 300,
                y: 120,
                width: 80,
                height: 40,
                points: [
                  [0, 20],
                  [40, 0],
                  [80, 20],
                  [0, 20],
                ],
                strokeColor: "#1971c2",
                backgroundColor: "#e7f5ff",
                fillStyle: "solid",
                strokeWidth: 2,
                opacity: 100,
              },
            ],
          },
          {
            id: "n2",
            elements: [
              {
                type: "rectangle",
                x: 0,
                y: 0,
                width: 10,
                height: 10,
                strokeColor: "#000",
                opacity: 100,
              },
            ],
          },
        ],
      }),
    );

    const group = page.locator('[data-testid="library-imported-group"]');
    await expect(group).toHaveCount(1);
    await expect(group.locator(".library-tile")).toHaveCount(2);

    const svg = await svgPayload(page, "rich");
    expect(svg).toContain("<rect");
    expect(svg).toContain(' rx="');
    expect(svg).toContain("<ellipse");
    expect(svg).toContain('transform="rotate(');
    expect(svg).toContain("<polygon");
    expect(svg).toContain('fill-opacity="0.4"');
    expect(svg).toContain('fill-opacity="0.6"');
    expect(svg).toContain("stroke-dasharray");
    expect(svg).toContain("<path");
    expect(svg).toContain("opacity=\"0.6\"");
    expect(svg).toContain("<text");
    expect(svg).toContain("Cascadia");
    expect(svg).toContain("<tspan");
    // text without fontSize falls back to 20
    expect(svg).toContain('font-size="20"');
    // a default-stroked element and a closed draw both render
    expect(svg).toContain('stroke="#000000"');
    // unknown element type is skipped without corrupting the SVG
    expect(svg).not.toContain("thingamajig");
  });

  test("v1 {library} root and bare-array root import their items", async ({
    page,
  }) => {
    await openLibrary(page);

    await importLib(
      page,
      "v1.excalidrawlib",
      JSON.stringify({
        type: "excalidrawlib",
        version: 1,
        library: [
          [
            {
              type: "rectangle",
              x: 0,
              y: 0,
              width: 20,
              height: 10,
              strokeColor: "#000",
              opacity: 100,
            },
          ],
        ],
      }),
    );
    await expect(
      page.locator('[data-testid="library-imported-group"]'),
    ).toHaveCount(1);

    await importLib(
      page,
      "array.excalidrawlib",
      JSON.stringify([
        [
          {
            type: "ellipse",
            x: 0,
            y: 0,
            width: 20,
            height: 10,
            strokeColor: "#000",
            opacity: 100,
          },
        ],
      ]),
    );
    await expect(
      page.locator('[data-testid="library-imported-group"]'),
    ).toHaveCount(2);

    const v1 = await svgPayload(page, "v1");
    expect(v1).toContain("<rect");
    const arr = await svgPayload(page, "array");
    expect(arr).toContain("<ellipse");
  });

  test("empty library file shows a parse error instead of a group", async ({
    page,
  }) => {
    await openLibrary(page);
    await importLib(
      page,
      "empty.excalidrawlib",
      JSON.stringify({ type: "excalidrawlib", version: 2, libraryItems: [] }),
    );

    await expect(
      page.locator('[data-testid="library-imported-group"]'),
    ).toHaveCount(0);
    await expect(page.locator(".library-error")).toBeVisible();
  });
});