import { test, expect, open, drag, selectTool } from "../fixtures";
import { type Page } from "@playwright/test";

async function drawRect(
  page: Page,
  from = { x: 200, y: 150 },
  to = { x: 320, y: 220 },
) {
  await selectTool(page, "2");
  await drag(page, from, to);
  await selectTool(page, "1");
}

async function selectAll(page: Page) {
  await page.evaluate(() => (window as any).__editor__.selectAll());
}

function els(page: Page) {
  return page.evaluate(() => {
    const ed = (window as any).__editor__;
    return ed
      .getSnapshot()
      .doc.elements.map((el: any) => ({
        id: el.id,
        type: el.type,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        startBinding: el.startBinding,
        endBinding: el.endBinding,
        controlPoint: el.controlPoint,
        text: el.text,
        label: el.label,
        editingTextId: ed.getSnapshot().editingTextId,
      }));
  });
}

test.describe("alignment", () => {
  test("PropertiesPanel align buttons line up two selected shapes", async ({
    page,
  }) => {
    await open(page);
    await drawRect(page, { x: 200, y: 150 }, { x: 320, y: 220 });
    await drawRect(page, { x: 420, y: 300 }, { x: 540, y: 370 });
    await selectAll(page);
    await page.waitForTimeout(300);

    // alignment controls live in the Layers tab of the panel
    await page.locator(".panel-tab", { hasText: "Layers" }).click();
    const align = (name: string) =>
      page.locator(`.size-btn[data-tip="${name}"]`);

    await align("Align left").click();
    let s = (await els(page)).sort((a, b) => a.x - b.x);
    expect(s[0].x).toBe(s[1].x);

    await align("Align right").click();
    s = (await els(page)).sort((a, b) => a.x - b.x);
    expect(s[0].x + s[0].width).toBeCloseTo(s[1].x + s[1].width, 0);

    await align("Align center").click();
    s = (await els(page)).sort((a, b) => a.x - b.x);
    expect(s[0].x + s[0].width / 2).toBeCloseTo(s[1].x + s[1].width / 2, 0);

    await align("Align top").click();
    s = (await els(page)).sort((a, b) => a.y - b.y);
    expect(s[0].y).toBeCloseTo(s[1].y, 0);

    await align("Align middle").click();
    s = (await els(page)).sort((a, b) => a.y - b.y);
    expect(s[0].y + s[0].height / 2).toBeCloseTo(s[1].y + s[1].height / 2, 0);

    await align("Align bottom").click();
    s = (await els(page)).sort((a, b) => a.y - b.y);
    expect(s[0].y + s[0].height).toBeCloseTo(s[1].y + s[1].height, 0);
  });
});

test.describe("double-click editing", () => {
  test("double-clicking empty canvas creates a free text element", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await selectTool(page, "1");
    await page.mouse.dblclick(400, 300);

    const s = await editorState();
    expect(s.editingTextId).not.toBeNull();
    expect(s.elementCount).toBe(1);
    expect(s.elements[0].type).toBe("text");
  });

  test("double-clicking an existing text re-enters edit mode", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(250, 250);
    await page.keyboard.type("API Gateway");
    await page.keyboard.press("Escape");
    await selectTool(page, "1");

    await page.mouse.dblclick(300, 262);
    const s = await editorState();
    expect(s.editingTextId).not.toBeNull();

    // re-editing selects the whole value, so typing replaces it
    await page.locator("textarea.text-overlay").waitFor();
    const selection = await page.evaluate(() => {
      const ta = document.querySelector(
        "textarea.text-overlay",
      ) as HTMLTextAreaElement;
      return { start: ta.selectionStart, end: ta.selectionEnd, len: ta.value.length };
    });
    expect(selection.start).toBe(0);
    expect(selection.end).toBe(selection.len);

    await page.keyboard.type("BFF");
    await page.keyboard.press("Escape");
    const text = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].text;
    });
    expect(text).toBe("BFF");
  });

  test("double-clicking a rectangle enters label editing", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.mouse.dblclick(280, 185);

    const s = await editorState();
    expect(s.editingTextId).not.toBeNull();

    await page.keyboard.type("DB");
    await page.keyboard.press("Escape");
    const label = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      return ed.getSnapshot().doc.elements[0].label;
    });
    expect(label).toBe("DB");
  });
});

test.describe("curved arrows", () => {
  test("dragging the control-point handle curves a straight arrow", async ({
    page,
  }) => {
    await open(page);
    await selectTool(page, "6");
    await drag(page, { x: 200, y: 300 }, { x: 400, y: 360 });
    await selectTool(page, "1");

    // select the arrow, then convert it to a curved line through the model
    await page.mouse.click(300, 330);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { lineType: "curved" });
    });

    // the fallback handle sits at the curve apex (midpoint raised 30%)
    const handle = await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      const a = { x: el.x, y: el.y };
      const tip = { x: el.x + el.width, y: el.y + el.height };
      return {
        x: (a.x + tip.x) / 2,
        y: (a.y + tip.y) / 2 - Math.abs(tip.x - a.x) * 0.3,
      };
    });

    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    await page.mouse.move(handle.x, handle.y - 40, { steps: 5 });
    await page.mouse.up();

    const s = (await els(page))[0];
    expect(s.controlPoint).toBeTruthy();
    expect(s.controlPoint!.y).toBeLessThan(handle.y);
  });
});

test.describe("binding cleanup", () => {
  test("deleting a bound element clears only the affected bindings", async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      ed.restoreState(
        JSON.stringify({
          schemaVersion: 2,
          activeTabId: "t",
          tabs: [
            {
              id: "t",
              name: "d",
              doc: {
                schemaVersion: 1,
                elements: [
                  {
                    id: "src",
                    type: "rectangle",
                    x: 100,
                    y: 100,
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
                    roughness: 0,
                    borderRadius: 0,
                  },
                  {
                    id: "dst",
                    type: "rectangle",
                    x: 400,
                    y: 300,
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
                    roughness: 0,
                    borderRadius: 0,
                  },
                  {
                    id: "ar",
                    type: "arrow",
                    x: 200,
                    y: 140,
                    width: 200,
                    height: 160,
                    strokeColor: "#3d4248",
                    backgroundColor: "transparent",
                    strokeWidth: 2,
                    opacity: 1,
                    strokeOpacity: 1,
                    fillOpacity: 1,
                    strokeStyle: "solid",
                    fillStyle: "solid",
                    roughness: 0,
                    startBinding: { elementId: "src", nx: 1, ny: 0.5 },
                    endBinding: { elementId: "dst", nx: 0, ny: 0.5 },
                  },
                ],
              },
              camera: { scrollX: 0, scrollY: 0, zoom: 1 },
            },
          ],
        }),
      );
    });

    // select the source rectangle by clicking it, then delete it
    await page.mouse.click(150, 140);
    await page.keyboard.press("Delete");

    const s = (await els(page)).find((e) => e.id === "ar");
    expect(s!.startBinding).toBeUndefined();
    expect(s!.endBinding).toEqual({ elementId: "dst", nx: 0, ny: 0.5 });
  });
});

test.describe("library built-ins", () => {
  test("each built-in vendor section inserts a component tile", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.keyboard.press("l");
    await expect(page.locator(".library-panel")).toBeVisible();

    for (const section of ["AWS", "GCP", "Azure", "Kubernetes"]) {
      await page
        .locator(".library-section-header", { hasText: section })
        .click();
      const tile = page
        .locator(`.library-section:has-text("${section}") .library-tile`)
        .first();
      await expect(tile).toBeVisible();
      await tile.click();
    }

    const s = await editorState();
    expect(s.elementCount).toBe(4);
    expect(s.elements.every((e) => e.type === "component")).toBe(true);
  });

  test("expanding the Kubernetes section inserts a component tile", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await page.keyboard.press("l");
    await expect(page.locator(".library-panel")).toBeVisible();

    await page.locator(".library-section-header", { hasText: "Kubernetes" }).click();
    const tile = page.locator('.library-section:has-text("Kubernetes") .library-tile');
    await expect(tile.first()).toBeVisible();
    await tile.first().click();

    const s = await editorState();
    expect(s.elementCount).toBe(1);
    expect(s.elements[0].type).toBe("component");
  });

  test("dropping a custom library tile onto the canvas re-inserts the group", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.mouse.click(280, 185, { button: "right" });
    await page.getByTestId("context-menu-add-library").click();
    await expect(page.getByTestId("context-menu")).toHaveCount(0);

    await page.keyboard.press("l");
    await expect(page.locator(".library-panel")).toBeVisible();
    await page
      .locator('[data-testid="library-custom"] .library-group-name')
      .click();
    await expect(
      page.locator('[data-testid="library-custom"] .library-tile'),
    ).toHaveCount(1);

    await page.evaluate(() => {
      const tile = document.querySelector(
        '[data-testid="library-custom"] .library-tile',
      ) as HTMLButtonElement;
      const host = document.querySelector(".canvas-host") as HTMLElement;
      const dt = new DataTransfer();
      tile.dispatchEvent(
        new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }),
      );
      host.dispatchEvent(
        new DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
        }),
      );
      host.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          clientX: 500,
          clientY: 400,
        }),
      );
    });

    await expect
      .poll(() =>
        page.evaluate(
          () => (window as any).__editor__.getSnapshot().doc.elements.length,
        ),
      )
      .toBe(2);
    const s = await editorState();
    expect(s.elementCount).toBe(2);
  });
});

test.describe("files", () => {
  test("img shortcut opens the image picker and importing an image inserts a component", async ({
    page,
    editorState,
  }) => {
    await open(page);
    const chooserPromise = page.waitForEvent("filechooser");
    await page.keyboard.press("i");
    const chooser = await chooserPromise;
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    await chooser.setFiles({
      name: "dot.png",
      mimeType: "image/png",
      buffer: png,
    });

    await expect
      .poll(() =>
        page.evaluate(
          () => (window as any).__editor__.getSnapshot().doc.elements.length,
        ),
      )
      .toBe(1);
    const s = await editorState();
    expect(s.elements[0].type).toBe("component");
  });
});

test.describe("shortcuts modal", () => {
  test("help opens the shortcuts modal from the app menu", async ({ page }) => {
    await open(page);
    await page.getByTestId("app-menu-button").click();
    await page.locator(".menu-item", { hasText: "Shortcuts" }).click();
    await expect(page.getByRole("dialog", { name: "Shortcuts" })).toBeVisible();
  });
});