import { test, expect, drag, open } from "../fixtures";
import type { Element, ElementType } from "../../src/core/types";

test.describe("canvas performance", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
  });

  test("renders 500 elements and maintains high FPS during panning", async ({
    page,
    editorState,
  }) => {
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const elements: Element[] = [];
      const types: ElementType[] = [
        "rectangle",
        "diamond",
        "ellipse",
        "text",
      ];
      let id = 1;
      for (let r = 0; r < 20; r++) {
        for (let c = 0; c < 25; c++) {
          const type = types[(r + c) % types.length];
          const x = c * 140;
          const y = r * 100;
          const el: any = {
            id: `perf-el-${id++}`,
            type,
            x,
            y,
            width: 100,
            height: 60,
            strokeColor: "#3d4248",
            backgroundColor: (r + c) % 3 === 0 ? "#6965db1a" : "transparent",
            strokeWidth: 2,
            opacity: 1,
            strokeOpacity: 1,
            fillOpacity: 1,
            strokeStyle: "solid",
            fillStyle: (r + c) % 3 === 0 ? "hachure" : "solid",
            roughness: 1,
            borderRadius: 8,
          };
          if (type === "text") {
            el.text = `Node ${id}`;
            el.fontSize = 16;
          } else {
            el.label = `Node ${id}`;
            el.fontSize = 14;
          }
          elements.push(el);
        }
      }
      ed.doc = { ...ed.doc, elements };
      ed.emit();
    });

    const s = await editorState();
    expect(s.elements.length).toBe(500);

    const fpsResult = await page.evaluate(async () => {
      const ed = (window as any).__editor__;
      const frameTimes: number[] = [];
      let lastTime = performance.now();

      return new Promise<{ avgFps: number; frameCount: number }>((resolve) => {
        let count = 0;
        function step(now: number) {
          const delta = now - lastTime;
          lastTime = now;
          if (delta > 0) {
            frameTimes.push(delta);
          }
          ed.camera = {
            ...ed.camera,
            scrollX: ed.camera.scrollX + 5,
            scrollY: ed.camera.scrollY + 3,
          };
          ed.emit();
          count++;
          if (count < 60) {
            requestAnimationFrame(step);
          } else {
            const avgDelta =
              frameTimes.reduce((acc, v) => acc + v, 0) / frameTimes.length;
            const avgFps = 1000 / avgDelta;
            resolve({ avgFps, frameCount: frameTimes.length });
          }
        }
        requestAnimationFrame(step);
      });
    });

    expect(fpsResult.frameCount).toBeGreaterThanOrEqual(58);
    expect(fpsResult.avgFps).toBeGreaterThan(45);

    await page.keyboard.down("Space");
    await drag(page, { x: 500, y: 300 }, { x: 300, y: 200 });
    await page.keyboard.up("Space");

    const after = await editorState();
    expect(after.camera.scrollX).toBeLessThan(fpsResult.frameCount * 5);
  });

  test("viewport culling skips offscreen elements without errors", async ({
    page,
    editorState,
  }) => {
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const elements: Element[] = [];
      for (let i = 0; i < 300; i++) {
        elements.push({
          id: `cull-${i}`,
          type: "rectangle",
          x: 5000 + i * 200,
          y: 5000,
          width: 100,
          height: 80,
          strokeColor: "#3d4248",
          backgroundColor: "transparent",
          strokeWidth: 2,
          opacity: 1,
          strokeOpacity: 1,
          fillOpacity: 1,
          strokeStyle: "solid",
          fillStyle: "solid",
          roughness: 1,
          borderRadius: 4,
        } as any);
      }
      ed.doc = { ...ed.doc, elements };
      ed.emit();
    });

    const stateBefore = await editorState();
    expect(stateBefore.elements.length).toBe(300);

    await page.mouse.move(640, 400);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -200);
    await page.mouse.wheel(0, 200);
    await page.keyboard.up("Control");

    const stateAfter = await editorState();
    expect(stateAfter.elements.length).toBe(300);
  });

  test("measureText cache eviction at limit", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const ed = (window as any).__editor__;
      const el: any = {
        id: "rect-measure",
        type: "rectangle",
        x: 100,
        y: 100,
        width: 150,
        height: 80,
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
        label: "Initial",
        fontSize: 14,
      };
      ed.doc = { ...ed.doc, elements: [el] };
      ed.emit();

      for (let i = 0; i < 3005; i++) {
        ed.updateLabel(el.id, `Label-${i}`);
      }
      return ed.getSnapshot().doc.elements[0].label;
    });

    expect(result).toBe("Label-3004");
  });

  test("underlined labels with various alignments render cleanly", async ({
    page,
    editorState,
  }) => {
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const elements: any[] = [
        {
          id: "comp-underlined",
          type: "component",
          componentId: "lambda",
          x: 200,
          y: 200,
          width: 80,
          height: 80,
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
          label: "Lambda Function\nWorker",
          underline: true,
        },
        {
          id: "rect-right-underlined",
          type: "rectangle",
          x: 400,
          y: 200,
          width: 140,
          height: 80,
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
          label: "Right Text",
          textAlign: "right",
          underline: true,
        },
      ];
      ed.doc = { ...ed.doc, elements };
      ed.emit();
    });

    const s = await editorState();
    expect(s.elements.length).toBe(2);
  });

  test("renders canvas with grid dots and lines modes", async ({ page }) => {
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const cvs = document.createElement("canvas");
      cvs.width = 400;
      cvs.height = 300;
      const ctx = cvs.getContext("2d")!;
      ed.renderTo(ctx, 400, 300, { gridMode: "dots" });
      ed.renderTo(ctx, 400, 300, { gridMode: "lines" });
    });
  });

  test("renders arrows, curves, edge labels and auto-routed lines with different roughness", async ({
    page,
    editorState,
  }) => {
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const elements: any[] = [
        {
          id: "arrow-auto-rev",
          type: "arrow",
          x: 300,
          y: 300,
          width: -200,
          height: -200,
          lineType: "auto",
          bendPoints: [{ x: 500, y: 500 }],
          label: "Rev Auto\nSecond Line Longer",
          strokeColor: "#3d4248",
          roughness: 0,
          strokeWidth: 2,
        },
        {
          id: "arrow-curved",
          type: "arrow",
          x: 100,
          y: 100,
          width: 200,
          height: 100,
          lineType: "curved",
          curveOffset: 40,
          label: "Curved Arrow",
          strokeColor: "#3d4248",
          roughness: 1,
          strokeWidth: 2,
        },
        {
          id: "line-straight-rough0",
          type: "line",
          x: 50,
          y: 50,
          width: 100,
          height: 0,
          lineType: "straight",
          roughness: 0,
          strokeColor: "#3d4248",
          strokeWidth: 2,
        },
      ];
      ed.doc = { ...ed.doc, elements };
      ed.emit();
    });

    const s = await editorState();
    expect(s.elements.length).toBe(3);
  });
});
