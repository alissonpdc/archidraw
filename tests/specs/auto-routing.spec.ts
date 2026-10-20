import { test, expect, open, drag, selectTool } from "../fixtures";

test.describe("auto edge routing avoiding shape edges", () => {
  test("rectangle: connections are always perpendicular to the edge", async ({
    page,
  }) => {
    await open(page);

    await selectTool(page, "2");
    await drag(page, { x: 100, y: 100 }, { x: 200, y: 200 });
    await drag(page, { x: 400, y: 300 }, { x: 500, y: 400 });

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const rectA = ed.getSnapshot().doc.elements[0];
      const rectB = ed.getSnapshot().doc.elements[1];

      const a1 = {
        id: "arrow-lr",
        type: "arrow",
        x: 200,
        y: 150,
        width: 200,
        height: 200,
        lineType: "auto",
        startBinding: { elementId: rectA.id, nx: 1, ny: 0.5 },
        endBinding: { elementId: rectB.id, nx: 0, ny: 0.5 },
        strokeColor: "#000",
        backgroundColor: "transparent",
        strokeWidth: 2,
        opacity: 1,
        strokeOpacity: 1,
        fillOpacity: 1,
        strokeStyle: "solid",
        fillStyle: "solid",
        roughness: 0,
        borderRadius: 0,
        startArrowhead: "none",
        endArrowhead: "arrow",
      };

      const a2 = {
        id: "arrow-tb",
        type: "arrow",
        x: 150,
        y: 200,
        width: 300,
        height: 100,
        lineType: "auto",
        startBinding: { elementId: rectA.id, nx: 0.5, ny: 1 },
        endBinding: { elementId: rectB.id, nx: 0.5, ny: 0 },
        strokeColor: "#000",
        backgroundColor: "transparent",
        strokeWidth: 2,
        opacity: 1,
        strokeOpacity: 1,
        fillOpacity: 1,
        strokeStyle: "solid",
        fillStyle: "solid",
        roughness: 0,
        borderRadius: 0,
        startArrowhead: "none",
        endArrowhead: "arrow",
      };

      ed.doc = { ...ed.doc, elements: [...ed.doc.elements, a1, a2] };
      ed.emit();
    });

    const ptsLR = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements.find((e: any) => e.id === "arrow-lr");
      return (window as any).__archidrawUtils__.edgePathPoints(el);
    });

    expect(ptsLR[0]).toEqual({ x: 200, y: 150 });
    expect(ptsLR[1].y).toBe(150);
    expect(ptsLR[1].x).toBeGreaterThan(200);
    expect(ptsLR[ptsLR.length - 2].y).toBe(350);
    expect(ptsLR[ptsLR.length - 1]).toEqual({ x: 400, y: 350 });

    const ptsTB = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements.find((e: any) => e.id === "arrow-tb");
      return (window as any).__archidrawUtils__.edgePathPoints(el);
    });

    expect(ptsTB[0]).toEqual({ x: 150, y: 200 });
    expect(ptsTB[1].x).toBe(150);
    expect(ptsTB[1].y).toBeGreaterThan(200);
    expect(ptsTB[ptsTB.length - 2].x).toBe(450);
    expect(ptsTB[ptsTB.length - 1]).toEqual({ x: 450, y: 300 });

    for (const pts of [ptsLR, ptsTB]) {
      for (let i = 1; i < pts.length; i++) {
        const dx = Math.abs(pts[i].x - pts[i - 1].x);
        const dy = Math.abs(pts[i].y - pts[i - 1].y);
        expect(dx === 0 || dy === 0).toBe(true);
      }
    }
  });

  test("diamond: lateral vertices connect horizontally, top/bottom vertices connect vertically", async ({
    page,
  }) => {
    await open(page);

    await selectTool(page, "3");
    await drag(page, { x: 100, y: 100 }, { x: 200, y: 200 });
    await drag(page, { x: 400, y: 300 }, { x: 500, y: 400 });

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const d1 = ed.getSnapshot().doc.elements[0];
      const d2 = ed.getSnapshot().doc.elements[1];

      const a1 = {
        id: "diamond-arrow-h",
        type: "arrow",
        x: 200,
        y: 150,
        width: 200,
        height: 200,
        lineType: "auto",
        startBinding: { elementId: d1.id, nx: 1, ny: 0.5 },
        endBinding: { elementId: d2.id, nx: 0, ny: 0.5 },
        strokeColor: "#000",
        backgroundColor: "transparent",
        strokeWidth: 2,
        opacity: 1,
        strokeOpacity: 1,
        fillOpacity: 1,
        strokeStyle: "solid",
        fillStyle: "solid",
        roughness: 0,
        borderRadius: 0,
        startArrowhead: "none",
        endArrowhead: "arrow",
      };

      const a2 = {
        id: "diamond-arrow-v",
        type: "arrow",
        x: 150,
        y: 200,
        width: 300,
        height: 100,
        lineType: "auto",
        startBinding: { elementId: d1.id, nx: 0.5, ny: 1 },
        endBinding: { elementId: d2.id, nx: 0.5, ny: 0 },
        strokeColor: "#000",
        backgroundColor: "transparent",
        strokeWidth: 2,
        opacity: 1,
        strokeOpacity: 1,
        fillOpacity: 1,
        strokeStyle: "solid",
        fillStyle: "solid",
        roughness: 0,
        borderRadius: 0,
        startArrowhead: "none",
        endArrowhead: "arrow",
      };

      ed.doc = { ...ed.doc, elements: [...ed.doc.elements, a1, a2] };
      ed.emit();
    });

    const ptsH = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements.find((e: any) => e.id === "diamond-arrow-h");
      return (window as any).__archidrawUtils__.edgePathPoints(el);
    });

    expect(ptsH[0]).toEqual({ x: 200, y: 150 });
    expect(ptsH[1].y).toBe(150);
    expect(ptsH[1].x).toBeGreaterThan(200);
    expect(ptsH[ptsH.length - 2].y).toBe(350);
    expect(ptsH[ptsH.length - 1]).toEqual({ x: 400, y: 350 });

    const ptsV = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements.find((e: any) => e.id === "diamond-arrow-v");
      return (window as any).__archidrawUtils__.edgePathPoints(el);
    });

    expect(ptsV[0]).toEqual({ x: 150, y: 200 });
    expect(ptsV[1].x).toBe(150);
    expect(ptsV[1].y).toBeGreaterThan(200);
    expect(ptsV[ptsV.length - 2].x).toBe(450);
    expect(ptsV[ptsV.length - 1]).toEqual({ x: 450, y: 300 });

    for (const pts of [ptsH, ptsV]) {
      for (let i = 1; i < pts.length; i++) {
        const dx = Math.abs(pts[i].x - pts[i - 1].x);
        const dy = Math.abs(pts[i].y - pts[i - 1].y);
        expect(dx === 0 || dy === 0).toBe(true);
      }
    }
  });

  test("ellipse: horizontal mid-points connect horizontally, vertical mid-points connect vertically", async ({
    page,
  }) => {
    await open(page);

    await selectTool(page, "4");
    await drag(page, { x: 100, y: 100 }, { x: 200, y: 200 });
    await drag(page, { x: 400, y: 300 }, { x: 500, y: 400 });

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const e1 = ed.getSnapshot().doc.elements[0];
      const e2 = ed.getSnapshot().doc.elements[1];

      const a1 = {
        id: "ellipse-arrow-h",
        type: "arrow",
        x: 200,
        y: 150,
        width: 200,
        height: 200,
        lineType: "auto",
        startBinding: { elementId: e1.id, nx: 1, ny: 0.5 },
        endBinding: { elementId: e2.id, nx: 0, ny: 0.5 },
        strokeColor: "#000",
        backgroundColor: "transparent",
        strokeWidth: 2,
        opacity: 1,
        strokeOpacity: 1,
        fillOpacity: 1,
        strokeStyle: "solid",
        fillStyle: "solid",
        roughness: 0,
        borderRadius: 0,
        startArrowhead: "none",
        endArrowhead: "arrow",
      };

      const a2 = {
        id: "ellipse-arrow-v",
        type: "arrow",
        x: 150,
        y: 200,
        width: 300,
        height: 100,
        lineType: "auto",
        startBinding: { elementId: e1.id, nx: 0.5, ny: 1 },
        endBinding: { elementId: e2.id, nx: 0.5, ny: 0 },
        strokeColor: "#000",
        backgroundColor: "transparent",
        strokeWidth: 2,
        opacity: 1,
        strokeOpacity: 1,
        fillOpacity: 1,
        strokeStyle: "solid",
        fillStyle: "solid",
        roughness: 0,
        borderRadius: 0,
        startArrowhead: "none",
        endArrowhead: "arrow",
      };

      ed.doc = { ...ed.doc, elements: [...ed.doc.elements, a1, a2] };
      ed.emit();
    });

    const ptsH = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements.find((e: any) => e.id === "ellipse-arrow-h");
      return (window as any).__archidrawUtils__.edgePathPoints(el);
    });

    expect(ptsH[0]).toEqual({ x: 200, y: 150 });
    expect(ptsH[1].y).toBe(150);
    expect(ptsH[1].x).toBeGreaterThan(200);
    expect(ptsH[ptsH.length - 2].y).toBe(350);
    expect(ptsH[ptsH.length - 1]).toEqual({ x: 400, y: 350 });

    const ptsV = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements.find((e: any) => e.id === "ellipse-arrow-v");
      return (window as any).__archidrawUtils__.edgePathPoints(el);
    });

    expect(ptsV[0]).toEqual({ x: 150, y: 200 });
    expect(ptsV[1].x).toBe(150);
    expect(ptsV[1].y).toBeGreaterThan(200);
    expect(ptsV[ptsV.length - 2].x).toBe(450);
    expect(ptsV[ptsV.length - 1]).toEqual({ x: 450, y: 300 });

    for (const pts of [ptsH, ptsV]) {
      for (let i = 1; i < pts.length; i++) {
        const dx = Math.abs(pts[i].x - pts[i - 1].x);
        const dy = Math.abs(pts[i].y - pts[i - 1].y);
        expect(dx === 0 || dy === 0).toBe(true);
      }
    }
  });

  test("interactive draw between shapes in auto mode connects perpendicularly", async ({
    page,
  }) => {
    await open(page);

    await selectTool(page, "2");
    await drag(page, { x: 100, y: 100 }, { x: 200, y: 200 });
    await drag(page, { x: 400, y: 300 }, { x: 500, y: 400 });

    await selectTool(page, "6");
    await drag(page, { x: 205, y: 150 }, { x: 395, y: 350 });

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const arrow = ed.getSnapshot().doc.elements[2];
      ed.updateElements([arrow.id], { lineType: "auto" });
    });

    const pts = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const arrow = ed.getSnapshot().doc.elements[2];
      return (window as any).__archidrawUtils__.edgePathPoints(arrow);
    });

    expect(pts[0].x).toBeCloseTo(200, 0);
    expect(pts[0].y).toBeCloseTo(150, 0);
    expect(pts[1].y).toBeCloseTo(150, 0);
    expect(pts[1].x).toBeGreaterThan(200);

    expect(pts[pts.length - 2].y).toBeCloseTo(350, 0);
    expect(pts[pts.length - 1].x).toBeCloseTo(400, 0);
    expect(pts[pts.length - 1].y).toBeCloseTo(350, 0);

    for (let i = 1; i < pts.length; i++) {
      const dx = Math.abs(pts[i].x - pts[i - 1].x);
      const dy = Math.abs(pts[i].y - pts[i - 1].y);
      expect(dx === 0 || dy === 0).toBe(true);
    }
  });

  test("U-turns and reverse-facing connections route orthogonally without crossing arestas", async ({
    page,
  }) => {
    await open(page);

    await selectTool(page, "2");
    await drag(page, { x: 300, y: 100 }, { x: 400, y: 200 });
    await drag(page, { x: 300, y: 350 }, { x: 400, y: 450 });

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const r1 = ed.getSnapshot().doc.elements[0];
      const r2 = ed.getSnapshot().doc.elements[1];

      const makeArrow = (id: string, sb: any, eb: any) => ({
        id,
        type: "arrow" as const,
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        lineType: "auto" as const,
        startBinding: sb,
        endBinding: eb,
        strokeColor: "#000",
        backgroundColor: "transparent",
        strokeWidth: 2,
        opacity: 1,
        strokeOpacity: 1,
        fillOpacity: 1,
        strokeStyle: "solid" as const,
        fillStyle: "solid" as const,
        roughness: 0 as const,
        borderRadius: 0,
        startArrowhead: "none" as const,
        endArrowhead: "arrow" as const,
      });

      const aRR = makeArrow("a-rr", { elementId: r1.id, nx: 1, ny: 0.5 }, { elementId: r2.id, nx: 1, ny: 0.5 });
      const aLL = makeArrow("a-ll", { elementId: r1.id, nx: 0, ny: 0.5 }, { elementId: r2.id, nx: 0, ny: 0.5 });
      const aBB = makeArrow("a-bb", { elementId: r1.id, nx: 0.5, ny: 1 }, { elementId: r2.id, nx: 0.5, ny: 1 });
      const aTT = makeArrow("a-tt", { elementId: r1.id, nx: 0.5, ny: 0 }, { elementId: r2.id, nx: 0.5, ny: 0 });
      const aRevH = makeArrow("a-revh", { elementId: r2.id, nx: 1, ny: 0.5 }, { elementId: r1.id, nx: 0, ny: 0.5 });
      const aRevV = makeArrow("a-revv", { elementId: r2.id, nx: 0.5, ny: 1 }, { elementId: r1.id, nx: 0.5, ny: 0 });

      ed.doc = { ...ed.doc, elements: [...ed.doc.elements, aRR, aLL, aBB, aTT, aRevH, aRevV] };
      ed.emit();
    });

    const ids = ["a-rr", "a-ll", "a-bb", "a-tt", "a-revh", "a-revv"];
    for (const id of ids) {
      const pts = await page.evaluate((arrowId) => {
        const ed = (window as any).__editor__;
        const el = ed.getSnapshot().doc.elements.find((e: any) => e.id === arrowId);
        return (window as any).__archidrawUtils__.edgePathPoints(el);
      }, id);

      expect(pts.length).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < pts.length; i++) {
        const dx = Math.abs(pts[i].x - pts[i - 1].x);
        const dy = Math.abs(pts[i].y - pts[i - 1].y);
        expect(dx === 0 || dy === 0).toBe(true);
      }
    }
  });

  test("one-end-bound and free auto lines route with perpendicular connection where bound", async ({
    page,
  }) => {
    await open(page);

    await selectTool(page, "2");
    await drag(page, { x: 200, y: 200 }, { x: 300, y: 300 });

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const rect = ed.getSnapshot().doc.elements[0];

      const makeArrow = (id: string, x: number, y: number, w: number, h: number, sb: any, eb: any) => ({
        id,
        type: "arrow" as const,
        x,
        y,
        width: w,
        height: h,
        lineType: "auto" as const,
        startBinding: sb,
        endBinding: eb,
        strokeColor: "#000",
        backgroundColor: "transparent",
        strokeWidth: 2,
        opacity: 1,
        strokeOpacity: 1,
        fillOpacity: 1,
        strokeStyle: "solid" as const,
        fillStyle: "solid" as const,
        roughness: 0 as const,
        borderRadius: 0,
        startArrowhead: "none" as const,
        endArrowhead: "arrow" as const,
      });

      const a1 = makeArrow("free-arrow", 50, 50, 100, 100, undefined, undefined);
      const a2 = makeArrow("bound-start-r-ahead", 300, 250, 100, 50, { elementId: rect.id, nx: 1, ny: 0.5 }, undefined);
      const a3 = makeArrow("bound-start-r-behind", 300, 250, -150, 50, { elementId: rect.id, nx: 1, ny: 0.5 }, undefined);
      const a4 = makeArrow("bound-start-l-ahead", 200, 250, -100, 50, { elementId: rect.id, nx: 0, ny: 0.5 }, undefined);
      const a5 = makeArrow("bound-start-l-behind", 200, 250, 150, 50, { elementId: rect.id, nx: 0, ny: 0.5 }, undefined);
      const a6 = makeArrow("bound-start-b-ahead", 250, 300, 50, 100, { elementId: rect.id, nx: 0.5, ny: 1 }, undefined);
      const a7 = makeArrow("bound-start-b-behind", 250, 300, 50, -150, { elementId: rect.id, nx: 0.5, ny: 1 }, undefined);
      const a8 = makeArrow("bound-start-t-ahead", 250, 200, 50, -100, { elementId: rect.id, nx: 0.5, ny: 0 }, undefined);
      const a9 = makeArrow("bound-start-t-behind", 250, 200, 50, 150, { elementId: rect.id, nx: 0.5, ny: 0 }, undefined);

      const b1 = makeArrow("bound-end-l-ahead", 100, 250, 100, 0, undefined, { elementId: rect.id, nx: 0, ny: 0.5 });
      const b2 = makeArrow("bound-end-l-behind", 350, 250, -150, 0, undefined, { elementId: rect.id, nx: 0, ny: 0.5 });
      const b3 = makeArrow("bound-end-r-ahead", 400, 250, -100, 0, undefined, { elementId: rect.id, nx: 1, ny: 0.5 });
      const b4 = makeArrow("bound-end-r-behind", 150, 250, 150, 0, undefined, { elementId: rect.id, nx: 1, ny: 0.5 });
      const b5 = makeArrow("bound-end-t-ahead", 250, 100, 0, 100, undefined, { elementId: rect.id, nx: 0.5, ny: 0 });
      const b6 = makeArrow("bound-end-t-behind", 250, 350, 0, -150, undefined, { elementId: rect.id, nx: 0.5, ny: 0 });
      const b7 = makeArrow("bound-end-b-ahead", 250, 400, 0, -100, undefined, { elementId: rect.id, nx: 0.5, ny: 1 });
      const b8 = makeArrow("bound-end-b-behind", 250, 150, 0, 150, undefined, { elementId: rect.id, nx: 0.5, ny: 1 });

      ed.doc = {
        ...ed.doc,
        elements: [...ed.doc.elements, a1, a2, a3, a4, a5, a6, a7, a8, a9, b1, b2, b3, b4, b5, b6, b7, b8],
      };
      ed.emit();
    });

    const ids = [
      "free-arrow",
      "bound-start-r-ahead",
      "bound-start-r-behind",
      "bound-start-l-ahead",
      "bound-start-l-behind",
      "bound-start-b-ahead",
      "bound-start-b-behind",
      "bound-start-t-ahead",
      "bound-start-t-behind",
      "bound-end-l-ahead",
      "bound-end-l-behind",
      "bound-end-r-ahead",
      "bound-end-r-behind",
      "bound-end-t-ahead",
      "bound-end-t-behind",
      "bound-end-b-ahead",
      "bound-end-b-behind",
    ];

    for (const id of ids) {
      const pts = await page.evaluate((arrowId) => {
        const ed = (window as any).__editor__;
        const el = ed.getSnapshot().doc.elements.find((e: any) => e.id === arrowId);
        return (window as any).__archidrawUtils__.edgePathPoints(el);
      }, id);

      expect(pts.length).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < pts.length; i++) {
        const dx = Math.abs(pts[i].x - pts[i - 1].x);
        const dy = Math.abs(pts[i].y - pts[i - 1].y);
        expect(dx === 0 || dy === 0).toBe(true);
      }
    }
  });

  test("cross orientation connections with detouring when not aligned", async ({
    page,
  }) => {
    await open(page);

    await selectTool(page, "2");
    await drag(page, { x: 100, y: 100 }, { x: 200, y: 200 });
    await drag(page, { x: 300, y: 100 }, { x: 400, y: 200 });

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const r1 = ed.getSnapshot().doc.elements[0];
      const r2 = ed.getSnapshot().doc.elements[1];

      const makeArrow = (id: string, sb: any, eb: any) => ({
        id,
        type: "arrow" as const,
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        lineType: "auto" as const,
        startBinding: sb,
        endBinding: eb,
        strokeColor: "#000",
        backgroundColor: "transparent",
        strokeWidth: 2,
        opacity: 1,
        strokeOpacity: 1,
        fillOpacity: 1,
        strokeStyle: "solid" as const,
        fillStyle: "solid" as const,
        roughness: 0 as const,
        borderRadius: 0,
        startArrowhead: "none" as const,
        endArrowhead: "arrow" as const,
      });

      const a1 = makeArrow("c1", { elementId: r1.id, nx: 1, ny: 0.5 }, { elementId: r2.id, nx: 0.5, ny: 1 });
      const a2 = makeArrow("c2", { elementId: r2.id, nx: 0, ny: 0.5 }, { elementId: r1.id, nx: 0.5, ny: 0 });
      const a3 = makeArrow("c3", { elementId: r1.id, nx: 0.5, ny: 0 }, { elementId: r2.id, nx: 0, ny: 0.5 });
      const a4 = makeArrow("c4", { elementId: r1.id, nx: 0.5, ny: 1 }, { elementId: r2.id, nx: 1, ny: 0.5 });

      ed.doc = { ...ed.doc, elements: [...ed.doc.elements, a1, a2, a3, a4] };
      ed.emit();
    });

    const ids = ["c1", "c2", "c3", "c4"];
    for (const id of ids) {
      const pts = await page.evaluate((arrowId) => {
        const ed = (window as any).__editor__;
        const el = ed.getSnapshot().doc.elements.find((e: any) => e.id === arrowId);
        return (window as any).__archidrawUtils__.edgePathPoints(el);
      }, id);

      expect(pts.length).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < pts.length; i++) {
        const dx = Math.abs(pts[i].x - pts[i - 1].x);
        const dy = Math.abs(pts[i].y - pts[i - 1].y);
        expect(dx === 0 || dy === 0).toBe(true);
      }
    }
  });

  test("moving shapes updates bindings and derives side if absent", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const r1 = {
        id: "r1",
        type: "rectangle" as const,
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        strokeColor: "#000",
        backgroundColor: "transparent",
        strokeWidth: 2,
        opacity: 1,
        strokeOpacity: 1,
        fillOpacity: 1,
        strokeStyle: "solid" as const,
        fillStyle: "solid" as const,
        roughness: 0 as const,
        borderRadius: 0,
      };
      const r2 = {
        ...r1,
        id: "r2",
        x: 400,
        y: 100,
      };
      const arrow = {
        id: "a1",
        type: "arrow" as const,
        x: 200,
        y: 150,
        width: 200,
        height: 0,
        lineType: "auto" as const,
        startBinding: { elementId: "r1", nx: 1, ny: 0.5 },
        endBinding: { elementId: "r2", nx: 0, ny: 0.5 },
        strokeColor: "#000",
        backgroundColor: "transparent",
        strokeWidth: 2,
        opacity: 1,
        strokeOpacity: 1,
        fillOpacity: 1,
        strokeStyle: "solid" as const,
        fillStyle: "solid" as const,
        roughness: 0 as const,
        borderRadius: 0,
        startArrowhead: "none" as const,
        endArrowhead: "arrow" as const,
      };
      ed.doc = { ...ed.doc, elements: [r1, r2, arrow] };
      ed.emit();
      (ed as any).syncEdgesBoundTo("r1");
      (ed as any).syncEdgesBoundTo("r2");
      ed.emit();
    });
    const a = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements.find((e: any) => e.id === "a1");
    });
    expect(a.startBinding.side).toBe("right");
    expect(a.endBinding.side).toBe("left");
  });

  test("defaultAutoPath covers all directional combinations and edge cases", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const { defaultAutoPath, determineBindingSide } = (window as any).__archidrawUtils__;

      defaultAutoPath({ x: 0, y: 0 }, { x: 100, y: 100 });

      defaultAutoPath({ x: 0, y: 0 }, { x: 100, y: 50 }, "right");
      defaultAutoPath({ x: 100, y: 0 }, { x: 0, y: 50 }, "right");
      defaultAutoPath({ x: 100, y: 0 }, { x: 0, y: 50 }, "left");
      defaultAutoPath({ x: 0, y: 0 }, { x: 100, y: 50 }, "left");
      defaultAutoPath({ x: 0, y: 0 }, { x: 50, y: 100 }, "bottom");
      defaultAutoPath({ x: 0, y: 100 }, { x: 50, y: 0 }, "bottom");
      defaultAutoPath({ x: 0, y: 100 }, { x: 50, y: 0 }, "top");
      defaultAutoPath({ x: 0, y: 0 }, { x: 50, y: 100 }, "top");

      defaultAutoPath({ x: 0, y: 50 }, { x: 100, y: 0 }, undefined, "left");
      defaultAutoPath({ x: 100, y: 50 }, { x: 0, y: 0 }, undefined, "left");
      defaultAutoPath({ x: 100, y: 50 }, { x: 0, y: 0 }, undefined, "right");
      defaultAutoPath({ x: 0, y: 50 }, { x: 100, y: 0 }, undefined, "right");
      defaultAutoPath({ x: 50, y: 0 }, { x: 0, y: 100 }, undefined, "top");
      defaultAutoPath({ x: 50, y: 100 }, { x: 0, y: 0 }, undefined, "top");
      defaultAutoPath({ x: 50, y: 100 }, { x: 0, y: 0 }, undefined, "bottom");
      defaultAutoPath({ x: 50, y: 0 }, { x: 0, y: 100 }, undefined, "bottom");

      defaultAutoPath({ x: 0, y: 0 }, { x: 100, y: 100 }, "right", "left");
      defaultAutoPath({ x: 100, y: 0 }, { x: 50, y: 100 }, "right", "left");
      defaultAutoPath({ x: 100, y: 0 }, { x: 0, y: 100 }, "left", "right");
      defaultAutoPath({ x: 0, y: 0 }, { x: 50, y: 100 }, "left", "right");
      defaultAutoPath({ x: 0, y: 0 }, { x: 100, y: 100 }, "right", "right");
      defaultAutoPath({ x: 100, y: 0 }, { x: 0, y: 100 }, "left", "left");

      defaultAutoPath({ x: 0, y: 0 }, { x: 100, y: 100 }, "bottom", "top");
      defaultAutoPath({ x: 0, y: 100 }, { x: 100, y: 50 }, "bottom", "top");
      defaultAutoPath({ x: 0, y: 100 }, { x: 100, y: 0 }, "top", "bottom");
      defaultAutoPath({ x: 0, y: 0 }, { x: 100, y: 50 }, "top", "bottom");
      defaultAutoPath({ x: 0, y: 0 }, { x: 100, y: 100 }, "bottom", "bottom");
      defaultAutoPath({ x: 0, y: 100 }, { x: 100, y: 0 }, "top", "top");

      defaultAutoPath({ x: 0, y: 0 }, { x: 100, y: 100 }, "right", "top");
      defaultAutoPath({ x: 100, y: 100 }, { x: 0, y: 0 }, "right", "top");
      defaultAutoPath({ x: 100, y: 100 }, { x: 0, y: 0 }, "left", "bottom");
      defaultAutoPath({ x: 0, y: 0 }, { x: 100, y: 100 }, "left", "bottom");

      defaultAutoPath({ x: 0, y: 0 }, { x: 100, y: 100 }, "bottom", "left");
      defaultAutoPath({ x: 100, y: 100 }, { x: 0, y: 0 }, "bottom", "left");
      defaultAutoPath({ x: 100, y: 100 }, { x: 0, y: 0 }, "top", "right");
      defaultAutoPath({ x: 0, y: 0 }, { x: 100, y: 100 }, "top", "right");

      determineBindingSide();
      determineBindingSide({ elementId: "x", nx: 0.5, ny: 0 });
      determineBindingSide({ elementId: "x", nx: 0.5, ny: 1 });
      determineBindingSide({ elementId: "x", nx: 0, ny: 0.5 });
      determineBindingSide({ elementId: "x", nx: 1, ny: 0.5 });
    });
  });
});

