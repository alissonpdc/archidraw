import { test, expect, open } from "../fixtures";
import { type Page } from "@playwright/test";

const BG_KEY = "archidraw:bg-color";

async function openMenu(page: Page) {
  await page.getByTestId("app-menu-button").click();
  await expect(page.locator(".menu-dropdown")).toBeVisible();
}

function bgSnapshot(page: Page) {
  return page.evaluate((key) => {
    const root = document.documentElement;
    const token = getComputedStyle(root)
      .getPropertyValue("--bg-canvas")
      .trim();
    const hex = token.replace("#", "");
    return {
      css:
        hex.length === 3
          ? "#" + hex.split("").map((c) => c + c).join("")
          : token,
      inline: root.style.getPropertyValue("--bg-canvas"),
      stored: localStorage.getItem(key),
    };
  }, BG_KEY);
}

async function pickBg(page: Page, title: string) {
  await page.locator(`.menu-bg-swatch[title="${title}"]`).click();
}

async function pickMode(page: Page, title: "System" | "Light" | "Dark") {
  await page.locator(`.menu-mode-icon[title="${title}"]`).click();
}

test.describe("canvas background color", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await openMenu(page);
  });

  test("default bg is white and is not written to storage", async ({ page }) => {
    const bg = await bgSnapshot(page);
    expect(bg.css).toBe("#ffffff");
    expect(bg.inline).toBe("");
    expect(bg.stored).toBeNull();
  });

  test("selecting a non-default bg applies it to the DOM and persists it", async ({
    page,
  }) => {
    await pickBg(page, "Cool Gray");

    const bg = await bgSnapshot(page);
    expect(bg.css).toBe("#f6f7f8");
    expect(bg.stored).toBe("#f6f7f8");
  });

  test("re-selecting the active bg is a no-op and keeps storage", async ({
    page,
  }) => {
    await pickBg(page, "Cool Gray");
    await pickBg(page, "Cool Gray");

    const bg = await bgSnapshot(page);
    expect(bg.css).toBe("#f6f7f8");
    expect(bg.stored).toBe("#f6f7f8");
  });

  test("selecting the default bg clears the stored override", async ({
    page,
  }) => {
    await pickBg(page, "Cool Gray");
    await pickBg(page, "White");

    const bg = await bgSnapshot(page);
    expect(bg.inline).toBe("");
    expect(bg.css).toBe("#ffffff");
    expect(bg.stored).toBeNull();
  });
});

test.describe("background follows the active theme", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await openMenu(page);
  });

  test("the default white bg switches to its dark pair and back", async ({
    page,
  }) => {
    let bg = await bgSnapshot(page);
    expect(bg.css).toBe("#ffffff");

    await pickMode(page, "Dark");
    bg = await bgSnapshot(page);
    expect(bg.css).toBe("#090a0c");
    expect(bg.stored).toBeNull();

    await pickMode(page, "Light");
    bg = await bgSnapshot(page);
    expect(bg.css).toBe("#ffffff");
    expect(bg.stored).toBeNull();
  });

  test("switching to dark maps a light bg to its paired dark color and back", async ({
    page,
  }) => {
    await pickBg(page, "Cool Gray");
    await pickMode(page, "Dark");

    let bg = await bgSnapshot(page);
    expect(bg.css).toBe("#101215");
    expect(bg.stored).toBe("#101215");

    await pickMode(page, "Light");
    bg = await bgSnapshot(page);
    expect(bg.css).toBe("#f6f7f8");
    expect(bg.stored).toBe("#f6f7f8");
  });
});

test.describe("theme shortcut", () => {
  test("Shift+Alt+D toggles between dark and light and back", async ({
    page,
  }) => {
    await open(page);

    await page.keyboard.press("Shift+Alt+d");
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(
      "dark",
    );

    await page.keyboard.press("Shift+Alt+d");
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(
      "light",
    );

    await page.keyboard.press("Shift+Alt+d");
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(
      "dark",
    );
  });
});

test.describe("grid and skin prefs", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await openMenu(page);
  });

  async function openGridSubmenu(page: Page) {
    await page
      .locator(".menu-item--submenu", { hasText: "Grid" })
      .click();
    await expect(
      page.locator(".menu-submenu.open .menu-submenu-panel"),
    ).toBeVisible();
  }

  test("grid mode cycles through lines, dots and none and persists", async ({
    page,
  }) => {
    await openGridSubmenu(page);

    await page.locator("button.menu-item", { hasText: "Lines" }).click();
    expect(await page.evaluate(() => localStorage.getItem("archidraw:grid"))).toBe(
      "lines",
    );

    await page.locator("button.menu-item", { hasText: "Dots" }).click();
    expect(await page.evaluate(() => localStorage.getItem("archidraw:grid"))).toBe(
      "dots",
    );

    await page.locator("button.menu-item", { hasText: "None" }).click();
    expect(await page.evaluate(() => localStorage.getItem("archidraw:grid"))).toBe(
      "none",
    );
  });

  test("skin submenu applies the selected skin to the document", async ({
    page,
  }) => {
    await page
      .locator(".menu-item--submenu", { hasText: "Theme" })
      .click();
    await page.locator("button.menu-item", { hasText: "Blueprint" }).click();

    expect(
      await page.evaluate(() => document.documentElement.dataset.skin),
    ).toBe("blueprint");
    expect(await page.evaluate(() => localStorage.getItem("archidraw:skin"))).toBe(
      "blueprint",
    );
  });
});