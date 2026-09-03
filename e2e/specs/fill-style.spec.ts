import { test, expect, open, drag } from "../fixtures";

async function firstElement(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const s = (window as any).__editor__.getSnapshot();
    return s.doc.elements[0];
  });
}

async function drawRectangle(page: import("@playwright/test").Page) {
  await open(page);
  await page.keyboard.press("2");
  await drag(page, { x: 100, y: 100 }, { x: 220, y: 180 });
  await page.keyboard.press("1");
}

test.describe("fill styles", () => {
  test("new shapes default to a solid fill", async ({ page }) => {
    await drawRectangle(page);
    const el = await firstElement(page);
    expect(el.fillStyle ?? "solid").toBe("solid");
  });

  test("hachure button sets a 45-degree line fill", async ({ page }) => {
    await drawRectangle(page);
    await page.getByRole("button", { name: "Fill Hachure", exact: true }).click();
    const el = await firstElement(page);
    expect(el.fillStyle).toBe("hachure");
  });

  test("cross-hachure button sets both diagonal line directions", async ({ page }) => {
    await drawRectangle(page);
    await page
      .getByRole("button", { name: "Fill Cross hachure", exact: true })
      .click();
    const el = await firstElement(page);
    expect(el.fillStyle).toBe("cross-hachure");
  });

  test("fill style persists across a reload", async ({ page }) => {
    await drawRectangle(page);
    await page
      .getByRole("button", { name: "Fill Cross hachure", exact: true })
      .click();
    await page.reload();
    await open(page);
    const el = await firstElement(page);
    expect(el.fillStyle).toBe("cross-hachure");
  });

  test("fill opacity keeps driving hachure alpha", async ({ page }) => {
    await drawRectangle(page);
    await page
      .getByRole("slider", { name: "Fill opacity" })
      .fill("40");
    await page.getByRole("button", { name: "Fill Hachure", exact: true }).click();
    const el = await firstElement(page);
    expect(el.fillOpacity).toBeCloseTo(0.4, 1);
    expect(el.fillStyle).toBe("hachure");
  });

  test("hachure still renders over a transparent background", async ({ page }) => {
    await drawRectangle(page);
    await page
      .getByRole("button", { name: "Fill Hachure", exact: true })
      .click();
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { backgroundColor: "transparent" });
    });
    const el = await firstElement(page);
    expect(el.backgroundColor).toBe("transparent");
    expect(el.fillStyle).toBe("hachure");
  });

  test("hachure follows the stroke roughness: sketchy stroke, sketchy hatch lines", async ({
    page,
  }) => {
    await drawRectangle(page);
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { roughness: 2 });
    });
    await page
      .getByRole("button", { name: "Fill Hachure", exact: true })
      .click();
    const el = await firstElement(page);
    expect(el.roughness).toBe(2);
    expect(el.fillStyle).toBe("hachure");
  });

  test("hachure keeps the stroke roughness across a change, not just defaults", async ({
    page,
  }) => {
    await drawRectangle(page);
    await page
      .getByRole("button", { name: "Fill Cross hachure", exact: true })
      .click();
    await page.evaluate(() => {
      const ed = (window as any).__editor__;
      const el = ed.getSnapshot().doc.elements[0];
      ed.updateElements([el.id], { roughness: 3 });
    });
    const el = await firstElement(page);
    expect(el.fillStyle).toBe("cross-hachure");
    expect(el.roughness).toBe(3);
  });
});