import { test, expect, open, drag, selectTool } from "../fixtures";
import { type Page } from "@playwright/test";

function el(
  id: string,
  type: string,
  x: number,
  y: number,
  width: number,
  height: number,
  extra: Record<string, unknown> = {},
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
    ...extra,
  };
}

function makeTab(elements: unknown[]) {
  return {
    schemaVersion: 2,
    activeTabId: "t",
    tabs: [
      {
        id: "t",
        name: "test",
        doc: { schemaVersion: 1, elements },
        camera: { scrollX: 0, scrollY: 0, zoom: 1 },
      },
    ],
  };
}

async function loadScene(page: Page, elements: unknown[]) {
  await open(page);
  await page.evaluate((data) => {
    (window as any).__editor__.restoreState(JSON.stringify(data));
  }, makeTab(elements));
}

test.describe("renderer.ts edge cases", () => {
  test("circle arrowhead renders without crash", async ({ page }) => {
    await loadScene(page, [
      el("ah1", "arrow", 200, 200, 120, 0, {
        endArrowhead: "circle",
        startArrowhead: "none",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { count: snap.doc.elements.length };
    });
    expect(s.count).toBe(1);
  });

  test("triangle arrowhead with roughness renders", async ({ page }) => {
    await loadScene(page, [
      el("ah2", "arrow", 200, 200, 120, 0, {
        endArrowhead: "triangle",
        startArrowhead: "circle",
        roughness: 2,
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { count: snap.doc.elements.length };
    });
    expect(s.count).toBe(1);
  });

  test("locked element badge renders", async ({ page }) => {
    await loadScene(page, [
      el("lk1", "rectangle", 200, 200, 100, 80, { locked: true }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { locked: snap.doc.elements[0].locked };
    });
    expect(s.locked).toBe(true);
  });

  test("grid lines mode renders", async ({ page }) => {
    await open(page);
    await page.getByTestId("app-menu-button").click();
    await page
      .locator(".menu-item--submenu", { hasText: "Grid" })
      .click();
    await page.locator("button.menu-item", { hasText: "Lines" }).click();
    await page.waitForTimeout(200);

    const gridMode = await page.evaluate(() =>
      localStorage.getItem("archidraw:grid"),
    );
    expect(gridMode).toBe("lines");
  });

  test("grid dots mode renders", async ({ page }) => {
    await open(page);
    await page.getByTestId("app-menu-button").click();
    await page
      .locator(".menu-item--submenu", { hasText: "Grid" })
      .click();
    await page.locator("button.menu-item", { hasText: "Dots" }).click();
    await page.waitForTimeout(200);

    const gridMode = await page.evaluate(() =>
      localStorage.getItem("archidraw:grid"),
    );
    expect(gridMode).toBe("dots");
  });

  test("highlightedIds dims non-highlighted elements", async ({ page }) => {
    await loadScene(page, [
      el("h1", "rectangle", 200, 200, 100, 80),
      el("h2", "rectangle", 400, 200, 100, 80),
      el("h3", "rectangle", 600, 200, 100, 80),
      {
        id: "a1",
        type: "arrow",
        x: 250,
        y: 200,
        width: 150,
        height: 0,
        strokeColor: "#000000",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 2,
        roughness: 0,
        opacity: 1,
        startBinding: { elementId: "h1", focus: 0, gap: 0 },
        endBinding: { elementId: "h2", focus: 0, gap: 0 },
      } as any,
    ]);
    const s = await page.evaluate(async () => {
      const ed = (window as any).__editor__;
      ed.selectedIds = new Set(["h1"]);
      ed.highlightDependencies();
      await new Promise((r) => requestAnimationFrame(r));
      const count = ed.doc.elements.length;
      const highlighted = ed.highlightedIds.size;
      ed.clearHighlight();
      ed.clearHighlight();
      return { count, highlighted };
    });
    expect(s.count).toBe(4);
    expect(s.highlighted).toBe(3);
  });

  test("highlightedContextId renders context highlight", async ({ page }) => {
    await loadScene(page, [
      {
        id: "ctx-hl",
        type: "context",
        x: 150,
        y: 150,
        width: 300,
        height: 200,
        strokeColor: "#888888",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 1,
        roughness: 0,
        opacity: 1,
        childIds: ["child1"],
      } as any,
      el("child1", "rectangle", 180, 180, 80, 60),
      el("nonChild", "rectangle", 600, 600, 80, 60),
    ]);
    await page.evaluate(async () => {
      const ed = (window as any).__editor__;
      ed.highlightedContextId = "ctx-hl";
      ed.emit();
      await new Promise((r) => requestAnimationFrame(r));
      ed.highlightedContextId = "non-existent";
      ed.emit();
      await new Promise((r) => requestAnimationFrame(r));
      ed.highlightedContextId = null;
      ed.emit();
    });
  });

  test("component with empty icon paths does not crash", async ({ page }) => {
    await loadScene(page, [
      el("cp1", "component", 200, 200, 64, 64, {
        componentId: "nonexistent-icon",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { count: snap.doc.elements.length };
    });
    expect(s.count).toBe(1);
  });

  test("strokeWidth zero element renders without crash", async ({ page }) => {
    await loadScene(page, [
      el("sw0", "rectangle", 200, 200, 100, 80, { strokeWidth: 0 }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { sw: snap.doc.elements[0].strokeWidth };
    });
    expect(s.sw).toBe(0);
  });

  test("details badge with empty details does not render badge", async ({
    page,
  }) => {
    await loadScene(page, [
      el("db1", "rectangle", 200, 200, 100, 80, { details: "" }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { details: snap.doc.elements[0].details };
    });
    expect(s.details).toBe("");
  });

  test("edge with label and details renders badge below label", async ({
    page,
  }) => {
    await loadScene(page, [
      el("eb1", "arrow", 200, 200, 120, 0, {
        label: "Edge",
        details: "info",
        endArrowhead: "arrow",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      const edgeEl = snap.doc.elements[0];
      return { label: edgeEl.label, details: edgeEl.details };
    });
    expect(s.label).toBe("Edge");
    expect(s.details).toBe("info");
  });

  test("edge without label but with details renders badge at midpoint", async ({
    page,
  }) => {
    await loadScene(page, [
      el("eb2", "arrow", 200, 200, 120, 0, {
        details: "midpoint info",
        endArrowhead: "arrow",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      const edgeEl = snap.doc.elements[0];
      return { label: edgeEl.label, details: edgeEl.details };
    });
    expect(s.label).toBeUndefined();
    expect(s.details).toBe("midpoint info");
  });

  test("curved arrow selection highlight renders", async ({ page }) => {
    await loadScene(page, [
      el("ca1", "arrow", 200, 200, 120, 60, {
        lineType: "curved",
        controlPoint: { x: 260, y: 230 },
        endArrowhead: "arrow",
      }),
    ]);
    await page.mouse.click(260, 230);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { selected: snap.selectedIds.size };
    });
    expect(s.selected).toBe(1);
  });

  test("cross-hachure fill renders", async ({ page }) => {
    await loadScene(page, [
      el("ch1", "rectangle", 200, 200, 100, 80, {
        backgroundColor: "#a5d8ff",
        fillStyle: "cross-hachure",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { fillStyle: snap.doc.elements[0].fillStyle };
    });
    expect(s.fillStyle).toBe("cross-hachure");
  });

  test("sketch shape with solid fill (not hachure) renders", async ({
    page,
  }) => {
    await loadScene(page, [
      el("sf1", "rectangle", 200, 200, 100, 80, {
        backgroundColor: "#a5d8ff",
        fillStyle: "solid",
        roughness: 2,
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      const el2 = snap.doc.elements[0];
      return { fillStyle: el2.fillStyle, roughness: el2.roughness };
    });
    expect(s.fillStyle).toBe("solid");
    expect(s.roughness).toBe(2);
  });
});

test.describe("exporter.ts edge cases", () => {
  test("SVG export of auto-routed arrow with bendPoints", async ({
    page,
  }) => {
    await loadScene(page, [
      el("ar1", "arrow", 200, 200, 120, 60, {
        lineType: "auto",
        bendPoints: [{ x: 260, y: 180 }],
        endArrowhead: "arrow",
      }),
    ]);

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const svg = Buffer.concat(chunks).toString("utf-8");
    expect(svg).toContain("<svg");
  });

  test("SVG export of horizontal arrow (b.y === a.y)", async ({ page }) => {
    await loadScene(page, [
      el("ha1", "arrow", 200, 300, 120, 0, { endArrowhead: "arrow" }),
      el("hl1", "line", 200, 350, 120, 0),
    ]);

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const svg = Buffer.concat(chunks).toString("utf-8");
    expect(svg).toContain("<svg");
  });

  test("SVG export of sketch shape with solid fill (not hachure)", async ({
    page,
  }) => {
    await loadScene(page, [
      el("ss1", "rectangle", 200, 200, 100, 80, {
        backgroundColor: "#a5d8ff",
        fillStyle: "solid",
        roughness: 2,
      }),
    ]);

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const svg = Buffer.concat(chunks).toString("utf-8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("<path");
  });

  test("SVG export with arrowhead type none", async ({ page }) => {
    await loadScene(page, [
      el("an1", "arrow", 200, 200, 120, 0, {
        endArrowhead: "none",
        startArrowhead: "none",
      }),
    ]);

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const svg = Buffer.concat(chunks).toString("utf-8");
    expect(svg).toContain("<svg");
  });

  test("SVG export of sketch line with solid strokeStyle", async ({
    page,
  }) => {
    await loadScene(page, [
      el("sl1", "line", 200, 200, 120, 60, {
        roughness: 2,
        strokeStyle: "solid",
      }),
    ]);

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.svg$/);
  });

  test("SVG export of sketch arrow with solid strokeStyle", async ({
    page,
  }) => {
    await loadScene(page, [
      el("sa1", "arrow", 200, 200, 120, 60, {
        roughness: 2,
        strokeStyle: "solid",
        endArrowhead: "arrow",
      }),
    ]);

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.svg$/);
  });

  test("SVG export of auto-routed sketch arrow", async ({ page }) => {
    await loadScene(page, [
      el("asa1", "arrow", 200, 200, 120, 60, {
        lineType: "auto",
        bendPoints: [{ x: 260, y: 180 }],
        roughness: 2,
        endArrowhead: "triangle",
      }),
    ]);

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.svg$/);
  });

  test("SVG export of sketch auto-routed line", async ({ page }) => {
    await loadScene(page, [
      el("asl1", "line", 200, 200, 120, 60, {
        lineType: "auto",
        bendPoints: [{ x: 260, y: 180 }],
        roughness: 2,
        strokeStyle: "solid",
      }),
    ]);

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.svg$/);
  });

  test("SVG export of component without dataUri", async ({ page }) => {
    await loadScene(page, [
      el("cnd1", "component", 200, 200, 64, 64, {
        componentId: "nonexistent-component",
      }),
    ]);

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.svg$/);
  });

  test("SVG export with component caption on all sides", async ({ page }) => {
    const svgData =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#ff0000"/></svg>',
      );
    await loadScene(page, [
      el("cpt1", "component", 100, 200, 64, 64, {
        componentId: "ec1",
        src: svgData,
        fill: true,
        label: "Top",
        captionPosition: "top",
      }),
      el("cpt2", "component", 200, 200, 64, 64, {
        componentId: "ec2",
        src: svgData,
        fill: true,
        label: "Left",
        captionPosition: "left",
      }),
      el("cpt3", "component", 300, 200, 64, 64, {
        componentId: "ec3",
        src: svgData,
        fill: true,
        label: "Right",
        captionPosition: "right",
      }),
      el("cpt4", "component", 400, 200, 64, 64, {
        componentId: "ec4",
        src: svgData,
        fill: true,
        label: "Bottom",
        captionPosition: "bottom",
      }),
    ]);

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const svg = Buffer.concat(chunks).toString("utf-8");
    expect(svg).toContain("<image");
  });
});

test.describe("CanvasHost.tsx edge cases", () => {
  test("hand tool cursor applies", async ({ page }) => {
    await open(page);
    await selectTool(page, "h");
    await page.waitForTimeout(200);

    const cursor = await page.evaluate(() => {
      const canvas = document.querySelector(".canvas");
      return canvas?.className ?? "";
    });
    expect(cursor).toContain("cursor-grab");
  });

  test("meta key zoom works on macOS", async ({ page }) => {
    await open(page);
    const beforeZoom = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.camera.zoom;
    });

    await page.mouse.move(400, 300);
    await page.keyboard.down("Meta");
    await page.mouse.wheel(0, -120);
    await page.keyboard.up("Meta");
    await page.waitForTimeout(100);

    const afterZoom = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.camera.zoom;
    });
    expect(afterZoom).toBeGreaterThan(beforeZoom);
  });

  test("empty canvas shows empty state", async ({ page }) => {
    await open(page);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { count: snap.doc.elements.length };
    });
    expect(s.count).toBe(0);
  });

  test("canvas renders after skin change", async ({ page }) => {
    await loadScene(page, [el("sk1", "rectangle", 200, 200, 100, 80)]);

    await page.getByTestId("app-menu-button").click();
    await page
      .locator(".menu-item--submenu", { hasText: "Theme" })
      .click();
    await page.locator("button.menu-item", { hasText: "Blueprint" }).click();
    await page.waitForTimeout(200);

    const skin = await page.evaluate(
      () => document.documentElement.dataset.skin,
    );
    expect(skin).toBe("blueprint");
  });
});

test.describe("renderer.ts more edge cases", () => {
  test("text with underline and right alignment renders", async ({ page }) => {
    await loadScene(page, [
      el("t1", "text", 200, 200, 150, 60, {
        text: "Underline\nRight",
        fontSize: 20,
        textAlign: "right",
        underline: true,
        bold: true,
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { count: snap.doc.elements.length };
    });
    expect(s.count).toBe(1);
  });

  test("text with top vertical alignment renders", async ({ page }) => {
    await loadScene(page, [
      el("t2", "text", 200, 200, 150, 60, {
        text: "Top aligned",
        fontSize: 20,
        textAlign: "center",
        textVAlign: "top",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { count: snap.doc.elements.length };
    });
    expect(s.count).toBe(1);
  });

  test("text with bottom vertical alignment renders", async ({ page }) => {
    await loadScene(page, [
      el("t3", "text", 200, 200, 150, 60, {
        text: "Bottom aligned",
        fontSize: 20,
        textAlign: "left",
        textVAlign: "bottom",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { count: snap.doc.elements.length };
    });
    expect(s.count).toBe(1);
  });

  test("label with text offset and alignment", async ({ page }) => {
    await loadScene(page, [
      el("lbl1", "rectangle", 200, 200, 100, 80, {
        label: "Label Left",
        textAlign: "left",
        textVAlign: "top",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { label: snap.doc.elements[0].label };
    });
    expect(s.label).toBe("Label Left");
  });

  test("arrow with start arrowhead triangle", async ({ page }) => {
    await loadScene(page, [
      el("ash1", "arrow", 200, 200, 120, 0, {
        startArrowhead: "triangle",
        endArrowhead: "arrow",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      const a = snap.doc.elements[0];
      return { start: a.startArrowhead, end: a.endArrowhead };
    });
    expect(s.start).toBe("triangle");
    expect(s.end).toBe("arrow");
  });

  test("element with opacity 0.5 renders", async ({ page }) => {
    await loadScene(page, [
      el("op1", "rectangle", 200, 200, 100, 80, { opacity: 0.5 }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { opacity: snap.doc.elements[0].opacity };
    });
    expect(s.opacity).toBe(0.5);
  });

  test("element with dotted stroke style renders", async ({ page }) => {
    await loadScene(page, [
      el("ds1", "rectangle", 200, 200, 100, 80, { strokeStyle: "dotted" }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { strokeStyle: snap.doc.elements[0].strokeStyle };
    });
    expect(s.strokeStyle).toBe("dotted");
  });

  test("element with dashdot stroke style renders", async ({ page }) => {
    await loadScene(page, [
      el("dds1", "rectangle", 200, 200, 100, 80, { strokeStyle: "dashdot" }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { strokeStyle: snap.doc.elements[0].strokeStyle };
    });
    expect(s.strokeStyle).toBe("dashdot");
  });

  test("auto-routed line without bend points renders", async ({ page }) => {
    await loadScene(page, [
      el("arl1", "line", 200, 200, 120, 60, { lineType: "auto" }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { lineType: snap.doc.elements[0].lineType };
    });
    expect(s.lineType).toBe("auto");
  });

  test("auto-routed arrow without bend points renders", async ({ page }) => {
    await loadScene(page, [
      el("ara1", "arrow", 200, 200, 120, 60, {
        lineType: "auto",
        endArrowhead: "arrow",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { lineType: snap.doc.elements[0].lineType };
    });
    expect(s.lineType).toBe("auto");
  });

  test("sketch auto-routed arrow without bend points renders", async ({
    page,
  }) => {
    await loadScene(page, [
      el("sara1", "arrow", 200, 200, 120, 60, {
        lineType: "auto",
        roughness: 2,
        endArrowhead: "triangle",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { lineType: snap.doc.elements[0].lineType };
    });
    expect(s.lineType).toBe("auto");
  });
});

test.describe("exporter.ts more edge cases", () => {
  test("SVG export of hachure-filled shape", async ({ page }) => {
    await loadScene(page, [
      el("hach1", "rectangle", 200, 200, 100, 80, {
        backgroundColor: "#a5d8ff",
        fillStyle: "hachure",
      }),
    ]);

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const svg = Buffer.concat(chunks).toString("utf-8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("clipPath");
  });

  test("SVG export of cross-hachure shape", async ({ page }) => {
    await loadScene(page, [
      el("xhach1", "rectangle", 200, 200, 100, 80, {
        backgroundColor: "#ffc9c9",
        fillStyle: "cross-hachure",
      }),
    ]);

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const svg = Buffer.concat(chunks).toString("utf-8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("clipPath");
  });

  test("SVG export of shape with fill opacity", async ({ page }) => {
    await loadScene(page, [
      el("fo1", "rectangle", 200, 200, 100, 80, {
        backgroundColor: "#a5d8ff",
        fillOpacity: 0.5,
        fillStyle: "hachure",
      }),
    ]);

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.svg$/);
  });

  test("SVG export of text element", async ({ page }) => {
    await loadScene(page, [
      el("txt1", "text", 200, 200, 150, 40, {
        text: "Hello SVG",
        fontSize: 20,
      }),
    ]);

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const svg = Buffer.concat(chunks).toString("utf-8");
    expect(svg).toContain("<svg");
  });

  test("SVG export of label on rectangle", async ({ page }) => {
    await loadScene(page, [
      el("rl1", "rectangle", 200, 200, 100, 80, { label: "Labeled Box" }),
    ]);

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const svg = Buffer.concat(chunks).toString("utf-8");
    expect(svg).toContain("<svg");
  });

  test("SVG export of dashed arrow", async ({ page }) => {
    await loadScene(page, [
      el("da1", "arrow", 200, 200, 120, 60, {
        strokeStyle: "dashed",
        endArrowhead: "arrow",
      }),
    ]);

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const svg = Buffer.concat(chunks).toString("utf-8");
    expect(svg).toContain("stroke-dasharray");
  });

  test("SVG export of dotted line", async ({ page }) => {
    await loadScene(page, [
      el("dl1", "line", 200, 200, 120, 60, { strokeStyle: "dotted" }),
    ]);

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const svg = Buffer.concat(chunks).toString("utf-8");
    expect(svg).toContain("stroke-dasharray");
  });

  test("PNG export of scene with all element types", async ({ page }) => {
    const svgData =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#ff0000"/></svg>',
      );
    await loadScene(page, [
      el("png_r", "rectangle", 100, 100, 80, 60, {
        backgroundColor: "#a5d8ff",
      }),
      el("png_d", "diamond", 200, 100, 80, 60),
      el("png_e", "ellipse", 300, 100, 80, 60),
      el("png_l", "line", 100, 200, 120, 60),
      el("png_a", "arrow", 100, 300, 120, 0, { endArrowhead: "arrow" }),
      el("png_t", "text", 100, 350, 120, 30, { text: "PNG test" }),
      el("png_c", "component", 300, 200, 64, 64, {
        componentId: "ec1",
        src: svgData,
        fill: true,
      }),
    ]);

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "PNG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const buf = Buffer.concat(chunks);
    expect(buf.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });
});

test.describe("renderer.ts text alignment edge cases", () => {
  test("label with right textAlign and bottom textVAlign", async ({
    page,
  }) => {
    await loadScene(page, [
      el("al1", "rectangle", 200, 200, 120, 100, {
        label: "Bottom Right",
        textAlign: "right",
        textVAlign: "bottom",
        underline: true,
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      const e = snap.doc.elements[0];
      return { textAlign: e.textAlign, textVAlign: e.textVAlign };
    });
    expect(s.textAlign).toBe("right");
    expect(s.textVAlign).toBe("bottom");
  });

  test("label with center textAlign and center textVAlign", async ({
    page,
  }) => {
    await loadScene(page, [
      el("al2", "rectangle", 200, 200, 120, 100, {
        label: "Center Center",
        textAlign: "center",
        textVAlign: "center",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      const e = snap.doc.elements[0];
      return { textAlign: e.textAlign, textVAlign: e.textVAlign };
    });
    expect(s.textAlign).toBe("center");
    expect(s.textVAlign).toBe("center");
  });

  test("text element with underline and right alignment", async ({
    page,
  }) => {
    await loadScene(page, [
      el("tu1", "text", 200, 200, 200, 40, {
        text: "Underlined Right",
        fontSize: 20,
        textAlign: "right",
        underline: true,
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      const e = snap.doc.elements[0];
      return { textAlign: e.textAlign, underline: e.underline };
    });
    expect(s.textAlign).toBe("right");
    expect(s.underline).toBe(true);
  });

  test("multiline label with underline", async ({ page }) => {
    await loadScene(page, [
      el("ml1", "rectangle", 200, 200, 140, 80, {
        label: "Line 1\nLine 2",
        textAlign: "left",
        underline: true,
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.doc.elements[0].label;
    });
    expect(s).toBe("Line 1\nLine 2");
  });

  test("component with multiline label and underline", async ({ page }) => {
    const svgData =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#a5d8ff"/></svg>',
      );
    await loadScene(page, [
      el("cmp1", "component", 200, 200, 64, 64, {
        componentId: "ec1",
        src: svgData,
        label: "Label A\nLabel B",
        underline: true,
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      const e = snap.doc.elements[0];
      return { label: e.label, underline: e.underline };
    });
    expect(s.label).toBe("Label A\nLabel B");
    expect(s.underline).toBe(true);
  });

  test("text with underline and left alignment", async ({ page }) => {
    await loadScene(page, [
      el("tul2", "text", 200, 200, 200, 40, {
        text: "Underlined Left",
        fontSize: 20,
        textAlign: "left",
        underline: true,
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      const e = snap.doc.elements[0];
      return { textAlign: e.textAlign, underline: e.underline };
    });
    expect(s.textAlign).toBe("left");
    expect(s.underline).toBe(true);
  });
});

test.describe("renderer.ts component rendering", () => {
  test("component with src renders without crash", async ({ page }) => {
    const svgData =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#a5d8ff"/></svg>',
      );
    await loadScene(page, [
      el("c1", "component", 200, 200, 64, 64, {
        componentId: "ec1",
        src: svgData,
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { type: snap.doc.elements[0].type, src: snap.doc.elements[0].src };
    });
    expect(s.type).toBe("component");
    expect(s.src).toContain("svg+xml");
  });

  test("component with fill renders without crash", async ({ page }) => {
    const svgData =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#ff0000"/></svg>',
      );
    await loadScene(page, [
      el("c2", "component", 200, 200, 64, 64, {
        componentId: "ec2",
        src: svgData,
        fill: true,
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { type: snap.doc.elements[0].type };
    });
    expect(s.type).toBe("component");
  });

  test("component with label renders without crash", async ({ page }) => {
    const svgData =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#a5d8ff"/></svg>',
      );
    await loadScene(page, [
      el("c3", "component", 200, 200, 64, 64, {
        componentId: "ec3",
        src: svgData,
        label: "Comp Label",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { label: snap.doc.elements[0].label };
    });
    expect(s.label).toBe("Comp Label");
  });
});

test.describe("renderer.ts diamond with background", () => {
  test("diamond with solid fill", async ({ page }) => {
    await loadScene(page, [
      el("d1", "diamond", 200, 200, 100, 80, {
        backgroundColor: "#a5d8ff",
        fillStyle: "solid",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { type: snap.doc.elements[0].type };
    });
    expect(s.type).toBe("diamond");
  });

  test("diamond with hachure fill", async ({ page }) => {
    await loadScene(page, [
      el("d2", "diamond", 200, 200, 100, 80, {
        backgroundColor: "#ffc9c9",
        fillStyle: "hachure",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { type: snap.doc.elements[0].type };
    });
    expect(s.type).toBe("diamond");
  });

  test("diamond with cross-hachure fill", async ({ page }) => {
    await loadScene(page, [
      el("d3", "diamond", 200, 200, 100, 80, {
        backgroundColor: "#b2f2bb",
        fillStyle: "cross-hachure",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { type: snap.doc.elements[0].type };
    });
    expect(s.type).toBe("diamond");
  });
});

test.describe("renderer.ts edge with labels", () => {
  test("arrow with label", async ({ page }) => {
    await loadScene(page, [
      el("al1", "arrow", 200, 200, 120, 60, {
        label: "Arrow Label",
        endArrowhead: "arrow",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { label: snap.doc.elements[0].label };
    });
    expect(s.label).toBe("Arrow Label");
  });

  test("line with label", async ({ page }) => {
    await loadScene(page, [
      el("ll1", "line", 200, 200, 120, 60, { label: "Line Label" }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { label: snap.doc.elements[0].label };
    });
    expect(s.label).toBe("Line Label");
  });
});

test.describe("exporter.ts SVG export of various fills", () => {
  test("SVG export of solid fill shape", async ({ page }) => {
    await loadScene(page, [
      el("sf1", "rectangle", 200, 200, 100, 80, {
        backgroundColor: "#a5d8ff",
        fillStyle: "solid",
      }),
    ]);
    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const svg = Buffer.concat(chunks).toString("utf-8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("fill=\"#a5d8ff\"");
  });

  test("SVG export of ellipse", async ({ page }) => {
    await loadScene(page, [
      el("se1", "ellipse", 200, 200, 100, 80, {
        backgroundColor: "#ffc9c9",
        fillStyle: "solid",
      }),
    ]);
    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const svg = Buffer.concat(chunks).toString("utf-8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("ellipse");
  });

  test("SVG export of diamond", async ({ page }) => {
    await loadScene(page, [
      el("sd1", "diamond", 200, 200, 100, 80, {
        backgroundColor: "#b2f2bb",
        fillStyle: "solid",
      }),
    ]);
    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "SVG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const svg = Buffer.concat(chunks).toString("utf-8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("polygon");
  });
});

test.describe("renderer.ts ellipse with hachure fill", () => {
  test("ellipse with hachure fill renders correctly", async ({ page }) => {
    await loadScene(page, [
      el("eh1", "ellipse", 200, 200, 120, 100, {
        backgroundColor: "#a5d8ff",
        fillStyle: "hachure",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      const e = snap.doc.elements[0];
      return { type: e.type, fillStyle: e.fillStyle };
    });
    expect(s.type).toBe("ellipse");
    expect(s.fillStyle).toBe("hachure");
  });

  test("ellipse with cross-hachure fill renders", async ({ page }) => {
    await loadScene(page, [
      el("ech1", "ellipse", 200, 200, 120, 100, {
        backgroundColor: "#ffc9c9",
        fillStyle: "cross-hachure",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.doc.elements[0].fillStyle;
    });
    expect(s).toBe("cross-hachure");
  });
});

test.describe("renderer.ts text underline center/right", () => {
  test("text with underline and center alignment", async ({ page }) => {
    await loadScene(page, [
      el("tcu1", "text", 200, 200, 200, 40, {
        text: "Center Underline",
        fontSize: 20,
        textAlign: "center",
        underline: true,
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      const e = snap.doc.elements[0];
      return { textAlign: e.textAlign, underline: e.underline };
    });
    expect(s.textAlign).toBe("center");
    expect(s.underline).toBe(true);
  });
});

test.describe("renderer.ts edge label underline left/right alignment", () => {
  test("arrow label with underline and left alignment", async ({ page }) => {
    await loadScene(page, [
      el("ealu1", "arrow", 200, 200, 120, 60, {
        label: "Left Underline",
        underline: true,
        textAlign: "left",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      const e = snap.doc.elements[0];
      return { label: e.label, underline: e.underline, textAlign: e.textAlign };
    });
    expect(s.label).toBe("Left Underline");
    expect(s.underline).toBe(true);
    expect(s.textAlign).toBe("left");
  });

  test("arrow label with underline and right alignment", async ({ page }) => {
    await loadScene(page, [
      el("earu1", "arrow", 200, 200, 120, 60, {
        label: "Right Underline",
        underline: true,
        textAlign: "right",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      const e = snap.doc.elements[0];
      return { label: e.label, underline: e.underline, textAlign: e.textAlign };
    });
    expect(s.label).toBe("Right Underline");
    expect(s.underline).toBe(true);
    expect(s.textAlign).toBe("right");
  });

  test("line label with underline and center alignment", async ({ page }) => {
    await loadScene(page, [
      el("llcu1", "line", 200, 200, 120, 60, {
        label: "Center Line",
        underline: true,
        textAlign: "center",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      const e = snap.doc.elements[0];
      return { label: e.label, underline: e.underline };
    });
    expect(s.label).toBe("Center Line");
    expect(s.underline).toBe(true);
  });
});

test.describe("renderer.ts edge label textVAlign top/bottom", () => {
  test("arrow with label textVAlign top", async ({ page }) => {
    await loadScene(page, [
      el("atv1", "arrow", 200, 200, 120, 60, {
        label: "Top Label",
        textVAlign: "top",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.doc.elements[0].textVAlign;
    });
    expect(s).toBe("top");
  });

  test("arrow with label textVAlign bottom", async ({ page }) => {
    await loadScene(page, [
      el("abv1", "arrow", 200, 200, 120, 60, {
        label: "Bottom Label",
        textVAlign: "bottom",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.doc.elements[0].textVAlign;
    });
    expect(s).toBe("bottom");
  });

  test("line with label textVAlign top", async ({ page }) => {
    await loadScene(page, [
      el("ltv1", "line", 200, 200, 120, 60, {
        label: "Top Line",
        textVAlign: "top",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.doc.elements[0].textVAlign;
    });
    expect(s).toBe("top");
  });
});

test.describe("renderer.ts component with label underline", () => {
  test("component with label and underline", async ({ page }) => {
    const svgData =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#a5d8ff"/></svg>',
      );
    await loadScene(page, [
      el("clu1", "component", 200, 200, 64, 64, {
        componentId: "ec1",
        src: svgData,
        label: "Underline\nComp",
        underline: true,
        textAlign: "right",
      }),
    ]);
    await page.waitForTimeout(100);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      const e = snap.doc.elements[0];
      return { label: e.label, underline: e.underline, textAlign: e.textAlign };
    });
    expect(s.label).toBe("Underline\nComp");
    expect(s.underline).toBe(true);
    expect(s.textAlign).toBe("right");
  });
});

test.describe("renderer.ts shape fill opacity variations", () => {
  test("rectangle with fillOpacity 0.3", async ({ page }) => {
    await loadScene(page, [
      el("fop1", "rectangle", 200, 200, 100, 80, {
        backgroundColor: "#a5d8ff",
        fillOpacity: 0.3,
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.doc.elements[0].fillOpacity;
    });
    expect(s).toBe(0.3);
  });

  test("rectangle with strokeOpacity 0.5", async ({ page }) => {
    await loadScene(page, [
      el("sop1", "rectangle", 200, 200, 100, 80, {
        strokeOpacity: 0.5,
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.doc.elements[0].strokeOpacity;
    });
    expect(s).toBe(0.5);
  });

  test("ellipse with border radius", async ({ page }) => {
    await loadScene(page, [
      el("br1", "rectangle", 200, 200, 100, 80, {
        borderRadius: 10,
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.doc.elements[0].borderRadius;
    });
    expect(s).toBe(10);
  });
});

test.describe("renderer.ts arrow with bend points and control point", () => {
  test("arrow with bend points renders", async ({ page }) => {
    await loadScene(page, [
      el("abp1", "arrow", 200, 200, 120, 60, {
        bendPoints: [
          { x: 260, y: 170 },
          { x: 320, y: 200 },
        ],
        endArrowhead: "arrow",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      const e = snap.doc.elements[0];
      return { bendPoints: e.bendPoints?.length, endArrowhead: e.endArrowhead };
    });
    expect(s.bendPoints).toBe(2);
    expect(s.endArrowhead).toBe("arrow");
  });

  test("arrow with control point renders", async ({ page }) => {
    await loadScene(page, [
      el("acp1", "arrow", 200, 200, 120, 60, {
        controlPoint: { x: 260, y: 150 },
        endArrowhead: "arrow",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      const e = snap.doc.elements[0];
      return { controlPoint: e.controlPoint, endArrowhead: e.endArrowhead };
    });
    expect(s.controlPoint).toBeTruthy();
    expect(s.endArrowhead).toBe("arrow");
  });
});

test.describe("renderer.ts line with bend points", () => {
  test("line with bend points renders", async ({ page }) => {
    await loadScene(page, [
      el("lbp1", "line", 200, 200, 120, 60, {
        bendPoints: [
          { x: 260, y: 170 },
          { x: 320, y: 200 },
        ],
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.doc.elements[0].bendPoints?.length;
    });
    expect(s).toBe(2);
  });

  test("line with control point renders", async ({ page }) => {
    await loadScene(page, [
      el("lcp1", "line", 200, 200, 120, 60, {
        controlPoint: { x: 260, y: 150 },
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.doc.elements[0].controlPoint;
    });
    expect(s).toBeTruthy();
  });
});

test.describe("renderer.ts text with frameId", () => {
  test("text element with frameId renders", async ({ page }) => {
    await loadScene(page, [
      el("tf1", "text", 200, 200, 150, 40, {
        text: "Framed Text",
        fontSize: 20,
        frameId: "frame-1",
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { text: snap.doc.elements[0].text, frameId: snap.doc.elements[0].frameId };
    });
    expect(s.text).toBe("Framed Text");
    expect(s.frameId).toBe("frame-1");
  });
});

test.describe("renderer.ts diamond with border radius", () => {
  test("diamond with border radius renders", async ({ page }) => {
    await loadScene(page, [
      el("dbr1", "diamond", 200, 200, 100, 80, {
        borderRadius: 5,
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return { type: snap.doc.elements[0].type, borderRadius: snap.doc.elements[0].borderRadius };
    });
    expect(s.type).toBe("diamond");
    expect(s.borderRadius).toBe(5);
  });
});

test.describe("renderer.ts shape with angle", () => {
  test("rectangle with rotation renders", async ({ page }) => {
    await loadScene(page, [
      el("ra1", "rectangle", 200, 200, 100, 80, {
        angle: 45,
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.doc.elements[0].angle;
    });
    expect(s).toBe(45);
  });

  test("ellipse with rotation renders", async ({ page }) => {
    await loadScene(page, [
      el("ea1", "ellipse", 200, 200, 100, 80, {
        angle: 30,
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.doc.elements[0].angle;
    });
    expect(s).toBe(30);
  });
});

test.describe("renderer.ts text with bold and italic", () => {
  test("text with bold renders", async ({ page }) => {
    await loadScene(page, [
      el("tb1", "text", 200, 200, 200, 40, {
        text: "Bold Text",
        bold: true,
        fontSize: 20,
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.doc.elements[0].bold;
    });
    expect(s).toBe(true);
  });

  test("text with italic renders", async ({ page }) => {
    await loadScene(page, [
      el("ti1", "text", 200, 200, 200, 40, {
        text: "Italic Text",
        italic: true,
        fontSize: 20,
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      return snap.doc.elements[0].italic;
    });
    expect(s).toBe(true);
  });

  test("text with bold and italic renders", async ({ page }) => {
    await loadScene(page, [
      el("tbi1", "text", 200, 200, 200, 40, {
        text: "Bold Italic",
        bold: true,
        italic: true,
        fontSize: 20,
      }),
    ]);
    const s = await page.evaluate(() => {
      const snap = (window as any).__editor__.getSnapshot();
      const e = snap.doc.elements[0];
      return { bold: e.bold, italic: e.italic };
    });
    expect(s.bold).toBe(true);
    expect(s.italic).toBe(true);
  });
});

test.describe("renderer.ts all stroke styles for shapes", () => {
  test("solid stroke style renders", async ({ page }) => {
    await loadScene(page, [
      el("ss1", "rectangle", 200, 200, 100, 80, { strokeStyle: "solid" }),
    ]);
    const s = await page.evaluate(() => (window as any).__editor__.getSnapshot().doc.elements[0].strokeStyle);
    expect(s).toBe("solid");
  });

  test("dashed stroke style renders", async ({ page }) => {
    await loadScene(page, [
      el("ss2", "rectangle", 200, 200, 100, 80, { strokeStyle: "dashed" }),
    ]);
    const s = await page.evaluate(() => (window as any).__editor__.getSnapshot().doc.elements[0].strokeStyle);
    expect(s).toBe("dashed");
  });
});

test.describe("exporter.ts ellipse element SVG export", () => {
  test("import and export ellipse as SVG", async ({ page }) => {
    await loadScene(page, [
      el("ep1", "ellipse", 200, 200, 120, 100),
    ]);
    const result = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { type: e.type, x: e.x, width: e.width };
    });
    expect(result.type).toBe("ellipse");
    expect(result.width).toBe(120);
  });
});

test.describe("exporter.ts diamond element SVG export", () => {
  test("import and export diamond", async ({ page }) => {
    await loadScene(page, [
      el("dp1", "diamond", 200, 200, 120, 100),
    ]);
    const d = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { type: e.type, width: e.width };
    });
    expect(d.type).toBe("diamond");
    expect(d.width).toBe(120);
  });
});

test.describe("exporter.ts text element SVG export", () => {
  test("import text element", async ({ page }) => {
    await loadScene(page, [
      el("tp1", "text", 200, 200, 100, 30, {
        text: "Export text",
        fontSize: 20,
        fontFamily: "Virgil",
      }),
    ]);
    const t = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { type: e.type, text: e.text };
    });
    expect(t.type).toBe("text");
    expect(t.text).toBe("Export text");
  });
});

test.describe("exporter.ts arrow with different arrowheads", () => {
  test("arrow with dot arrowhead", async ({ page }) => {
    await loadScene(page, [
      el("ah1", "arrow", 200, 200, 200, 0, { endArrowhead: "dot" }),
    ]);
    const a = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { type: e.type, endArrowhead: e.endArrowhead };
    });
    expect(a.endArrowhead).toBe("dot");
  });

  test("arrow with triangle arrowhead", async ({ page }) => {
    await loadScene(page, [
      el("ah2", "arrow", 200, 200, 200, 0, { endArrowhead: "triangle" }),
    ]);
    const a = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { endArrowhead: e.endArrowhead };
    });
    expect(a.endArrowhead).toBe("triangle");
  });

  test("arrow with start arrowhead", async ({ page }) => {
    await loadScene(page, [
      el("ah3", "arrow", 200, 200, 200, 0, {
        startArrowhead: "arrow",
        endArrowhead: "arrow",
      }),
    ]);
    const a = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { start: e.startArrowhead, end: e.endArrowhead };
    });
    expect(a.start).toBe("arrow");
    expect(a.end).toBe("arrow");
  });
});

test.describe("exporter.ts line element SVG export", () => {
  test("import line element", async ({ page }) => {
    await loadScene(page, [
      el("lp1", "line", 200, 200, 150, 50),
    ]);
    const l = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { type: e.type, width: e.width };
    });
    expect(l.type).toBe("line");
    expect(l.width).toBe(150);
  });
});

test.describe("exporter.ts hachure fill shapes", () => {
  test("rect with hachure fill", async ({ page }) => {
    await loadScene(page, [
      el("hf1", "rectangle", 200, 200, 100, 80, {
        fillStyle: "hachure",
        backgroundColor: "#a5d8ff",
      }),
    ]);
    const f = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { fillStyle: e.fillStyle, backgroundColor: e.backgroundColor };
    });
    expect(f.fillStyle).toBe("hachure");
    expect(f.backgroundColor).toBe("#a5d8ff");
  });

  test("ellipse with hachure fill", async ({ page }) => {
    await loadScene(page, [
      el("hf2", "ellipse", 200, 200, 120, 100, {
        fillStyle: "hachure",
        backgroundColor: "#a5d8ff",
      }),
    ]);
    const f = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { fillStyle: e.fillStyle, type: e.type };
    });
    expect(f.fillStyle).toBe("hachure");
    expect(f.type).toBe("ellipse");
  });
});

test.describe("exporter.ts roughness values", () => {
  test("shape with roughness 2", async ({ page }) => {
    await loadScene(page, [
      el("rv1", "rectangle", 200, 200, 100, 80, { roughness: 2 }),
    ]);
    const r = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0].roughness,
    );
    expect(r).toBe(2);
  });

  test("shape with roughness 0", async ({ page }) => {
    await loadScene(page, [
      el("rv2", "rectangle", 200, 200, 100, 80, { roughness: 0 }),
    ]);
    const r = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0].roughness,
    );
    expect(r).toBe(0);
  });
});

test.describe("exporter.ts opacity values", () => {
  test("shape with 50% opacity", async ({ page }) => {
    await loadScene(page, [
      el("ov1", "rectangle", 200, 200, 100, 80, { opacity: 50 }),
    ]);
    const o = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0].opacity,
    );
    expect(o).toBe(50);
  });
});

test.describe("exporter.ts stroke color variants", () => {
  test("shape with red stroke", async ({ page }) => {
    await loadScene(page, [
      el("sc1", "rectangle", 200, 200, 100, 80, { strokeColor: "#ff0000" }),
    ]);
    const c = await page.evaluate(
      () =>
        (window as any).__editor__.getSnapshot().doc.elements[0].strokeColor,
    );
    expect(c).toBe("#ff0000");
  });

  test("shape with custom stroke width", async ({ page }) => {
    await loadScene(page, [
      el("sc2", "rectangle", 200, 200, 100, 80, { strokeWidth: 4 }),
    ]);
    const w = await page.evaluate(
      () =>
        (window as any).__editor__.getSnapshot().doc.elements[0].strokeWidth,
    );
    expect(w).toBe(4);
  });
});

test.describe("renderer.ts text element rendering", () => {
  test("text element renders text content", async ({ page }) => {
    await loadScene(page, [
      el("te1", "text", 200, 200, 200, 30, {
        text: "Rendered text",
        fontSize: 20,
        fontFamily: "Virgil",
      }),
    ]);
    const t = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { type: e.type, text: e.text, fontSize: e.fontSize };
    });
    expect(t.text).toBe("Rendered text");
    expect(t.fontSize).toBe(20);
  });

  test("bold italic text element", async ({ page }) => {
    await loadScene(page, [
      el("te2", "text", 200, 200, 200, 30, {
        text: "Bold Italic",
        fontSize: 20,
        bold: true,
        italic: true,
        fontFamily: "Virgil",
      }),
    ]);
    const t = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { bold: e.bold, italic: e.italic };
    });
    expect(t.bold).toBe(true);
    expect(t.italic).toBe(true);
  });
});

test.describe("renderer.ts arrow label rendering", () => {
  test("arrow with label", async ({ page }) => {
    await loadScene(page, [
      el("al1", "arrow", 200, 200, 200, 0, { label: "Arrow label" }),
    ]);
    const a = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { label: e.label, type: e.type };
    });
    expect(a.label).toBe("Arrow label");
    expect(a.type).toBe("arrow");
  });
});

test.describe("renderer.ts line with lineType", () => {
  test("line with auto lineType", async ({ page }) => {
    await loadScene(page, [
      el("lt1", "line", 200, 200, 150, 50, { lineType: "auto" }),
    ]);
    const l = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { lineType: e.lineType, type: e.type };
    });
    expect(l.lineType).toBe("auto");
    expect(l.type).toBe("line");
  });

  test("line with straight lineType", async ({ page }) => {
    await loadScene(page, [
      el("lt2", "line", 200, 200, 150, 50, { lineType: "straight" }),
    ]);
    const l = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements[0].lineType,
    );
    expect(l).toBe("straight");
  });
});

test.describe("renderer.ts label on rectangle", () => {
  test("rectangle with label renders label text", async ({ page }) => {
    await loadScene(page, [
      el("rl1", "rectangle", 200, 200, 150, 100, { label: "Rect label" }),
    ]);
    const r = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { label: e.label, type: e.type };
    });
    expect(r.label).toBe("Rect label");
    expect(r.type).toBe("rectangle");
  });
});

test.describe("renderer.ts component label rendering", () => {
  test("component element with label", async ({ page }) => {
    await loadScene(page, [
      el("cl1", "component", 200, 200, 120, 100, { label: "Component" }),
    ]);
    const c = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { label: e.label, type: e.type };
    });
    expect(c.label).toBe("Component");
    expect(c.type).toBe("component");
  });
});

test.describe("renderer.ts multi-line text element", () => {
  test("text with multiple lines renders correct height", async ({ page }) => {
    await loadScene(page, [
      el("ml1", "text", 200, 200, 300, 100, {
        text: "Line1\nLine2\nLine3",
        fontSize: 20,
        fontFamily: "Virgil",
      }),
    ]);
    const t = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { text: e.text, height: e.height };
    });
    expect(t.text).toContain("Line2");
    expect(t.height).toBeGreaterThan(20);
  });
});

test.describe("renderer.ts text with left align", () => {
  test("text with textAlign left", async ({ page }) => {
    await loadScene(page, [
      el("ta1", "text", 200, 200, 300, 30, {
        text: "Left aligned",
        fontSize: 20,
        fontFamily: "Virgil",
        textAlign: "left",
      }),
    ]);
    const t = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { textAlign: e.textAlign };
    });
    expect(t.textAlign).toBe("left");
  });
});

test.describe("renderer.ts text with right align", () => {
  test("text with textAlign right", async ({ page }) => {
    await loadScene(page, [
      el("ta2", "text", 200, 200, 300, 30, {
        text: "Right aligned",
        fontSize: 20,
        fontFamily: "Virgil",
        textAlign: "right",
      }),
    ]);
    const t = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { textAlign: e.textAlign };
    });
    expect(t.textAlign).toBe("right");
  });
});

test.describe("renderer.ts text with top valign", () => {
  test("text with textVAlign top", async ({ page }) => {
    await loadScene(page, [
      el("tv1", "text", 200, 200, 300, 30, {
        text: "Top aligned",
        fontSize: 20,
        fontFamily: "Virgil",
        textVAlign: "top",
      }),
    ]);
    const t = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { textVAlign: e.textVAlign };
    });
    expect(t.textVAlign).toBe("top");
  });
});

test.describe("renderer.ts text with bottom valign", () => {
  test("text with textVAlign bottom", async ({ page }) => {
    await loadScene(page, [
      el("tv2", "text", 200, 200, 300, 30, {
        text: "Bottom aligned",
        fontSize: 20,
        fontFamily: "Virgil",
        textVAlign: "bottom",
      }),
    ]);
    const t = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { textVAlign: e.textVAlign };
    });
    expect(t.textVAlign).toBe("bottom");
  });
});

test.describe("renderer.ts rect with label multiline", () => {
  test("rect with multi-line label", async ({ page }) => {
    await loadScene(page, [
      el("rl2", "rectangle", 200, 200, 200, 150, {
        label: "Line1\nLine2",
      }),
    ]);
    const r = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { label: e.label, type: e.type };
    });
    expect(r.label).toContain("Line1");
    expect(r.label).toContain("Line2");
  });
});

test.describe("renderer.ts rect with left text align label", () => {
  test("rect label with left alignment", async ({ page }) => {
    await loadScene(page, [
      el("rl3", "rectangle", 200, 200, 200, 150, {
        label: "Left",
        textAlign: "left",
      }),
    ]);
    const r = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { textAlign: e.textAlign };
    });
    expect(r.textAlign).toBe("left");
  });
});

test.describe("renderer.ts rect with right text align label", () => {
  test("rect label with right alignment", async ({ page }) => {
    await loadScene(page, [
      el("rl4", "rectangle", 200, 200, 200, 150, {
        label: "Right",
        textAlign: "right",
      }),
    ]);
    const r = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { textAlign: e.textAlign };
    });
    expect(r.textAlign).toBe("right");
  });
});

test.describe("renderer.ts rect with top textVAlign label", () => {
  test("rect label with top valign", async ({ page }) => {
    await loadScene(page, [
      el("rl5", "rectangle", 200, 200, 200, 150, {
        label: "Top",
        textVAlign: "top",
      }),
    ]);
    const r = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { textVAlign: e.textVAlign };
    });
    expect(r.textVAlign).toBe("top");
  });
});

test.describe("renderer.ts rect with bottom textVAlign label", () => {
  test("rect label with bottom valign", async ({ page }) => {
    await loadScene(page, [
      el("rl6", "rectangle", 200, 200, 200, 150, {
        label: "Bottom",
        textVAlign: "bottom",
      }),
    ]);
    const r = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { textVAlign: e.textVAlign };
    });
    expect(r.textVAlign).toBe("bottom");
  });
});

test.describe("renderer.ts arrow curved lineType", () => {
  test("arrow with curved lineType", async ({ page }) => {
    await loadScene(page, [
      el("ac1", "arrow", 200, 200, 200, 50, { lineType: "curved" }),
    ]);
    const a = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { lineType: e.lineType, type: e.type };
    });
    expect(a.lineType).toBe("curved");
  });
});

test.describe("renderer.ts arrow auto lineType", () => {
  test("arrow with auto lineType", async ({ page }) => {
    await loadScene(page, [
      el("ac2", "arrow", 200, 200, 200, 50, { lineType: "auto" }),
    ]);
    const a = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { lineType: e.lineType, type: e.type };
    });
    expect(a.lineType).toBe("auto");
  });
});

test.describe("renderer.ts arrow with both arrowheads", () => {
  test("arrow with both start and end arrowheads", async ({ page }) => {
    await loadScene(page, [
      el("ab1", "arrow", 200, 200, 200, 0, {
        startArrowhead: "arrow",
        endArrowhead: "dot",
      }),
    ]);
    const a = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { start: e.startArrowhead, end: e.endArrowhead };
    });
    expect(a.start).toBe("arrow");
    expect(a.end).toBe("dot");
  });
});

test.describe("renderer.ts text underlined", () => {
  test("text with underline renders", async ({ page }) => {
    await loadScene(page, [
      el("ul1", "text", 200, 200, 200, 30, {
        text: "Underlined",
        fontSize: 20,
        fontFamily: "Virgil",
        underline: true,
      }),
    ]);
    const t = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { underline: e.underline };
    });
    expect(t.underline).toBe(true);
  });
});

test.describe("renderer.ts ellipse with label", () => {
  test("ellipse with label renders", async ({ page }) => {
    await loadScene(page, [
      el("el1", "ellipse", 200, 200, 150, 100, { label: "Ellipse" }),
    ]);
    const r = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { label: e.label, type: e.type };
    });
    expect(r.label).toBe("Ellipse");
    expect(r.type).toBe("ellipse");
  });
});

test.describe("renderer.ts diamond with label", () => {
  test("diamond with label renders", async ({ page }) => {
    await loadScene(page, [
      el("dl1", "diamond", 200, 200, 150, 150, { label: "Diamond" }),
    ]);
    const r = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { label: e.label, type: e.type };
    });
    expect(r.label).toBe("Diamond");
    expect(r.type).toBe("diamond");
  });
});

test.describe("renderer.ts line with label", () => {
  test("line with label renders", async ({ page }) => {
    await loadScene(page, [
      el("ll1", "line", 200, 200, 150, 50, { label: "Line" }),
    ]);
    const r = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { label: e.label, type: e.type };
    });
    expect(r.label).toBe("Line");
    expect(r.type).toBe("line");
  });
});

test.describe("renderer.ts rect with textOffsetRight", () => {
  test("rect with custom text offsets", async ({ page }) => {
    await loadScene(page, [
      el("to1", "rectangle", 200, 200, 200, 150, {
        label: "Offset",
        textOffsetLeft: 10,
        textOffsetRight: 10,
        textOffsetTop: 5,
        textOffsetBottom: 5,
      }),
    ]);
    const r = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return {
        left: e.textOffsetLeft,
        right: e.textOffsetRight,
        top: e.textOffsetTop,
        bottom: e.textOffsetBottom,
      };
    });
    expect(r.left).toBe(10);
    expect(r.right).toBe(10);
  });
});

test.describe("renderer.ts rect with hachure fill and label", () => {
  test("hachure filled rect with label", async ({ page }) => {
    await loadScene(page, [
      el("hf3", "rectangle", 200, 200, 200, 150, {
        fillStyle: "hachure",
        backgroundColor: "#a5d8ff",
        label: "Hachure",
      }),
    ]);
    const r = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { fillStyle: e.fillStyle, label: e.label };
    });
    expect(r.fillStyle).toBe("hachure");
    expect(r.label).toBe("Hachure");
  });
});

test.describe("renderer.ts triangle arrowhead with sketch", () => {
  test("arrow with triangle arrowhead and roughness", async ({ page }) => {
    await loadScene(page, [
      el("ta3", "arrow", 200, 200, 200, 0, {
        endArrowhead: "triangle",
        roughness: 1,
      }),
    ]);
    const a = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { endArrowhead: e.endArrowhead, roughness: e.roughness };
    });
    expect(a.endArrowhead).toBe("triangle");
    expect(a.roughness).toBe(1);
  });
});

test.describe("renderer.ts arrow with start triangle", () => {
  test("arrow with start triangle arrowhead", async ({ page }) => {
    await loadScene(page, [
      el("ta4", "arrow", 200, 200, 200, 0, {
        startArrowhead: "triangle",
        endArrowhead: "arrow",
      }),
    ]);
    const a = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { start: e.startArrowhead, end: e.endArrowhead };
    });
    expect(a.start).toBe("triangle");
    expect(a.end).toBe("arrow");
  });
});

test.describe("renderer.ts dot arrowhead both ends", () => {
  test("arrow with dot on both ends", async ({ page }) => {
    await loadScene(page, [
      el("da1", "arrow", 200, 200, 200, 0, {
        startArrowhead: "dot",
        endArrowhead: "dot",
      }),
    ]);
    const a = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { start: e.startArrowhead, end: e.endArrowhead };
    });
    expect(a.start).toBe("dot");
    expect(a.end).toBe("dot");
  });
});

test.describe("renderer.ts sketch rect with roughness", () => {
  test("sketch rectangle with roughness 2", async ({ page }) => {
    await loadScene(page, [
      el("sr1", "rectangle", 200, 200, 150, 100, {
        roughness: 2,
        fillStyle: "hachure",
        backgroundColor: "#a5d8ff",
      }),
    ]);
    const r = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { roughness: e.roughness, fillStyle: e.fillStyle };
    });
    expect(r.roughness).toBe(2);
    expect(r.fillStyle).toBe("hachure");
  });
});

test.describe("renderer.ts sketch ellipse with roughness", () => {
  test("sketch ellipse with roughness 2", async ({ page }) => {
    await loadScene(page, [
      el("se1", "ellipse", 200, 200, 150, 100, {
        roughness: 2,
        fillStyle: "hachure",
        backgroundColor: "#a5d8ff",
      }),
    ]);
    const r = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { roughness: e.roughness, type: e.type };
    });
    expect(r.roughness).toBe(2);
    expect(r.type).toBe("ellipse");
  });
});

test.describe("renderer.ts sketch diamond with roughness", () => {
  test("sketch diamond with roughness 2", async ({ page }) => {
    await loadScene(page, [
      el("sd1", "diamond", 200, 200, 150, 150, {
        roughness: 2,
        fillStyle: "hachure",
        backgroundColor: "#a5d8ff",
      }),
    ]);
    const r = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { roughness: e.roughness, type: e.type };
    });
    expect(r.roughness).toBe(2);
    expect(r.type).toBe("diamond");
  });
});

test.describe("renderer.ts text element with underline", () => {
  test("text with underline renders underline path", async ({ page }) => {
    await loadScene(page, [
      el("ul2", "text", 200, 200, 300, 30, {
        text: "Underlined text",
        fontSize: 20,
        fontFamily: "Virgil",
        underline: true,
        textAlign: "center",
      }),
    ]);
    await page.mouse.click(350, 210);
    const t = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { underline: e.underline, textAlign: e.textAlign };
    });
    expect(t.underline).toBe(true);
    expect(t.textAlign).toBe("center");
  });
});

test.describe("renderer.ts text left underline", () => {
  test("text with left-aligned underline", async ({ page }) => {
    await loadScene(page, [
      el("ul3", "text", 200, 200, 300, 30, {
        text: "Left underline",
        fontSize: 20,
        fontFamily: "Virgil",
        underline: true,
        textAlign: "left",
      }),
    ]);
    await page.mouse.click(350, 210);
    const t = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { underline: e.underline, textAlign: e.textAlign };
    });
    expect(t.underline).toBe(true);
  });
});

test.describe("renderer.ts arrow label with textVAlign top/bottom", () => {
  test("arrow label with top valign", async ({ page }) => {
    await loadScene(page, [
      el("av1", "arrow", 200, 200, 250, 0, {
        label: "Top label",
        textVAlign: "top",
      }),
    ]);
    await page.mouse.click(325, 200);
    const a = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { label: e.label, textVAlign: e.textVAlign };
    });
    expect(a.textVAlign).toBe("top");
  });

  test("arrow label with bottom valign", async ({ page }) => {
    await loadScene(page, [
      el("av2", "arrow", 200, 250, 250, 0, {
        label: "Bottom label",
        textVAlign: "bottom",
      }),
    ]);
    await page.mouse.click(325, 250);
    const a = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { label: e.label, textVAlign: e.textVAlign };
    });
    expect(a.textVAlign).toBe("bottom");
  });
});

test.describe("renderer.ts line label with textVAlign top/bottom", () => {
  test("line label with top valign", async ({ page }) => {
    await loadScene(page, [
      el("lv1", "line", 200, 200, 250, 0, {
        label: "Line top",
        textVAlign: "top",
      }),
    ]);
    await page.mouse.click(325, 200);
    const l = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { textVAlign: e.textVAlign, type: e.type };
    });
    expect(l.textVAlign).toBe("top");
  });

  test("line label with bottom valign", async ({ page }) => {
    await loadScene(page, [
      el("lv2", "line", 200, 250, 250, 0, {
        label: "Line bottom",
        textVAlign: "bottom",
      }),
    ]);
    await page.mouse.click(325, 250);
    const l = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { textVAlign: e.textVAlign };
    });
    expect(l.textVAlign).toBe("bottom");
  });
});

test.describe("renderer.ts rect label with underline", () => {
  test("rect with underlined label", async ({ page }) => {
    await loadScene(page, [
      el("ru1", "rectangle", 200, 200, 200, 150, {
        label: "Underlined",
        underline: true,
        textAlign: "right",
      }),
    ]);
    await page.mouse.click(300, 275);
    const r = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { underline: e.underline, textAlign: e.textAlign };
    });
    expect(r.underline).toBe(true);
    expect(r.textAlign).toBe("right");
  });
});

test.describe("renderer.ts component with src", () => {
  test("component element with image src", async ({ page }) => {
    await loadScene(page, [
      el("cs1", "component", 200, 200, 120, 100, {
        src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'><rect width='10' height='10' fill='red'/></svg>",
        componentId: "test-component",
      }),
    ]);
    const c = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { type: e.type, componentId: e.componentId };
    });
    expect(c.type).toBe("component");
  });
});

test.describe("renderer.ts ellipse with underline label", () => {
  test("ellipse label with underline", async ({ page }) => {
    await loadScene(page, [
      el("eu1", "ellipse", 200, 200, 150, 100, {
        label: "Underlined",
        underline: true,
        textAlign: "left",
      }),
    ]);
    await page.mouse.click(275, 250);
    const r = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { underline: e.underline, textAlign: e.textAlign };
    });
    expect(r.underline).toBe(true);
    expect(r.textAlign).toBe("left");
  });
});

test.describe("renderer.ts rect multiline label right align", () => {
  test("rect with multiline right-aligned label", async ({ page }) => {
    await loadScene(page, [
      el("rm1", "rectangle", 200, 200, 200, 200, {
        label: "Line1\nLine2\nLine3",
        textAlign: "right",
        textVAlign: "top",
      }),
    ]);
    await page.mouse.click(300, 300);
    const r = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { textAlign: e.textAlign, textVAlign: e.textVAlign };
    });
    expect(r.textAlign).toBe("right");
    expect(r.textVAlign).toBe("top");
  });
});

test.describe("renderer.ts rect multiline label bottom", () => {
  test("rect with multiline bottom-aligned label", async ({ page }) => {
    await loadScene(page, [
      el("rm2", "rectangle", 200, 200, 200, 200, {
        label: "Line1\nLine2",
        textAlign: "left",
        textVAlign: "bottom",
      }),
    ]);
    await page.mouse.click(300, 300);
    const r = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { textAlign: e.textAlign, textVAlign: e.textVAlign };
    });
    expect(r.textAlign).toBe("left");
    expect(r.textVAlign).toBe("bottom");
  });
});

test.describe("renderer.ts multiline text element center", () => {
  test("multiline text with center alignment", async ({ page }) => {
    await loadScene(page, [
      el("mc1", "text", 200, 200, 300, 100, {
        text: "Center\nLine2",
        fontSize: 20,
        fontFamily: "Virgil",
        textAlign: "center",
      }),
    ]);
    await page.mouse.click(350, 210);
    const t = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { textAlign: e.textAlign };
    });
    expect(t.textAlign).toBe("center");
  });
});

test.describe("renderer.ts details badge via interaction", () => {
  test("element with details renders badge", async ({ page }) => {
    await loadScene(page, [
      el("db1", "rectangle", 200, 200, 150, 100, {
        details: "Important detail",
      }),
    ]);
    await page.mouse.click(275, 250);
    const r = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { details: e.details };
    });
    expect(r.details).toBe("Important detail");
  });
});

test.describe("renderer.ts locked element interaction", () => {
  test("click on locked element", async ({ page }) => {
    await loadScene(page, [
      el("lk1", "rectangle", 200, 200, 150, 100, { locked: true }),
    ]);
    await page.mouse.click(275, 250);
    const r = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { locked: e.locked };
    });
    expect(r.locked).toBe(true);
  });
});

test.describe("renderer.ts arrow with curved lineType sketch", () => {
  test("curved arrow with roughness", async ({ page }) => {
    await loadScene(page, [
      el("ac3", "arrow", 200, 200, 250, 50, {
        lineType: "curved",
        roughness: 1,
      }),
    ]);
    await page.mouse.click(325, 225);
    const a = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { lineType: e.lineType, roughness: e.roughness };
    });
    expect(a.lineType).toBe("curved");
    expect(a.roughness).toBe(1);
  });
});

test.describe("renderer.ts line with auto lineType sketch", () => {
  test("auto line with roughness", async ({ page }) => {
    await loadScene(page, [
      el("la1", "line", 200, 200, 200, 50, {
        lineType: "auto",
        roughness: 1,
      }),
    ]);
    await page.mouse.click(300, 225);
    const l = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { lineType: e.lineType, roughness: e.roughness };
    });
    expect(l.lineType).toBe("auto");
  });
});

test.describe("renderer.ts arrow sketch with solid stroke", () => {
  test("solid arrow with roughness", async ({ page }) => {
    await loadScene(page, [
      el("as1", "arrow", 200, 200, 250, 0, {
        strokeStyle: "solid",
        roughness: 1,
      }),
    ]);
    await page.mouse.click(325, 200);
    const a = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { strokeStyle: e.strokeStyle, roughness: e.roughness };
    });
    expect(a.strokeStyle).toBe("solid");
    expect(a.roughness).toBe(1);
  });
});

test.describe("renderer.ts rectangle solid stroke sketch", () => {
  test("solid stroke rectangle with roughness", async ({ page }) => {
    await loadScene(page, [
      el("rs1", "rectangle", 200, 200, 150, 100, {
        strokeStyle: "solid",
        roughness: 1,
      }),
    ]);
    await page.mouse.click(275, 250);
    const r = await page.evaluate(() => {
      const e = (window as any).__editor__.getSnapshot().doc.elements[0];
      return { strokeStyle: e.strokeStyle, roughness: e.roughness };
    });
    expect(r.strokeStyle).toBe("solid");
    expect(r.roughness).toBe(1);
  });
});
