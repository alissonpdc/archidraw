import { test, expect, open, selectTool, drag } from "../fixtures";
import type { Page } from "@playwright/test";
import { BASE_COLORS, shadesOf } from "../../src/core/color";

interface ElementColors {
  strokeColor: string;
  backgroundColor: string;
}

const readColors = async (page: Page) =>
  page.evaluate((): ElementColors | null => {
    const el = (window as any).__editor__.getSnapshot().doc.elements[0];
    return el
      ? { strokeColor: el.strokeColor, backgroundColor: el.backgroundColor }
      : null;
  });

test.describe("Reload color stability", () => {
  test("stored theme pref contradicting system colors keeps palette shades stable across reloads", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("archidraw:theme", "dark");
    });
    await page.emulateMedia({ colorScheme: "light" });

    await open(page);

    await selectTool(page, "2");
    await drag(page, { x: 100, y: 100 }, { x: 200, y: 200 });
    await page.keyboard.press("Escape");

    const blueShades = shadesOf(
      BASE_COLORS.find((b) => b.name === "Blue")!.color,
    );

    await page.evaluate(
      (shades) => {
        const editor = (window as any).__editor__;
        const el = editor.getSnapshot().doc.elements[0];
        editor.updateElements([el.id], {
          strokeColor: shades[0],
          backgroundColor: shades[4],
        });
      },
      blueShades,
    );

    await page.waitForTimeout(1000);

    const before = await readColors(page);
    expect(before).toEqual({
      strokeColor: blueShades[0],
      backgroundColor: blueShades[4],
    });

    for (let i = 0; i < 2; i++) {
      await page.reload();
      await open(page);
      expect(await readColors(page)).toEqual(before);
    }
  });

  test("real theme switch still correlates palette shades on reload", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("archidraw:theme", "light");
    });
    await page.emulateMedia({ colorScheme: "light" });

    await open(page);

    const blueShades = shadesOf(
      BASE_COLORS.find((b) => b.name === "Blue")!.color,
    );

    await selectTool(page, "2");
    await drag(page, { x: 100, y: 100 }, { x: 200, y: 200 });
    await page.keyboard.press("Escape");

    await page.evaluate(
      (shades) => {
        const editor = (window as any).__editor__;
        const el = editor.getSnapshot().doc.elements[0];
        editor.updateElements([el.id], { strokeColor: shades[0] });
      },
      blueShades,
    );

    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
    await page.waitForTimeout(300);

    expect(
      await page.evaluate(
        () => (window as any).__editor__.getSnapshot().doc.elements[0].strokeColor,
      ),
    ).toBe(blueShades[4]);
  });
});
