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

function richScene() {
  return [
    // --- shapes with every stroke/fill/border/roughness variant ---------
    { ...base("r1", "rectangle", 20, 20, 80, 50), backgroundColor: "#a5d8ff", borderRadius: 10 },
    { ...base("r2", "rectangle", 120, 20, 80, 50), backgroundColor: "#ffc9c9", fillStyle: "hachure" },
    { ...base("r3", "rectangle", 220, 20, 80, 50), backgroundColor: "#b2f2bb", fillStyle: "cross-hachure" },
    { ...base("r4", "rectangle", 320, 20, 80, 50), backgroundColor: "#a5d8ff", roughness: 2, borderRadius: 20 },
    { ...base("r5", "rectangle", 20, 90, 80, 50), backgroundColor: "#ffe066", fillStyle: "hachure", fillOpacity: 0.5 },
    { ...base("r6", "rectangle", 120, 90, 80, 50), strokeStyle: "dashed" },
    { ...base("r7", "rectangle", 220, 90, 80, 50), strokeStyle: "dotted", opacity: 0.6, label: "Dotted" },
    { ...base("r8", "rectangle", 320, 90, 80, 50), strokeStyle: "dashdot", label: "Multi\nLine", labelT: 0.3 },
    { ...base("r9", "rectangle", 420, 90, 80, 50), opacity: 0.4, label: "Faded", bold: true },
    { ...base("d1", "diamond", 20, 170, 80, 50), backgroundColor: "#b197fc", label: "Diamond" },
    { ...base("d2", "diamond", 120, 170, 80, 50), backgroundColor: "#96f2d7", fillStyle: "hachure", roughness: 2 },
    { ...base("d3", "diamond", 220, 170, 80, 50), backgroundColor: "#ffc9c9", roughness: 3 },
    { ...base("e1", "ellipse", 320, 170, 80, 50), backgroundColor: "#ffc9c9", fillStyle: "hachure", roughness: 1 },
    { ...base("e2", "ellipse", 420, 170, 80, 50), backgroundColor: "#a5d8ff", roughness: 2, label: "Oval" },
    // --- components: embedded src vs icon-only, captions on every side ---
    { ...base("c1", "component", 20, 260, 64, 64), componentId: "ec1", src: EMBEDDED_SVG, fill: true, label: "Node", captionPosition: "top", captionGap: 8, captionOffsetTop: 5 },
    { ...base("c2", "component", 100, 260, 64, 64), componentId: "ec2", src: EMBEDDED_SVG, fill: true, label: "Below", captionPosition: "bottom", captionOffsetBottom: 4 },
    { ...base("c3", "component", 180, 260, 64, 64), componentId: "ec3", src: EMBEDDED_SVG, fill: true, label: "Left", captionPosition: "left", captionOffsetLeft: 3 },
    { ...base("c4", "component", 260, 260, 64, 64), componentId: "ec4", src: EMBEDDED_SVG, fill: true, label: "Right", captionPosition: "right", captionOffsetRight: 3 },
    { ...base("c5", "component", 340, 260, 64, 64), componentId: "s3" },
    // --- edges ------------------------------------------------------------
    { ...base("l1", "line", 20, 360, 100, 0) },
    { ...base("l2", "line", 140, 360, 100, 60), lineType: "curved", controlPoint: { x: 190, y: 390 } },
    { ...base("l3", "line", 260, 360, 120, 60), lineType: "auto", bendPoints: [{ x: 320, y: 380 }, { x: 340, y: 410 }] },
    { ...base("l4", "line", 400, 360, 100, 40), roughness: 2 },
    { ...base("l5", "line", 20, 440, 100, 40), strokeStyle: "dashed", label: "dashed" },
    { ...base("a1", "arrow", 140, 440, 100, 40), endArrowhead: "arrow" },
    { ...base("a2", "arrow", 260, 440, 100, 40), endArrowhead: "triangle", startArrowhead: "circle" },
    { ...base("a3", "arrow", 380, 440, 100, -40), endArrowhead: "circle" },
    { ...base("a4", "arrow", 20, 520, 100, 40), startArrowhead: "triangle", endArrowhead: "arrow", roughness: 2 },
    { ...base("a5", "arrow", 140, 520, 100, 60), lineType: "curved", controlPoint: { x: 190, y: 550 }, endArrowhead: "arrow" },
    { ...base("a6", "arrow", 260, 520, 120, 60), lineType: "auto", bendPoints: [{ x: 320, y: 540 }], endArrowhead: "triangle" },
    { ...base("a7", "arrow", 400, 520, 100, 40), strokeStyle: "dashed", endArrowhead: "none", startArrowhead: "none", label: "none" },
    // --- text: alignment / vertical alignment / decorations ----------------
    { ...base("t1", "text", 20, 620, 200, 60), text: "Hello\nWorld", fontSize: 24 },
    { ...base("t2", "text", 240, 620, 200, 70), text: "Center\nTop", fontSize: 20, textAlign: "center", textVAlign: "top", bold: true, underline: true },
    { ...base("t3", "text", 460, 620, 200, 70), text: "Right\nBottom", fontSize: 20, textAlign: "right", textVAlign: "bottom", italic: true, lineSpacing: 1.5 },
    { ...base("t4", "text", 40, 720, 140, 30), text: "Sketchy font", fontSize: 18, fontFamily: '"Architects Daughter", cursive', underline: true },
  ];
}

async function openRichScene(page: Page) {
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
  }, richScene());
}

async function readBuf(download: Download) {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

test.describe("rich rendering + export", () => {
  test("every element style renders and exports without losing structure", async ({
    page,
  }) => {
    await openRichScene(page);

    const model = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const els = ed.getSnapshot().doc.elements;
      return {
        count: els.length,
        types: [...new Set(els.map((e: any) => e.type))].sort(),
        aligns: [
          ...new Set(els.filter((e: any) => e.textAlign).map((e: any) => `${e.textAlign}:${e.textVAlign ?? "middle"}`)),
        ].sort(),
        arrows: els
          .filter((e: any) => e.type === "arrow")
          .map((e: any) => `${e.lineType ?? "straight"}/${e.endArrowhead ?? "arrow"}/${e.roughness ?? 0}`)
          .sort(),
      };
    });
    expect(model.count).toBe(richScene().length);
    expect(model.types).toEqual([
      "arrow",
      "component",
      "diamond",
      "ellipse",
      "line",
      "rectangle",
      "text",
    ]);
    expect(model.aligns).toEqual(["center:top", "right:bottom"]);
    expect(model.arrows).toEqual([
      "auto/triangle/0",
      "curved/arrow/0",
      "straight/arrow/0",
      "straight/arrow/2",
      "straight/circle/0",
      "straight/none/0",
      "straight/triangle/0",
    ]);

    // Export SVG: every serializable type must be present
    const svgPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const svgDownload = await svgPromise;
    expect(svgDownload.suggestedFilename()).toMatch(/\.svg$/);
    const svg = (await readBuf(svgDownload)).toString("utf-8");
    expect(svg).toContain("<rect");
    expect(svg).toContain("<polygon");
    expect(svg).toContain("<ellipse");
    expect(svg).toContain("<image");
    expect(svg).toContain("<line");
    expect(svg).toContain("<path");
    expect(svg).toContain("stroke-dasharray");
    expect(svg).toContain("clipPath");

    // Export PNG end-to-end (reopens the export modal)
    const pngPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "PNG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const png = await pngPromise;
    const buf = await readBuf(png);
    expect(buf.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });
});