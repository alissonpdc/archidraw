import { test, expect, open } from "../fixtures";
import { type Download, type Page } from "@playwright/test";

const EMBEDDED_SVG =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#ff0000"/></svg>',
  );

function base(
  id: string,
  type: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  return {
    id,
    type,
    x,
    y,
    width,
    height,
    strokeColor: "#3d4248",
    backgroundColor: "transparent",
    strokeWidth: 2,
    opacity: 1,
    strokeOpacity: 1,
    fillOpacity: 1,
    strokeStyle: "solid",
    fillStyle: "solid",
    roughness: 0,
    borderRadius: 0,
  };
}

function richElements() {
  return [
    { ...base("r1", "rectangle", 20, 20, 80, 50), backgroundColor: "#a5d8ff", borderRadius: 10 },
    { ...base("r2", "rectangle", 120, 20, 80, 50), backgroundColor: "#ffc9c9", fillStyle: "hachure" },
    { ...base("r3", "rectangle", 220, 20, 80, 50), backgroundColor: "#b2f2bb", fillStyle: "cross-hachure" },
    { ...base("r4", "rectangle", 20, 90, 80, 50), backgroundColor: "#a5d8ff", roughness: 2 },
    { ...base("r5", "rectangle", 120, 90, 80, 50), backgroundColor: "#ffe066", fillStyle: "hachure", roughness: 1 },
    { ...base("d1", "diamond", 220, 90, 80, 50), backgroundColor: "#b197fc" },
    { ...base("d2", "diamond", 320, 90, 80, 50), backgroundColor: "#96f2d7", fillStyle: "hachure" },
    { ...base("e1", "ellipse", 20, 170, 80, 50), backgroundColor: "#ffc9c9", opacity: 0.5 },
    { ...base("c1", "component", 120, 170, 64, 64), componentId: "ec2", src: EMBEDDED_SVG },
    { ...base("c2", "component", 200, 170, 64, 64), componentId: "s3" },
    { ...base("l1", "line", 20, 260, 100, 0) },
    { ...base("l2", "line", 140, 260, 100, 60), lineType: "curved", controlPoint: { x: 190, y: 290 } },
    { ...base("l3", "line", 260, 260, 120, 60), lineType: "auto", bendPoints: [{ x: 320, y: 280 }, { x: 340, y: 310 }] },
    { ...base("l4", "line", 400, 260, 100, 40), strokeWidth: 0 },
    { ...base("l5", "line", 20, 340, 100, 40), strokeStyle: "dashed" },
    { ...base("a1", "arrow", 140, 340, 100, 40), endArrowhead: "arrow" },
    { ...base("a2", "arrow", 260, 340, 100, 40), endArrowhead: "triangle" },
    { ...base("a3", "arrow", 380, 340, 100, -40), endArrowhead: "circle" },
    { ...base("a4", "arrow", 20, 420, 100, 40), startArrowhead: "triangle", endArrowhead: "arrow", roughness: 2 },
    { ...base("a5", "arrow", 140, 420, 100, 60), lineType: "curved", controlPoint: { x: 190, y: 450 }, endArrowhead: "arrow" },
    { ...base("a6", "arrow", 260, 420, 120, 60), lineType: "auto", bendPoints: [{ x: 320, y: 440 }], endArrowhead: "triangle" },
    { ...base("t1", "text", 20, 520, 200, 60), text: "Hello\nWorld", fontSize: 24 },
  ];
}

async function openWithElements(page: Page, elements: unknown[]) {
  await open(page);
  await page.evaluate((els) => {
    const ed = window.__editor__;
    ed.restoreState(
      JSON.stringify({
        schemaVersion: 2,
        activeTabId: "t",
        tabs: [
          {
            id: "t",
            name: "rich",
            doc: { schemaVersion: 1, elements: els },
            camera: { scrollX: 0, scrollY: 0, zoom: 1 },
          },
        ],
      }),
    );
  }, elements);
}

async function openRichScene(page: Page) {
  await openWithElements(page, richElements());
}

async function readBuf(download: Download) {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

test.describe("rich export", () => {
  test("SVG export emits every element type and style", async ({ page }) => {
    await openRichScene(page);

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.svg$/);
    const svg = (await readBuf(download)).toString("utf-8");

    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trim().endsWith("</svg>")).toBe(true);
    expect(svg).toContain("<rect");
    expect(svg).toContain("<polygon");
    expect(svg).toContain("<ellipse");
    expect(svg).toContain("<image");
    expect(svg).toContain("<line");
    expect(svg).toContain("<text");
    expect(svg).toContain("Hello");
    expect(svg).toContain("World");
    expect(svg).toContain("clipPath");
    expect(svg).toContain("hatch-r2");
    expect(svg).toContain("hatch-r3");
    expect(svg).toContain("hatch-r5");
    expect(svg).toContain("stroke-dasharray");
    expect(svg).toContain('opacity="0.5"');
  });

  test("PNG export renders the rich scene to a real image", async ({
    page,
  }) => {
    await openRichScene(page);

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "PNG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.png$/);
    const buf = await readBuf(download);
    expect(buf.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(buf.length).toBeGreaterThan(1000);
  });
});

const RECT_ELEMENTS = [
  {
    id: "r1",
    type: "rectangle",
    x: 200,
    y: 150,
    width: 120,
    height: 70,
    strokeColor: "#3d4248",
    backgroundColor: "#a5d8ff",
    strokeWidth: 2,
    opacity: 1,
    strokeOpacity: 1,
    fillOpacity: 1,
    strokeStyle: "solid",
    fillStyle: "solid",
    roughness: 0,
    borderRadius: 0,
  },
];

const TWO_ELEMENTS = [
  ...RECT_ELEMENTS,
  {
    ...RECT_ELEMENTS[0],
    id: "e1",
    type: "ellipse",
    x: 200,
    y: 150,
    width: 60,
    height: 40,
    backgroundColor: "#ffc9c9",
  },
];

async function rightClick(page: Page, x: number, y: number) {
  await page.mouse.click(x, y, { button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
}

test.describe("context menu export surface", () => {
  test("Copy as SVG / Copy as PNG attempted without crashing", async ({
    page,
  }) => {
    await openWithElements(page, RECT_ELEMENTS);
    await rightClick(page, 260, 185);

    const copyParent = page.getByTestId("context-menu-copy-image");
    await copyParent.hover();
    await page.getByTestId("context-menu-copy-svg").click();
    await expect(page.getByTestId("context-menu")).toHaveCount(0);

    await rightClick(page, 260, 185);
    await copyParent.hover();
    await page.getByTestId("context-menu-copy-png").click();
    await expect(page.getByTestId("context-menu")).toHaveCount(0);
  });

  test("Download as SVG and PNG from the element menu", async ({ page }) => {
    await openWithElements(page, RECT_ELEMENTS);
    await rightClick(page, 260, 185);

    const downloadParent = page.getByTestId("context-menu-download");
    const svgPromise = page.waitForEvent("download");
    await downloadParent.hover();
    await page.getByTestId("context-menu-download-svg").click();
    const svg = await svgPromise;
    expect(svg.suggestedFilename()).toMatch(/\.svg$/);
    expect((await readBuf(svg)).toString("utf-8")).toContain("<rect");

    await rightClick(page, 260, 185);
    const pngPromise = page.waitForEvent("download");
    await downloadParent.hover();
    await page.getByTestId("context-menu-download-png").click();
    const png = await pngPromise;
    expect(png.suggestedFilename()).toMatch(/\.png$/);
    expect((await readBuf(png)).subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  test("Layers submenu reorders the element without crashing", async ({
    page,
    editorState,
  }) => {
    await openWithElements(page, TWO_ELEMENTS);

    for (const action of [
      "context-menu-bring-to-front",
      "context-menu-send-to-back",
      "context-menu-bring-forward",
      "context-menu-send-backward",
    ]) {
      await rightClick(page, 230, 170);
      await page.getByTestId("context-menu-layers").hover();
      await page.getByTestId(action).click();
      await expect(page.getByTestId("context-menu")).toHaveCount(0);
    }

    const s = await editorState();
    expect(s.elementCount).toBe(2);
  });

  test("Lock / Unlock toggles the element lock flag", async ({ page }) => {
    await openWithElements(page, RECT_ELEMENTS);
    await rightClick(page, 260, 185);
    await page.getByTestId("context-menu-toggle-lock").click();
    await expect(page.getByTestId("context-menu")).toHaveCount(0);

    const locked = await page.evaluate(() => {
      const ed = window.__editor__;
      return ed.getSnapshot().doc.elements[0].locked === true;
    });
    expect(locked).toBe(true);

    await rightClick(page, 260, 185);
    const unlock = page.getByRole("menuitem", { name: "Unlock" });
    await expect(unlock).toBeVisible();
    await unlock.click();
    const unlocked = await page.evaluate(() => {
      const ed = window.__editor__;
      return ed.getSnapshot().doc.elements[0].locked !== true;
    });
    expect(unlocked).toBe(true);
  });

  test("Copy Style / Paste Style transfers visual properties", async ({
    page,
  }) => {
    await openWithElements(page, TWO_ELEMENTS);

    await rightClick(page, 290, 205);
    await page.getByTestId("context-menu-copy-style").click();
    await expect(page.getByTestId("context-menu")).toHaveCount(0);

    await page.mouse.click(600, 600);
    await expect(page.getByTestId("context-menu")).toHaveCount(0);

    await rightClick(page, 230, 170);
    await page.getByTestId("context-menu-paste-style").click();
    await expect(page.getByTestId("context-menu")).toHaveCount(0);

    const colors = await page.evaluate(() => {
      const ed = window.__editor__;
      const els = ed.getSnapshot().doc.elements;
      return els.map((el: any) => el.backgroundColor);
    });
    expect(colors).toEqual(["#a5d8ff", "#a5d8ff"]);
  });

  test("Highlight Flow marks the whole dependency chain", async ({ page }) => {
    const BOUND_ARROW_SCENE = [
      {
        ...RECT_ELEMENTS[0],
        id: "s1",
        backgroundColor: "#a5d8ff",
      },
      {
        ...RECT_ELEMENTS[0],
        id: "s2",
        x: 420,
        backgroundColor: "#b2f2bb",
      },
      {
        ...base("ar1", "arrow", 320, 185, 100, 0),
        endArrowhead: "arrow" as string,
        startBinding: { elementId: "s1", nx: 1, ny: 0.5 },
        endBinding: { elementId: "s2", nx: 0, ny: 0.5 },
      },
    ];

    await openWithElements(page, BOUND_ARROW_SCENE);
    await rightClick(page, 260, 185);
    await page.getByTestId("context-menu-highlight-deps").click();
    await expect(page.getByTestId("context-menu")).toHaveCount(0);

    const highlighted = await page.evaluate(() => {
      const ed = window.__editor__;
      return [...ed.highlightedIds].sort();
    });
    expect(highlighted).toEqual(["ar1", "s1", "s2"]);
  });
});