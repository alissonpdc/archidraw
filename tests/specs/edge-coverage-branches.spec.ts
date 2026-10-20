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

test.describe("history.ts undo stack overflow", () => {
  test("pushing beyond maxDepth triggers shift()", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      for (let i = 0; i < 105; i++) {
        ed.commitHistory();
      }
    });
    const canUndo = await page.evaluate(
      () => (window as any).__editor__.canUndo(),
    );
    expect(canUndo).toBe(true);
  });
});

test.describe("textStyle.ts resolveTextColor empty strokeColor", () => {
  test("text element with empty strokeColor renders without error", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await selectTool(page, "7");
    await page.mouse.click(300, 300);
    await page.keyboard.type("Test");
    await page.keyboard.press("Escape");
    await selectTool(page, "1");

    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { strokeColor: "", textColor: "" });
    });

    await page.waitForTimeout(100);

    const s = await editorState();
    expect(s.elementCount).toBe(1);
  });
});

test.describe("bgPrefs.ts resolveThemeSwitch with invalid stored color", () => {
  test("theme switch to dark with non-palette light color resets", async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(() => {
      localStorage.setItem("archidraw:bg-color", "#ff0000");
    });
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
    await page.waitForTimeout(100);
    const stored = await page.evaluate(() =>
      localStorage.getItem("archidraw:bg-color"),
    );
    expect(stored).not.toBe("#ff0000");
  });

  test("theme switch to light with non-palette dark color resets", async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      localStorage.setItem("archidraw:bg-color", "#ff0000");
    });
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light";
    });
    await page.waitForTimeout(100);
    const stored = await page.evaluate(() =>
      localStorage.getItem("archidraw:bg-color"),
    );
    expect(stored).not.toBe("#ff0000");
  });
});

test.describe("editor.ts lock/unlock elements", () => {
  test("deleteSelected skips locked elements", async ({
    page,
    editorState,
  }) => {
    await open(page);
    await drawRect(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { locked: true } as any);
      ed.deleteSelected();
    });
    const s = await editorState();
    expect(s.elementCount).toBe(1);
  });
});

test.describe("editor.ts duplicateSelected edge cases", () => {
  test("duplicateSelected with no selection is a no-op", async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      (window as any).__editor__.duplicateSelected();
    });
    const s = await page.evaluate(
      () => (window as any).__editor__.getSnapshot().doc.elements.length,
    );
    expect(s).toBe(0);
  });
});
