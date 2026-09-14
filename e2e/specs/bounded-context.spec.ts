import { test, expect, drag, selectTool, open, pressPaste } from "../fixtures";

test.describe("bounded context", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await selectTool(page, "1");
  });

  test("drag with bounded-context tool creates a context element", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });

    const s = await editorState();
    expect(s.elementCount).toBe(1);
    expect(s.elements[0].type).toBe("context");
    expect(s.selectedIds).toHaveLength(1);
  });

  test("context has default label 'Context'", async ({
    page,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });

    const label = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].label;
    });
    expect(label).toBe("Context");
  });

  test("context has solid, thin, neutral, rounded stroke by default", async ({
    page,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });

    const style = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      return {
        strokeStyle: el.strokeStyle,
        strokeWidth: el.strokeWidth,
        strokeColor: el.strokeColor,
        borderRadius: el.borderRadius,
        fontSize: el.fontSize,
        label: el.label,
        labelPosition: el.labelPosition,
        labelSide: el.labelSide,
      };
    });
    expect(style.strokeStyle).toBe("solid");
    expect(style.strokeWidth).toBe(1);
    expect(style.strokeColor).toBe("#c4c7ca");
    // custom rounded border (10%) + top-left internal label by default
    expect(style.borderRadius).toBe(10);
    expect(style.fontSize).toBe(16);
    expect(style.labelPosition).toBe("top-left");
    expect(style.labelSide).toBe("internal");
  });

  test("roundness and font size are adjustable from the panel", async ({
    page,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });

    await selectTool(page, "1");
    await page.mouse.click(350, 300);

    const textTab = page
      .locator(".properties-panel .panel-tabs")
      .getByRole("button", { name: "Text", exact: true });
    const styleTab = page
      .locator(".properties-panel .panel-tabs")
      .getByRole("button", { name: "Style", exact: true });

    // font size S button
    await textTab.click();
    for (const f of ["S (16px)", "M (20px)", "L (28px)", "XL (36px)"]) {
      const b = page.getByRole("button", { name: `Font ${f}` });
      await b.scrollIntoViewIfNeeded();
      await b.click();
    }
    const fs = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].fontSize;
    });
    expect(fs).toBe(36);

    // roundness presets in the Style tab
    await styleTab.click();
    for (const btn of ["Square borders", "Rounded borders", "Custom borders"]) {
      const b = page.getByRole("button", { name: btn });
      await b.scrollIntoViewIfNeeded();
      await b.click();
    }
    const radius = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].borderRadius;
    });
    expect(radius).toBe(25);

    // tweak the custom rounding slider
    const slider = page.locator('input[aria-label="Custom rounding"]');
    await slider.scrollIntoViewIfNeeded();
    await slider.fill("50");
    const radius2 = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].borderRadius;
    });
    expect(radius2).toBe(50);

    // line spacing and text color controls for the context label
    await textTab.click();
    const lsSlider = page.locator('input[aria-label="Line spacing"]');
    await lsSlider.scrollIntoViewIfNeeded();
    await lsSlider.fill("1.6");
    const ls = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].lineSpacing;
    });
    expect(ls).toBe(1.6);

    const colorChip = page.getByRole("button", { name: "Text color Red" });
    await colorChip.click();
    await page
      .getByRole("button", { name: "Text color Red intensity 1" })
      .click();
    const color = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].textColor;
    });
    expect(typeof color).toBe("string");
    expect(color.startsWith("#")).toBe(true);
  });

  test("roundness presets apply to contexts", async ({ page }) => {
    await selectTool(page, "8");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });

    const setRadius = (borderRadius: number) =>
      page.evaluate((v) => {
        const ed = (window as any).__editor__;
        const id = ed.getSnapshot().doc.elements[0].id;
        ed.commitHistory();
        ed.updateElements([id], { borderRadius: v });
      }, borderRadius);

    await setRadius(0);
    let el = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].borderRadius;
    });
    expect(el).toBe(0);

    await setRadius(25);
    el = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].borderRadius;
    });
    expect(el).toBe(25);
  });

  test("moving a context moves its contained elements by an identical delta", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 100, y: 100 }, { x: 500, y: 400 });

    await selectTool(page, "2");
    await drag(page, { x: 200, y: 200 }, { x: 300, y: 300 });

    const s1 = await editorState();
    expect(s1.elementCount).toBe(2);

    const posBefore = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements.map((el: any) => ({
        type: el.type,
        x: el.x,
        y: el.y,
      }));
    });
    const ctxBefore = posBefore.find((e: any) => e.type === "context");
    const rectBefore = posBefore.find((e: any) => e.type === "rectangle");

    await selectTool(page, "1");
    await drag(page, { x: 350, y: 300 }, { x: 450, y: 400 });

    const posAfter = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements.map((el: any) => ({
        type: el.type,
        x: el.x,
        y: el.y,
      }));
    });
    const ctxAfter = posAfter.find((e: any) => e.type === "context");
    const rectAfter = posAfter.find((e: any) => e.type === "rectangle");

    // container and child must translate by the exact same delta
    const ctxDx = ctxAfter.x - ctxBefore.x;
    const ctxDy = ctxAfter.y - ctxBefore.y;
    expect(rectAfter.x - rectBefore.x).toBe(ctxDx);
    expect(rectAfter.y - rectBefore.y).toBe(ctxDy);
    expect(ctxDx).toBe(100);
    expect(ctxDy).toBe(100);
  });

  test("children created via text tool and library move together with the context", async ({
    page,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 100, y: 100 }, { x: 700, y: 500 });

    // text created with the text tool (not a drag draft)
    await selectTool(page, "7");
    await page.mouse.click(400, 200);
    await page.keyboard.type("LBL");
    await page.keyboard.press("Escape");

    // component inserted from the library
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.insertComponent("api-gateway", { x: 500, y: 300 });
    });
    await page.waitForTimeout(200);

    const childIds = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements.find((el: any) => el.type === "context")
        .childIds.length;
    });
    expect(childIds).toBe(2);

    const before = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements.map((el: any) => ({
        type: el.type,
        x: el.x,
        y: el.y,
      }));
    });

    await selectTool(page, "1");
    await drag(page, { x: 200, y: 450 }, { x: 280, y: 530 });

    const after = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements.map((el: any) => ({
        type: el.type,
        x: el.x,
        y: el.y,
      }));
    });
    const ctxD = (t: string) => {
      const a = after.find((e: any) => e.type === t);
      const b = before.find((e: any) => e.type === t);
      return a && b ? { dx: a.x - b.x, dy: a.y - b.y } : null;
    };
    const base = ctxD("context");
    expect(base).not.toBeNull();
    for (const t of ["text", "component"]) {
      const d = ctxD(t);
      expect(d).toEqual(base);
    }
  });

  test("double-clicking context opens label editing", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });

    await selectTool(page, "1");
    await page.mouse.dblclick(350, 300);

    const s = await editorState();
    expect(s.editingTextId).not.toBeNull();
  });

  test("context label can be edited via double-click", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });

    await selectTool(page, "1");
    await page.mouse.dblclick(350, 300);

    await page.keyboard.press("Meta+a");
    await page.keyboard.type("Order Context");
    await page.keyboard.press("Escape");

    const s = await editorState();
    expect(s.editingTextId).toBeNull();

    const label = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].label;
    });
    expect(label).toBe("Order Context");
  });

  test("context is hit-testable", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });

    await selectTool(page, "1");
    await page.mouse.click(350, 300);

    const s = await editorState();
    expect(s.selectedIds).toHaveLength(1);
  });

  test("tiny drag does not create a context", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 200, y: 200 }, { x: 201, y: 201 });

    const s = await editorState();
    expect(s.elementCount).toBe(0);
  });

  test("moving a context moves its contained lines too", async ({
    page,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 100, y: 100 }, { x: 600, y: 450 });

    await selectTool(page, "5");
    await drag(page, { x: 250, y: 250 }, { x: 400, y: 320 });

    const lineBefore = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements.map((el: any) => ({
        type: el.type,
        x: el.x,
        y: el.y,
      }));
    });
    const lineStart = lineBefore.find((e: any) => e.type === "line");

    await selectTool(page, "1");
    await drag(page, { x: 400, y: 200 }, { x: 500, y: 300 });

    const lineAfter = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements.map((el: any) => ({
        type: el.type,
        x: el.x,
        y: el.y,
      }));
    });
    const lineEnd = lineAfter.find((e: any) => e.type === "line");

    // line start point must shift by the exact container delta (100,100)
    expect(lineEnd.x - lineStart.x).toBe(100);
    expect(lineEnd.y - lineStart.y).toBe(100);
  });

  test("drawing a context around existing elements captures them", async ({
    page,
  }) => {
    await selectTool(page, "2");
    await drag(page, { x: 200, y: 200 }, { x: 300, y: 300 });

    await selectTool(page, "8");
    await drag(page, { x: 100, y: 100 }, { x: 500, y: 400 });

    const childIds = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const ctx = ed.getSnapshot().doc.elements.find(
        (el: any) => el.type === "context",
      );
      return ctx.childIds ?? [];
    });
    expect(childIds).toHaveLength(1);
  });

  test("label position can be changed via properties panel", async ({
    page,
    editorState,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });

    await selectTool(page, "1");
    await page.mouse.click(350, 300);
    await page
      .locator(".properties-panel .panel-tabs")
      .getByRole("button", { name: "Text", exact: true })
      .click();

    const posBtn = page.getByRole("button", { name: "Label Top Right" });
    await posBtn.scrollIntoViewIfNeeded();
    await posBtn.click();

    const s = await editorState();
    const labelPos = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].labelPosition;
    });
    expect(labelPos).toBe("top-right");

    for (const name of ["Label Bottom Left", "Label Bottom Right", "Label Top Left"]) {
      const btn = page.getByRole("button", { name });
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
    }
    const finalPos = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].labelPosition;
    });
    expect(finalPos).toBe("top-left");
  });

  test("label side toggles internal/external and keeps the corner position", async ({
    page,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });

    await selectTool(page, "1");
    await page.mouse.click(350, 300);
    await page
      .locator(".properties-panel .panel-tabs")
      .getByRole("button", { name: "Text", exact: true })
      .click();

    const state = () =>
      page.evaluate(() => {
        const ed = (window as any).__editor__;
        const el = ed.getSnapshot().doc.elements[0];
        return { labelSide: el.labelSide, labelPosition: el.labelPosition };
      });

    expect((await state()).labelPosition).toBe("top-left");

    // default is external; switch to internal
    await page.getByRole("button", { name: "Label Internal" }).click();
    let s = await state();
    expect(s.labelSide).toBe("internal");
    expect(s.labelPosition).toBe("top-left");

    // change corner while internal
    await page.getByRole("button", { name: "Label Bottom Right" }).click();
    s = await state();
    expect(s.labelSide).toBe("internal");
    expect(s.labelPosition).toBe("bottom-right");

    // back to external keeps the corner
    await page.getByRole("button", { name: "Label External" }).click();
    s = await state();
    expect(s.labelSide).toBe("external");
    expect(s.labelPosition).toBe("bottom-right");
  });

  test("every label corner position applies and persists", async ({
    page,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });

    const idApplies = await page.evaluate(async () => {
      const ed = (window as any).__editor__;
      const id = ed.getSnapshot().doc.elements[0].id;
      const results: Record<string, boolean> = {};
      for (const pos of ["top-left", "top-right", "bottom-left", "bottom-right"]) {
        ed.commitHistory();
        ed.updateElements([id], { labelPosition: pos });
        await new Promise((r) => setTimeout(r, 40));
        results[pos] =
          ed.getSnapshot().doc.elements[0].labelPosition === pos;
      }
      return results;
    });

    expect(idApplies["top-left"]).toBe(true);
    expect(idApplies["top-right"]).toBe(true);
    expect(idApplies["bottom-left"]).toBe(true);
    expect(idApplies["bottom-right"]).toBe(true);
  });

  test("moving an element into a context adds it to childIds", async ({
    page,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 100, y: 100 }, { x: 500, y: 400 });

    // rectangle drawn OUTSIDE the context (right side)
    await selectTool(page, "2");
    await drag(page, { x: 600, y: 200 }, { x: 700, y: 300 });

    await selectTool(page, "1");
    // drag the rectangle into the context
    await drag(page, { x: 650, y: 250 }, { x: 250, y: 250 });

    const childIds = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const ctx = ed.getSnapshot().doc.elements.find(
        (el: any) => el.type === "context",
      );
      return ctx.childIds ?? [];
    });
    expect(childIds).toHaveLength(1);
  });

  test("moving an element out of a context removes it from childIds", async ({
    page,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 100, y: 100 }, { x: 500, y: 400 });

    await selectTool(page, "2");
    await drag(page, { x: 200, y: 200 }, { x: 300, y: 300 });

    await selectTool(page, "1");
    // drag the rectangle out to the right
    await drag(page, { x: 250, y: 250 }, { x: 650, y: 250 });

    const childIds = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const ctx = ed.getSnapshot().doc.elements.find(
        (el: any) => el.type === "context",
      );
      return ctx.childIds ?? [];
    });
    expect(childIds).toHaveLength(0);
  });

  test("context exports to SVG with solid neutral rect and label", async ({
    page,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });

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

    expect(svg).toContain("<rect");
    expect(svg).toContain('stroke="#c4c7ca"');
    expect(svg).not.toContain("stroke-dasharray");
    expect(svg).toContain(">Context</text>");
  });

  test("context label on bottom-right still exports", async ({ page }) => {
    await selectTool(page, "8");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const id = ed.getSnapshot().doc.elements[0].id;
      ed.commitHistory();
      ed.updateElements([id], { labelPosition: "bottom-right" });
    });

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

    expect(svg).toContain(">Context</text>");
  });

  test("context exports top-right bold and bottom-left labels", async ({
    page,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });

    const readSvg = async () => {
      const downloadPromise = page.waitForEvent("download");
      await page.click(".menu-btn");
      await page.getByRole("button", { name: "Export Image…" }).click();
      await page.getByRole("button", { name: "SVG" }).click();
      await page.getByRole("button", { name: "Export" }).click();
      const download = await downloadPromise;
      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      return Buffer.concat(chunks).toString("utf-8");
    };

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const id = ed.getSnapshot().doc.elements[0].id;
      ed.commitHistory();
      ed.updateElements([id], { labelPosition: "top-right", bold: true, italic: true });
    });
    const svgTop = await readSvg();
    expect(svgTop).toContain(">Context</text>");
    expect(svgTop).toContain('font-weight="bold"');
    expect(svgTop).toContain('font-style="italic"');
    expect(svgTop).toContain('text-anchor="end"');

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const id = ed.getSnapshot().doc.elements[0].id;
      ed.commitHistory();
      ed.updateElements([id], { labelPosition: "bottom-left", bold: false });
    });
    const svgBottom = await readSvg();
    expect(svgBottom).toContain(">Context</text>");
    expect(svgBottom).toContain('text-anchor="start"');

    // external side export (covers the external anchor math)
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const id = ed.getSnapshot().doc.elements[0].id;
      ed.commitHistory();
      ed.updateElements([id], { labelPosition: "top-left", labelSide: "external" });
    });
    const svgExt = await readSvg();
    expect(svgExt).toContain(">Context</text>");
    expect(svgExt).toContain('text-anchor="start"');
  });

  test("dragging a context over another does not nest them", async ({
    page,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 100, y: 100 }, { x: 400, y: 300 });
    await drag(page, { x: 500, y: 350 }, { x: 700, y: 500 });

    await selectTool(page, "1");
    // drag the second context over the first
    await drag(page, { x: 600, y: 420 }, { x: 300, y: 200 });

    const contexts = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed
        .getSnapshot()
        .doc.elements.filter((el: any) => el.type === "context")
        .map((el: any) => el.childIds ?? []);
    });
    expect(contexts).toHaveLength(2);
    for (const ids of contexts) expect(ids).toHaveLength(0);
  });

  test("deleting a contained element removes its reference", async ({
    page,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 100, y: 100 }, { x: 500, y: 400 });

    await selectTool(page, "2");
    await drag(page, { x: 200, y: 200 }, { x: 300, y: 300 });

    const before = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements.find((el: any) => el.type === "context")
        .childIds.length;
    });
    expect(before).toBe(1);

    // select the rectangle and delete it
    await selectTool(page, "1");
    await page.mouse.click(250, 250);
    await page.keyboard.press("Delete");

    const after = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const ctx = ed.getSnapshot().doc.elements.find(
        (el: any) => el.type === "context",
      );
      return { childIds: ctx.childIds ?? [], count: ctx.childIds?.length ?? 0 };
    });
    expect(after.count).toBe(0);
  });

  test("context exports to PNG without clipping its label", async ({
    page,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });

    const downloadPromise = page.waitForEvent("download");
    await page.click(".menu-btn");
    await page.getByRole("button", { name: "Export Image…" }).click();
    await page.getByRole("button", { name: "PNG" }).click();
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.png$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const png = Buffer.concat(chunks);
    // PNG signature + size: label expansion makes export non-trivially sized
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(png.length).toBeGreaterThan(100);
  });

  test("editing a styled context label hits every corner overlay", async ({
    page,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });

    const id = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const id = ed.getSnapshot().doc.elements[0].id;
      ed.commitHistory();
      ed.updateElements([id], { bold: true, italic: true });
      return id;
    });

    await selectTool(page, "1");
    // one editing session; cycling position/side re-runs the overlay update
    await page.mouse.dblclick(350, 300);
    await page.waitForTimeout(120);
    const sides = ["external", "internal"];
    for (const side of sides) {
      for (const pos of ["top-left", "top-right", "bottom-left", "bottom-right"]) {
        await page.evaluate(
          ({ id, pos, side }) => {
            const ed = (window as any).__editor__;
            ed.commitHistory();
            ed.updateElements([id], { labelPosition: pos, labelSide: side });
          },
          { id, pos, side },
        );
        await page.waitForTimeout(100);
      }
    }
    await page.keyboard.press("Escape");

    const state = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      return {
        label: el.label,
        labelPosition: el.labelPosition,
        labelSide: el.labelSide,
      };
    });
    expect(state.label).toBe("Context");
    expect(state.labelPosition).toBe("bottom-right");
    expect(state.labelSide).toBe("internal");
  });

  test("context label offset is configurable via the Text tab", async ({
    page,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });

    await selectTool(page, "1");
    await page.mouse.click(350, 300);
    await page
      .locator(".properties-panel .panel-tabs")
      .getByRole("button", { name: "Text", exact: true })
      .click();

    // default global offset for contexts is 6
    const dflt = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].textOffsetGlobal;
    });
    expect(dflt).toBeUndefined();

    const rows = page
      .locator(".properties-panel")
      .getByText("Text offset (px)");
    await rows.scrollIntoViewIfNeeded();

    // bump the global offset via the row input + spinner
    const globalRow = page
      .locator(".properties-panel")
      .getByText("Global", { exact: true });
    await globalRow.scrollIntoViewIfNeeded();
    const plusBtn = page.getByRole("button", { name: "Increase Global" });
    await plusBtn.click();

    const after = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].textOffsetGlobal;
    });
    expect(after).toBeGreaterThan(0);
  });

  test("legacy context without side/position fields still renders and moves", async ({
    page,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });
    await selectTool(page, "2");
    await drag(page, { x: 300, y: 300 }, { x: 400, y: 380 });

    // simulate a doc saved before labelSide/labelPosition existed
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const id = ed.getSnapshot().doc.elements.find(
        (el: any) => el.type === "context",
      ).id;
      const doc = ed.getSnapshot().doc;
      ed.doc = {
        ...doc,
        elements: doc.elements.map((el: any) => {
          if (el.id !== id) return el;
          const { labelSide, labelPosition, ...rest } = el;
          return { ...rest, labelSide: undefined, labelPosition: undefined };
        }),
      };
      ed.emit();
    });
    await page.waitForTimeout(150);

    // dragging still moves the contained rectangle with the context
    await selectTool(page, "1");
    await drag(page, { x: 250, y: 230 }, { x: 330, y: 310 });

    const after = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      return { type: el.type, label: el.label, childIds: el.childIds ?? [] };
    });
    expect(after.type).toBe("context");
    expect(after.label).toBe("Context");
    expect(after.childIds).toHaveLength(1);
  });

  test("pasting a contained element keeps it inside the context", async ({
    page,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 100, y: 100 }, { x: 700, y: 500 });

    await selectTool(page, "2");
    await drag(page, { x: 250, y: 250 }, { x: 350, y: 350 });

    await selectTool(page, "1");
    await page.mouse.click(300, 300);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.copySelected();
    });
    await pressPaste(page);

    const childIds = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements.find((el: any) => el.type === "context")
        .childIds.length;
    });
    expect(childIds).toBe(2);
  });

  test("duplicating a context remaps child membership to the clones", async ({
    page,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 100, y: 100 }, { x: 600, y: 450 });

    await selectTool(page, "2");
    await drag(page, { x: 200, y: 200 }, { x: 300, y: 300 });

    // select and duplicate the context + its child
    await selectTool(page, "1");
    await page.mouse.click(150, 150);
    const origCtx = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const c = ed.getSnapshot().doc.elements.find((el: any) => el.type === "context");
      const r = ed.getSnapshot().doc.elements.find((el: any) => el.type === "rectangle");
      return { ctxId: c.id, origRectId: r.id };
    });
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("ControlOrMeta+d");

    const result = await page.evaluate((orig) => {
      const ed = (window as any).__editor__;
      const doc = ed.getSnapshot().doc;
      const rects = doc.elements.filter((el: any) => el.type === "rectangle");
      const ctxs = doc.elements.filter((el: any) => el.type === "context");
      const cloneCtx = ctxs.find((c: any) => c.id !== orig.ctxId)!;
      const cloneRects = rects.filter((r: any) => r.id !== orig.origRectId);
      return {
        elementCount: doc.elements.length,
        origChildIds: ctxs.find((c: any) => c.id === orig.ctxId)!.childIds ?? [],
        cloneChildIds: cloneCtx.childIds ?? [],
        cloneRectIds: cloneRects.map((r: any) => r.id),
      };
    }, origCtx);

    expect(result.elementCount).toBe(4);
    // no dangling references: every member ref resolves to an existing rect
    const rectIdSet = new Set([
      ...result.cloneChildIds,
      ...result.origChildIds,
    ]);
    const allRectIds = new Set([...result.cloneRectIds, origCtx.origRectId]);
    for (const id of rectIdSet) {
      expect(allRectIds.has(id)).toBe(true);
    }
    // the duplicated context owns the duplicated child
    expect(result.cloneChildIds).toContain(result.cloneRectIds[0]);
    // original context keeps its own child
    expect(result.origChildIds).toContain(origCtx.origRectId);
  });

  test("undo and redo restore context moves", async ({ page }) => {
    await selectTool(page, "8");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });

    await selectTool(page, "1");
    await drag(page, { x: 350, y: 300 }, { x: 450, y: 400 });

    const pos = () =>
      page.evaluate(() => {
        const ed = (window as any).__editor__;
        const el = ed.getSnapshot().doc.elements[0];
        return { x: el.x, y: el.y };
      });

    const moved = await pos();
    expect(moved.x).toBe(300);

    await page.keyboard.press("ControlOrMeta+z");
    const undone = await pos();
    expect(undone.x).toBe(200);

    await page.keyboard.press("ControlOrMeta+Shift+z");
    const redone = await pos();
    expect(redone.x).toBe(300);
  });

  test("context with fill, roughness and radius renders", async ({ page }) => {
    await selectTool(page, "8");
    await drag(page, { x: 200, y: 200 }, { x: 500, y: 400 });

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const id = ed.getSnapshot().doc.elements[0].id;
      ed.commitHistory();
      ed.updateElements([id], {
        backgroundColor: "#e8ecf4",
        roughness: 3,
        borderRadius: 100,
      });
    });
    await page.waitForTimeout(150);

    const style = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      return {
        backgroundColor: el.backgroundColor,
        roughness: el.roughness,
        borderRadius: el.borderRadius,
      };
    });
    expect(style.backgroundColor).toBe("#e8ecf4");
    expect(style.roughness).toBe(3);
    expect(style.borderRadius).toBe(100);

    // second pass: sketch stroke with a square border (radius 0)
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const id = ed.getSnapshot().doc.elements[0].id;
      ed.commitHistory();
      ed.updateElements([id], { borderRadius: 0 });
    });
    await page.waitForTimeout(150);
    const square = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].borderRadius;
    });
    expect(square).toBe(0);
  });

  test("dragging an element into a context always gives it superior z-index over the context", async ({
    page,
  }) => {
    await selectTool(page, "2");
    await drag(page, { x: 600, y: 200 }, { x: 700, y: 300 });

    await selectTool(page, "8");
    await drag(page, { x: 100, y: 100 }, { x: 500, y: 400 });

    const initialOrder = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const elements = ed.getSnapshot().doc.elements;
      return {
        rectIdx: elements.findIndex((el: any) => el.type === "rectangle"),
        ctxIdx: elements.findIndex((el: any) => el.type === "context"),
      };
    });
    expect(initialOrder.rectIdx).toBe(0);
    expect(initialOrder.ctxIdx).toBe(1);
    expect(initialOrder.rectIdx).toBeLessThan(initialOrder.ctxIdx);

    await selectTool(page, "1");
    await drag(page, { x: 650, y: 250 }, { x: 250, y: 250 });

    const afterDragOrder = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const elements = ed.getSnapshot().doc.elements;
      const ctx = elements.find((el: any) => el.type === "context");
      const rect = elements.find((el: any) => el.type === "rectangle");
      return {
        rectIdx: elements.findIndex((el: any) => el.type === "rectangle"),
        ctxIdx: elements.findIndex((el: any) => el.type === "context"),
        childIds: ctx.childIds ?? [],
        rectId: rect.id,
      };
    });
    expect(afterDragOrder.childIds).toContain(afterDragOrder.rectId);
    expect(afterDragOrder.rectIdx).toBeGreaterThan(afterDragOrder.ctxIdx);

    await page.mouse.click(50, 50);
    await page.mouse.click(250, 250);
    const selected = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const ids = Array.from(ed.getSnapshot().selectedIds);
      const elements = ed.getSnapshot().doc.elements;
      const selectedEl = elements.find((el: any) => ids.includes(el.id));
      return selectedEl ? selectedEl.type : null;
    });
    expect(selected).toBe("rectangle");
  });

  test("drawing a context around an existing element places context behind it with inferior z-index", async ({
    page,
  }) => {
    await selectTool(page, "2");
    await drag(page, { x: 200, y: 200 }, { x: 300, y: 300 });

    await selectTool(page, "8");
    await drag(page, { x: 100, y: 100 }, { x: 500, y: 400 });

    const order = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const elements = ed.getSnapshot().doc.elements;
      return {
        rectIdx: elements.findIndex((el: any) => el.type === "rectangle"),
        ctxIdx: elements.findIndex((el: any) => el.type === "context"),
      };
    });
    expect(order.rectIdx).toBeGreaterThan(order.ctxIdx);

    await selectTool(page, "1");
    await page.mouse.click(50, 50);
    await page.mouse.click(250, 250);
    const selected = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const ids = Array.from(ed.getSnapshot().selectedIds);
      const elements = ed.getSnapshot().doc.elements;
      const selectedEl = elements.find((el: any) => ids.includes(el.id));
      return selectedEl ? selectedEl.type : null;
    });
    expect(selected).toBe("rectangle");
  });

  test("context layer reorder preserves superior z-index for children", async ({
    page,
  }) => {
    await selectTool(page, "8");
    await drag(page, { x: 100, y: 100 }, { x: 500, y: 400 });

    await selectTool(page, "2");
    await drag(page, { x: 200, y: 200 }, { x: 300, y: 300 });

    await selectTool(page, "1");
    await page.mouse.click(150, 150);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.bringToFront();
    });

    const order = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const elements = ed.getSnapshot().doc.elements;
      return {
        rectIdx: elements.findIndex((el: any) => el.type === "rectangle"),
        ctxIdx: elements.findIndex((el: any) => el.type === "context"),
      };
    });
    expect(order.rectIdx).toBeGreaterThan(order.ctxIdx);
  });
});
