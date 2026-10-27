import { test, expect, open, pressPasteText } from "../fixtures";

type Page = import("@playwright/test").Page;

const payload = {
  schemaVersion: 1,
  type: "archidraw/elements",
  elements: [
    {
      id: "el_poly_label",
      type: "polygon",
      x: 400,
      y: 300,
      width: 200,
      height: 120,
      strokeColor: "#3d4248",
      backgroundColor: "#dfe0e2",
      fillStyle: "solid",
      label: "API",
      rings: [
        [
          { x: 20, y: 0 },
          { x: 180, y: 0 },
          { x: 200, y: 60 },
          { x: 180, y: 120 },
          { x: 20, y: 120 },
          { x: 0, y: 60 },
        ],
      ],
    },
  ],
};

async function polygonCenter(page: Page) {
  return page.evaluate(() => {
    const snap = (window as any).__editor__.getSnapshot();
    const el = snap.doc.elements.find((e: { type: string }) => e.type === "polygon");
    const cam = snap.camera;
    return {
      x: (el.x + el.width / 2) * cam.zoom + cam.scrollX,
      y: (el.y + el.height / 2) * cam.zoom + cam.scrollY,
    };
  });
}

async function polygonLabel(page: Page): Promise<string | undefined> {
  return page.evaluate(() => {
    const snap = (window as any).__editor__.getSnapshot();
    return snap.doc.elements.find((e: { type: string }) => e.type === "polygon")?.label;
  });
}

test.describe("polygon label editing", () => {
  test.describe("pasted polygon", () => {
    test.beforeEach(async ({ page }) => {
      await open(page);
      await pressPasteText(page, JSON.stringify(payload));
      await expect.poll(() => polygonLabel(page)).toBe("API");
    });

    test("double-click opens the label overlay over the polygon and commits with undo", async ({
      page,
      editorState,
    }) => {
      const c = await polygonCenter(page);
      expect(c.x).toBeGreaterThan(260);
      expect(c.y).toBeGreaterThan(80);
      await page.mouse.dblclick(c.x, c.y);

      const overlay = page.locator("textarea.label-overlay");
      await overlay.waitFor();
      await expect(overlay).toHaveValue("API");
      const state = await editorState();
      const poly = state.elements.find((e) => e.type === "polygon")!;
      expect(state.editingTextId).toBe(poly.id);

      const box = (await overlay.boundingBox())!;
      expect(Math.abs(box.x + box.width / 2 - c.x)).toBeLessThan(40);
      expect(Math.abs(box.y + box.height / 2 - c.y)).toBeLessThan(40);

      await page.keyboard.press("ControlOrMeta+a");
      await page.keyboard.type("Gateway");
      await page.keyboard.press("Enter");
      await expect(overlay).toHaveCount(0);
      expect(await polygonLabel(page)).toBe("Gateway");

      await page.keyboard.press("ControlOrMeta+z");
      await expect.poll(() => polygonLabel(page)).toBe("API");
      await page.keyboard.press("ControlOrMeta+Shift+z");
      await expect.poll(() => polygonLabel(page)).toBe("Gateway");
    });

    test("escape without changes keeps the label and leaves no extra history entry", async ({
      page,
    }) => {
      const c = await polygonCenter(page);
      await page.mouse.dblclick(c.x, c.y);
      const overlay = page.locator("textarea.label-overlay");
      await overlay.waitFor();
      await page.keyboard.press("Escape");
      await expect(overlay).toHaveCount(0);
      expect(await polygonLabel(page)).toBe("API");
      await page.keyboard.press("ControlOrMeta+z");
      await expect.poll(() => polygonLabel(page)).toBeUndefined();
    });

    test("selected polygon exposes label alignment, vertical position and text offset", async ({
      page,
    }) => {
      const c = await polygonCenter(page);
      await page.mouse.click(c.x, c.y);
      await page.locator(".panel-tab", { hasText: "Text" }).click();
      await expect(page.getByRole("button", { name: "Alignment left" })).toBeVisible();
      await page.getByRole("button", { name: "Alignment left" }).click();
      await page.getByRole("button", { name: "Vertical Top" }).click();
      const el = await page.evaluate(() => {
        const snap = (window as any).__editor__.getSnapshot();
        return snap.doc.elements[0];
      });
      expect(el.textAlign).toBe("left");
      expect(el.textVAlign).toBe("top");
      await expect(page.getByText("Text offset (px)")).toBeVisible();
    });
  });

  test.describe("native library labeled polygon", () => {
    test("double-clicking a native library component polygon opens label editor and commits with undo", async ({
      page,
    }) => {
      await open(page);
      await page.keyboard.press("l");
      await expect(page.locator(".library-panel")).toBeVisible();

      const section = page.locator('[data-testid="library-native-compute-services"]');
      await section.locator(".library-section-header").click();
      await section.locator('[data-tip="API"]').click();
      await page.locator(".library-close").click();

      const polyInfo = await page.evaluate(() => {
        const snap = (window as any).__editor__.getSnapshot();
        const el = snap.doc.elements.find(
          (e: any) => e.type === "polygon" && e.label === "API",
        );
        const cam = snap.camera;
        return {
          id: el.id,
          x: (el.x + el.width / 2) * cam.zoom + cam.scrollX,
          y: (el.y + el.height / 2) * cam.zoom + cam.scrollY,
        };
      });

      expect(polyInfo.x).toBeGreaterThan(260);
      expect(polyInfo.y).toBeGreaterThan(80);

      await page.mouse.dblclick(polyInfo.x, polyInfo.y);

      const overlay = page.locator("textarea.label-overlay");
      await overlay.waitFor();
      await expect(overlay).toHaveValue("API");

      await page.keyboard.press("ControlOrMeta+a");
      await page.keyboard.type("ENDPOINT");
      await page.keyboard.press("Enter");
      await expect(overlay).toHaveCount(0);

      const updated = await page.evaluate((id: string) => {
        const snap = (window as any).__editor__.getSnapshot();
        return snap.doc.elements.find((e: any) => e.id === id)?.label;
      }, polyInfo.id);
      expect(updated).toBe("ENDPOINT");

      await page.keyboard.press("ControlOrMeta+z");
      await expect.poll(() =>
        page.evaluate((id: string) => {
          const snap = (window as any).__editor__.getSnapshot();
          return snap.doc.elements.find((e: any) => e.id === id)?.label;
        }, polyInfo.id),
      ).toBe("API");
    });
  });
});
